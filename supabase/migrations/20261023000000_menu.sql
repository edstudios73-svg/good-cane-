-- Staff manage the menu: prices, new juices, photos and what's on sale.
-- Prices are entered by GoodCane in the dashboard; none are set here.

alter table public.products
  add column if not exists price_pesewas int check (price_pesewas is null or price_pesewas between 0 and 1000000),
  add column if not exists size text not null default '500 ml',
  add column if not exists taste text not null default 'Pure' check (taste in ('Sour', 'Sweet', 'Zesty', 'Creamy', 'Pure')),
  add column if not exists about text not null default '',
  add column if not exists ingredients text not null default '',
  add column if not exists accent text not null default '#2d753e' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists photo_url text,
  add column if not exists updated_at timestamptz not null default now();

update public.products set taste = v.taste, ingredients = v.ing, accent = v.accent
from (values
  ('mint-lemon', 'Sour', 'Mint · Lemon · Sugarcane', '#2d753e'),
  ('passion', 'Sweet', 'Passion fruit · Sugarcane', '#6f35a3'),
  ('lemon-ginger', 'Zesty', 'Lemon · Ginger · Sugarcane', '#c0603a'),
  ('tigernut-coconut', 'Creamy', 'Tigernut · Coconut · Sugarcane', '#6f665e'),
  ('raw', 'Pure', '100% sugarcane', '#7f8a2e')
) as v(id, taste, ing, accent)
where products.id = v.id and products.ingredients = '';

create or replace function public.place_order(
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
  -- Pickup is at the shop; for delivery the customer types their area and GoodCane calls to confirm.
  p_location := btrim(regexp_replace(coalesce(p_location, ''), '\s+', ' ', 'g'));
  if p_fulfilment = 'pickup' and p_location <> 'GoodCane shop · Aviation Road, Adenta' then raise exception 'Choose where you''ll pick up.'; end if;
  if p_fulfilment = 'delivery' and char_length(p_location) not between 2 and 60 then raise exception 'Tell us your area.'; end if;
  if p_source not in ('tiktok', 'instagram', 'whatsapp', 'direct', 'reorder', 'reminder') then p_source := 'direct'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Add at least one bottle.'; end if;

  for l in select * from jsonb_array_elements(p_lines) loop
    if not exists (select 1 from public.products where id = l ->> 'productId' and active) then raise exception 'Unknown juice.'; end if;
    if (l ->> 'qty') !~ '^[0-9]+$' or (l ->> 'qty')::int not between 1 and 24 then raise exception 'Up to 24 bottles of each juice.'; end if;
    total := total + (l ->> 'qty')::int;
    -- Keep the price the customer saw with the order, so later price changes don't rewrite it.
    clean := clean || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('productId', l ->> 'productId', 'qty', (l ->> 'qty')::int,
      'price', (select price_pesewas from public.products where id = l ->> 'productId'))));
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

-- Add or edit a juice. A new juice gets an id from its name.
create or replace function public.staff_save_product(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r public.products;
  pid text := nullif(p ->> 'id', '');
  price numeric := nullif(p ->> 'price', '')::numeric;
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  if char_length(btrim(coalesce(p ->> 'name', ''))) not between 2 and 60 then raise exception 'Give the juice a name.'; end if;
  if coalesce(p ->> 'taste', 'Pure') not in ('Sour', 'Sweet', 'Zesty', 'Creamy', 'Pure') then raise exception 'Pick a taste.'; end if;
  if price is not null and (price < 0 or price > 10000) then raise exception 'Enter a price in cedis, like 25 or 25.50.'; end if;

  if pid is null then
    pid := trim(both '-' from regexp_replace(lower(p ->> 'name'), '[^a-z0-9]+', '-', 'g'));
    if pid = '' then pid := 'juice'; end if;
    while exists (select 1 from public.products where id = pid) loop pid := pid || '-2'; end loop;
    insert into public.products (id, name, sort) values (pid, btrim(p ->> 'name'), (select coalesce(max(sort), 0) + 1 from public.products));
  elsif not exists (select 1 from public.products where id = pid) then
    raise exception 'That juice no longer exists.';
  end if;

  update public.products set
    name = btrim(p ->> 'name'),
    price_pesewas = case when price is null then null else round(price * 100)::int end,
    size = coalesce(nullif(btrim(p ->> 'size'), ''), '500 ml'),
    taste = coalesce(nullif(p ->> 'taste', ''), taste),
    about = left(btrim(coalesce(p ->> 'about', '')), 400),
    ingredients = left(btrim(coalesce(p ->> 'ingredients', '')), 120),
    accent = coalesce(nullif(p ->> 'accent', ''), accent),
    photo_url = case when p ? 'photoUrl' then nullif(p ->> 'photoUrl', '') else photo_url end,
    active = coalesce((p ->> 'active')::boolean, active),
    updated_at = now()
  where id = pid
  returning * into r;
  return to_jsonb(r);
end
$$;

revoke execute on function public.staff_save_product(jsonb) from public, anon;
grant execute on function public.staff_save_product(jsonb) to authenticated;

-- Photos for new juices. Anyone can view; only staff can upload.
insert into storage.buckets (id, name, public) values ('product-photos', 'product-photos', true) on conflict (id) do nothing;
drop policy if exists "staff upload product photos" on storage.objects;
create policy "staff upload product photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-photos' and (select public.is_staff()));
drop policy if exists "staff replace product photos" on storage.objects;
create policy "staff replace product photos" on storage.objects for update to authenticated
  using (bucket_id = 'product-photos' and (select public.is_staff()));
