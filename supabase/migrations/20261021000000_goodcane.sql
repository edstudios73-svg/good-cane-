-- GoodCane pre-orders: schema, access rules, order + SMS functions.
-- Customers never touch tables directly; they call the security-definer
-- functions below. Staff (rows in public.staff) can read everything and change
-- order status through staff_* functions.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------- tables

create table public.products (
  id text primary key,
  name text not null,
  active boolean not null default true,
  sort int not null default 0
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text unique,
  reminders_opt_in boolean not null default false,
  access_token uuid not null unique default gen_random_uuid(),
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);

create sequence public.order_number_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number int not null unique default nextval('public.order_number_seq'),
  view_token uuid not null unique default gen_random_uuid(),
  customer_id uuid not null references public.customers on delete restrict,
  batch_date date not null,
  lines jsonb not null,
  fulfilment text not null check (fulfilment in ('pickup', 'delivery')),
  location text not null,
  note text check (char_length(note) <= 140),
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'paid', 'fulfilled', 'cancelled')),
  history jsonb not null default '[]',
  source text not null default 'direct' check (source in ('tiktok', 'instagram', 'whatsapp', 'direct', 'reorder', 'reminder')),
  reorder_of uuid references public.orders on delete set null,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index orders_batch_idx on public.orders (batch_date);
create index orders_customer_idx on public.orders (customer_id);

create table public.batch_records (
  batch_date date primary key,
  forecast int check (forecast >= 0),
  produced int check (produced >= 0),
  sold int check (sold >= 0),
  updated_at timestamptz not null default now()
);

create table public.sms_log (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers on delete set null,
  order_id uuid references public.orders on delete set null,
  batch_date date,
  kind text not null check (kind in ('received', 'confirmed', 'paid', 'fulfilled', 'cancelled', 'reminder', 'login_code')),
  to_phone text not null,
  body text not null,
  status text not null check (status in ('queued', 'sent', 'failed', 'skipped')),
  request_id bigint,
  error text,
  created_at timestamptz not null default now()
);
create index sms_log_created_idx on public.sms_log (created_at desc);
create index sms_log_request_idx on public.sms_log (request_id) where status = 'queued';

create table public.login_codes (
  phone text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  sent_in_window int not null default 1,
  window_start timestamptz not null default now()
);

create table public.staff (
  user_id uuid primary key references auth.users on delete cascade,
  name text
);

create table public.settings (
  key text primary key,
  value text not null
);

insert into public.settings (key, value) values ('sms_live', 'true'), ('sms_sender', 'GoodCane');

insert into public.products (id, name, sort) values
  ('mint-lemon', 'Mint & Lemon Sugarcane', 1),
  ('passion', 'Passion Fruit Sugarcane', 2),
  ('lemon-ginger', 'Lemon & Ginger Sugarcane', 3),
  ('tigernut-coconut', 'Tigernut & Coconut Sugarcane', 4),
  ('raw', 'Raw Sugarcane', 5);

-- ---------------------------------------------------------------- access

alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.batch_records enable row level security;
alter table public.sms_log enable row level security;
alter table public.login_codes enable row level security;
alter table public.staff enable row level security;
alter table public.settings enable row level security;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = auth.uid())
$$;

create policy "products are public" on public.products for select to anon, authenticated using (true);
create policy "staff read customers" on public.customers for select to authenticated using ((select public.is_staff()));
create policy "staff read orders" on public.orders for select to authenticated using ((select public.is_staff()));
create policy "staff read batch records" on public.batch_records for select to authenticated using ((select public.is_staff()));
create policy "staff write batch records" on public.batch_records for insert to authenticated with check ((select public.is_staff()));
create policy "staff update batch records" on public.batch_records for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff read sms" on public.sms_log for select to authenticated using ((select public.is_staff()));
create policy "staff see themselves" on public.staff for select to authenticated using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.orders, public.sms_log;

-- ---------------------------------------------------------------- helpers

-- Pre-orders for a Saturday close at 18:00 Accra time on the Thursday before.
create function public.batch_cutoff(d date) returns timestamptz
language sql immutable set search_path = '' as $$
  select ((d - 2)::timestamp + interval '18 hours') at time zone 'Africa/Accra'
$$;

create function public.batch_is_open(d date) returns boolean
language sql stable set search_path = '' as $$
  select extract(isodow from d) = 6 and now() < public.batch_cutoff(d) and d <= current_date + 28
$$;

create function public.sms_text(kind text, order_number int, d date, bottles int) returns text
language plpgsql stable set search_path = '' as $$
declare
  no text := '#' || lpad(order_number::text, 4, '0');
  day text := to_char(d, 'Dy FMDD Mon');
  closes text := to_char(public.batch_cutoff(d) at time zone 'Africa/Accra', 'Dy FMHH12am');
begin
  return case kind
    when 'received' then format('GoodCane: Order %s received for %s (%s bottle%s). We''ll text you when it''s confirmed.', no, day, bottles, case when bottles = 1 then '' else 's' end)
    when 'confirmed' then format('GoodCane: Order %s is confirmed for %s. We''ll be in touch about payment.', no, day)
    when 'paid' then format('GoodCane: Payment received for order %s. See you on %s.', no, day)
    when 'fulfilled' then format('GoodCane: Order %s is done. Enjoy! You can order again any time before %s.', no, closes)
    when 'cancelled' then format('GoodCane: Order %s has been cancelled. Nothing is owed.', no)
    when 'reminder' then format('GoodCane: Orders for %s close %s. Want your usual? Reply STOP to opt out.', day, closes)
  end;
end
$$;

create function public.order_json(o public.orders) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id, 'number', o.number, 'viewToken', o.view_token, 'customerId', o.customer_id,
    'batchId', o.batch_date, 'lines', o.lines, 'fulfilment', o.fulfilment, 'location', o.location,
    'note', o.note, 'status', o.status, 'history', o.history, 'source', o.source,
    'reorderOf', o.reorder_of, 'createdAt', o.created_at, 'sample', o.is_sample)
$$;

create function public.sms_json(m public.sms_log) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', m.id, 'customerId', m.customer_id, 'orderId', m.order_id, 'batchId', m.batch_date,
    'kind', m.kind, 'to', m.to_phone, 'body', m.body, 'status', m.status, 'error', m.error, 'at', m.created_at)
$$;

-- Hands a text to Arkesel through pg_net and logs it. Delivery results come
-- back asynchronously; refresh_sms_status() picks them up.
create function public.send_text(p_phone text, p_body text, p_kind text, p_customer uuid, p_order uuid, p_batch date, p_log_body text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  api_key text;
  live boolean;
  sender text;
  req bigint;
begin
  select value = 'true' into live from public.settings where key = 'sms_live';
  select value into sender from public.settings where key = 'sms_sender';
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'arkesel_api_key';

  if p_phone is null or p_phone !~ '^0[2-5][0-9]{8}$' then
    insert into public.sms_log (customer_id, order_id, batch_date, kind, to_phone, body, status, error)
    values (p_customer, p_order, p_batch, p_kind, coalesce(p_phone, ''), coalesce(p_log_body, p_body), 'skipped', 'Not a mobile number');
    return;
  end if;
  if not coalesce(live, false) or api_key is null then
    insert into public.sms_log (customer_id, order_id, batch_date, kind, to_phone, body, status, error)
    values (p_customer, p_order, p_batch, p_kind, p_phone, coalesce(p_log_body, p_body), 'skipped', 'SMS not configured');
    return;
  end if;

  select net.http_post(
    url := 'https://sms.arkesel.com/api/v2/sms/send',
    body := jsonb_build_object('sender', coalesce(sender, 'GoodCane'), 'message', p_body, 'recipients', jsonb_build_array('233' || substr(p_phone, 2))),
    headers := jsonb_build_object('api-key', api_key, 'Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  ) into req;

  insert into public.sms_log (customer_id, order_id, batch_date, kind, to_phone, body, status, request_id)
  values (p_customer, p_order, p_batch, p_kind, p_phone, coalesce(p_log_body, p_body), 'queued', req);
end
$$;

create function public.notify_order(p_order uuid, p_kind text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  c public.customers;
  n int;
begin
  select * into o from public.orders where id = p_order;
  select * into c from public.customers where id = o.customer_id;
  select coalesce(sum((l ->> 'qty')::int), 0) into n from jsonb_array_elements(o.lines) l;
  perform public.send_text(c.phone, public.sms_text(p_kind, o.number, o.batch_date, n), p_kind, c.id, o.id, o.batch_date);
end
$$;

create function public.refresh_sms_status() returns void
language sql security definer set search_path = '' as $$
  update public.sms_log m
  set status = case when r.status_code between 200 and 299 and coalesce(r.content::jsonb ->> 'status', '') = 'success' then 'sent' else 'failed' end,
      error = case when r.status_code between 200 and 299 and coalesce(r.content::jsonb ->> 'status', '') = 'success' then null
                   else coalesce(left(r.content::jsonb ->> 'message', 200), r.error_msg, 'HTTP ' || r.status_code) end
  from net._http_response r
  where m.status = 'queued' and m.request_id = r.id
$$;

-- ---------------------------------------------------------------- customer API

create function public.place_order(
  p_name text, p_phone text, p_batch date, p_lines jsonb, p_fulfilment text, p_location text,
  p_note text, p_reminders boolean, p_source text, p_reorder_of uuid, p_token uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.customers;
  o public.orders;
  l jsonb;
  total int := 0;
  clean jsonb := '[]';
  owns boolean;
begin
  p_name := btrim(p_name);
  p_phone := regexp_replace(p_phone, '\D', '', 'g');
  if p_phone ~ '^233[0-9]{9}$' then p_phone := '0' || substr(p_phone, 4); end if;

  if char_length(p_name) not between 2 and 60 then raise exception 'Please enter your name.'; end if;
  if p_phone !~ '^0[2-5][0-9]{8}$' then raise exception 'Please enter a 10-digit mobile number.'; end if;
  if not public.batch_is_open(p_batch) then raise exception 'Orders for that day have closed.'; end if;
  if p_fulfilment not in ('pickup', 'delivery') then raise exception 'Choose pickup or delivery.'; end if;
  if p_location not in ('GoodCane shop · Aviation Road, Adenta', 'Pickup point B (sample)', 'Delivery area 1 (sample)', 'Delivery area 2 (sample)', 'Delivery area 3 (sample)') then
    raise exception 'Choose a pickup point or area.';
  end if;
  if p_source not in ('tiktok', 'instagram', 'whatsapp', 'direct', 'reorder', 'reminder') then p_source := 'direct'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Add at least one bottle.'; end if;

  for l in select * from jsonb_array_elements(p_lines) loop
    if not exists (select 1 from public.products where id = l ->> 'productId' and active) then raise exception 'Unknown juice.'; end if;
    if (l ->> 'qty') !~ '^[0-9]+$' or (l ->> 'qty')::int not between 1 and 24 then raise exception 'Up to 24 bottles of each juice.'; end if;
    total := total + (l ->> 'qty')::int;
    clean := clean || jsonb_build_array(jsonb_build_object('productId', l ->> 'productId', 'qty', (l ->> 'qty')::int));
  end loop;
  if total > 60 then raise exception 'For more than 60 bottles, please call us.'; end if;

  select * into c from public.customers where phone = p_phone;
  if found then
    if (select count(*) from public.orders where customer_id = c.id and created_at > now() - interval '1 hour') >= 5 then
      raise exception 'Too many orders from this number. Please try again later.';
    end if;
    owns := p_token is not null and p_token = c.access_token;
    -- Only the verified owner may change the saved name and reminder choice.
    if owns then
      update public.customers set name = p_name, reminders_opt_in = p_reminders where id = c.id returning * into c;
    elsif p_reminders and not c.reminders_opt_in then
      update public.customers set reminders_opt_in = true where id = c.id returning * into c;
    end if;
  else
    insert into public.customers (name, phone, reminders_opt_in) values (p_name, p_phone, p_reminders) returning * into c;
    owns := true;
  end if;

  if p_reorder_of is not null and not exists (select 1 from public.orders where id = p_reorder_of and customer_id = c.id) then
    p_reorder_of := null;
  end if;

  insert into public.orders (customer_id, batch_date, lines, fulfilment, location, note, history, source, reorder_of)
  values (c.id, p_batch, clean, p_fulfilment, p_location, nullif(btrim(left(p_note, 140)), ''),
          jsonb_build_array(jsonb_build_object('status', 'requested', 'at', now(), 'by', 'customer')), p_source, p_reorder_of)
  returning * into o;

  perform public.notify_order(o.id, 'received');

  return jsonb_build_object(
    'order', public.order_json(o),
    'token', case when owns then c.access_token end,
    'sms', (select public.sms_json(m) from public.sms_log m where m.order_id = o.id order by created_at desc limit 1));
end
$$;

create function public.my_account(p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.customers;
begin
  select * into c from public.customers where access_token = p_token and phone is not null;
  if not found then return null; end if;
  perform public.refresh_sms_status();
  return jsonb_build_object(
    'customer', jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'remindersOptIn', c.reminders_opt_in),
    'orders', coalesce((select jsonb_agg(public.order_json(o) order by o.created_at desc) from public.orders o where o.customer_id = c.id), '[]'),
    'sms', coalesce((select jsonb_agg(public.sms_json(m) order by m.created_at) from public.sms_log m where m.customer_id = c.id and m.kind <> 'login_code'), '[]'));
end
$$;

create function public.order_by_view_token(p_view_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where view_token = p_view_token;
  if not found then return null; end if;
  perform public.refresh_sms_status();
  return jsonb_build_object(
    'order', public.order_json(o),
    'sms', coalesce((select jsonb_agg(public.sms_json(m) order by m.created_at) from public.sms_log m where m.order_id = o.id), '[]'));
end
$$;

-- Either the account token or the order's own view token proves ownership.
create function public.cancel_order(p_order uuid, p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select o2.* into o from public.orders o2 join public.customers c on c.id = o2.customer_id
  where o2.id = p_order and (c.access_token = p_token or o2.view_token = p_token);
  if not found then raise exception 'Order not found.'; end if;
  if o.status not in ('requested', 'confirmed') then raise exception 'This order can''t be cancelled online. Please call us.'; end if;
  if not public.batch_is_open(o.batch_date) then raise exception 'Orders for that day have closed. Please call us.'; end if;
  update public.orders set status = 'cancelled',
    history = history || jsonb_build_array(jsonb_build_object('status', 'cancelled', 'at', now(), 'by', 'customer', 'note', 'Cancelled by customer'))
  where id = o.id returning * into o;
  perform public.notify_order(o.id, 'cancelled');
  return public.order_json(o);
end
$$;

create function public.set_reminders(p_token uuid, p_on boolean) returns void
language sql security definer set search_path = '' as $$
  update public.customers set reminders_opt_in = p_on where access_token = p_token
$$;

create function public.forget_me(p_token uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.customers;
begin
  select * into c from public.customers where access_token = p_token;
  if not found then return; end if;
  update public.orders set status = 'cancelled',
    history = history || jsonb_build_array(jsonb_build_object('status', 'cancelled', 'at', now(), 'by', 'customer', 'note', 'Customer removed their details'))
  where customer_id = c.id and status in ('requested', 'confirmed') and public.batch_is_open(batch_date);
  update public.orders set note = null where customer_id = c.id;
  update public.customers set name = 'Removed customer', phone = null, reminders_opt_in = false, access_token = gen_random_uuid() where id = c.id;
  update public.sms_log set to_phone = '' where customer_id = c.id;
end
$$;

-- Sign-in for "My orders" on a new phone: a 6-digit code by SMS.
create function public.request_login_code(p_phone text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  code text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  lc public.login_codes;
begin
  p_phone := regexp_replace(p_phone, '\D', '', 'g');
  if p_phone ~ '^233[0-9]{9}$' then p_phone := '0' || substr(p_phone, 4); end if;
  if p_phone !~ '^0[2-5][0-9]{8}$' then raise exception 'Please enter a 10-digit mobile number.'; end if;
  if not exists (select 1 from public.customers where phone = p_phone) then return; end if;

  select * into lc from public.login_codes where phone = p_phone;
  if found and lc.window_start > now() - interval '15 minutes' and lc.sent_in_window >= 3 then
    raise exception 'Too many codes requested. Please wait a few minutes.';
  end if;

  insert into public.login_codes (phone, code_hash, expires_at, attempts, sent_in_window, window_start)
  values (p_phone, extensions.crypt(code, extensions.gen_salt('bf')), now() + interval '10 minutes', 0, 1, now())
  on conflict (phone) do update set
    code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0,
    sent_in_window = case when public.login_codes.window_start > now() - interval '15 minutes' then public.login_codes.sent_in_window + 1 else 1 end,
    window_start = case when public.login_codes.window_start > now() - interval '15 minutes' then public.login_codes.window_start else now() end;

  perform public.send_text(p_phone, format('GoodCane: Your code is %s. It expires in 10 minutes.', code), 'login_code',
    (select id from public.customers where phone = p_phone), null, null, 'GoodCane: Your code is ••••••.');
end
$$;

create function public.verify_login_code(p_phone text, p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare lc public.login_codes;
begin
  p_phone := regexp_replace(p_phone, '\D', '', 'g');
  if p_phone ~ '^233[0-9]{9}$' then p_phone := '0' || substr(p_phone, 4); end if;
  select * into lc from public.login_codes where phone = p_phone;
  if not found or lc.expires_at < now() or lc.attempts >= 5 then raise exception 'That code has expired. Request a new one.'; end if;
  if extensions.crypt(btrim(p_code), lc.code_hash) <> lc.code_hash then
    update public.login_codes set attempts = attempts + 1 where phone = p_phone;
    raise exception 'That code isn''t right.';
  end if;
  delete from public.login_codes where phone = p_phone;
  return (select access_token from public.customers where phone = p_phone);
end
$$;

-- ---------------------------------------------------------------- staff API

create function public.staff_set_status(p_order uuid, p_status text, p_note text, p_notify boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  allowed text[];
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found.'; end if;
  allowed := case o.status
    when 'requested' then array['confirmed', 'cancelled']
    when 'confirmed' then array['paid', 'cancelled']
    when 'paid' then array['fulfilled', 'cancelled']
    else array[]::text[] end;
  if not p_status = any(allowed) then raise exception 'Can''t move order from % to %.', o.status, p_status; end if;
  update public.orders set status = p_status,
    history = history || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('status', p_status, 'at', now(), 'by', 'business', 'note', nullif(btrim(p_note), ''))))
  where id = o.id returning * into o;
  if p_notify then perform public.notify_order(o.id, p_status); end if;
  return public.order_json(o);
end
$$;

create function public.staff_send_reminders(p_batch date) returns int
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  n int := 0;
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  if not public.batch_is_open(p_batch) then raise exception 'That batch has closed.'; end if;
  for c in
    select cu.* from public.customers cu
    where cu.reminders_opt_in and cu.phone is not null
      and exists (select 1 from public.orders o where o.customer_id = cu.id and o.status in ('confirmed', 'paid', 'fulfilled'))
      and not exists (select 1 from public.orders o where o.customer_id = cu.id and o.batch_date = p_batch and o.status <> 'cancelled')
      and not exists (select 1 from public.sms_log m where m.customer_id = cu.id and m.kind = 'reminder' and m.batch_date = p_batch)
  loop
    if c.is_sample then
      insert into public.sms_log (customer_id, batch_date, kind, to_phone, body, status, error)
      values (c.id, p_batch, 'reminder', c.phone, public.sms_text('reminder', 0, p_batch, 0), 'skipped', 'Sample customer');
    else
      perform public.send_text(c.phone, public.sms_text('reminder', 0, p_batch, 0), 'reminder', c.id, null, p_batch);
    end if;
    n := n + 1;
  end loop;
  return n;
end
$$;

create function public.staff_refresh_sms() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  perform public.refresh_sms_status();
end
$$;

-- ---------------------------------------------------------------- grants

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.batch_cutoff(date), public.batch_is_open(date) to anon, authenticated;
grant execute on function public.place_order(text, text, date, jsonb, text, text, text, boolean, text, uuid, uuid) to anon, authenticated;
grant execute on function public.my_account(uuid), public.order_by_view_token(uuid), public.cancel_order(uuid, uuid),
  public.set_reminders(uuid, boolean), public.forget_me(uuid), public.request_login_code(text), public.verify_login_code(text, text) to anon, authenticated;
grant execute on function public.staff_set_status(uuid, text, text, boolean), public.staff_send_reminders(date), public.staff_refresh_sms() to authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
