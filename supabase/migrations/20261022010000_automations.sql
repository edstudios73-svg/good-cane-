-- Scheduled texts. pg_cron runs these in UTC, which is Accra time.
--   Thursday 09:00  last-call reminder to opted-in regulars who haven't ordered
--   Saturday 07:00  "ready today" text for every confirmed order
--   Daily    20:00  summary to the staff phone in settings
-- Each can be switched off in the staff dashboard (settings table).

create extension if not exists pg_cron;

alter table public.sms_log drop constraint if exists sms_log_kind_check;
alter table public.sms_log add constraint sms_log_kind_check
  check (kind in ('received', 'confirmed', 'paid', 'fulfilled', 'cancelled', 'reminder', 'login_code', 'pickup_day', 'daily_summary'));

insert into public.settings (key, value) values
  ('auto_reminder', 'true'),
  ('auto_pickup_day', 'true'),
  ('auto_daily_summary', 'true'),
  ('staff_phone', '')
on conflict (key) do nothing;

create or replace function public.setting_on(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select value = 'true' from public.settings where key = p_key), false)
$$;

-- Shared by the staff button and the Thursday job.
create or replace function public.send_reminders_for(p_batch date) returns int
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  n int := 0;
begin
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

create or replace function public.staff_send_reminders(p_batch date) returns int
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  if not public.batch_is_open(p_batch) then raise exception 'That batch has closed.'; end if;
  return public.send_reminders_for(p_batch);
end
$$;

create or replace function public.cron_last_call() returns int
language plpgsql security definer set search_path = '' as $$
declare d date := current_date + 2;  -- runs on Thursday; the batch is Saturday
begin
  if not public.setting_on('auto_reminder') or not public.batch_is_open(d) then return 0; end if;
  return public.send_reminders_for(d);
end
$$;

create or replace function public.cron_pickup_day() returns int
language plpgsql security definer set search_path = '' as $$
declare
  o record;
  n int := 0;
  body text;
begin
  if not public.setting_on('auto_pickup_day') then return 0; end if;
  for o in
    select od.*, cu.name, cu.phone, cu.is_sample,
           (select coalesce(sum((l ->> 'qty')::int), 0) from jsonb_array_elements(od.lines) l) as n_bottles
    from public.orders od join public.customers cu on cu.id = od.customer_id
    where od.batch_date = current_date and od.status in ('confirmed', 'paid') and cu.phone is not null and not cu.is_sample
      and not exists (select 1 from public.sms_log m where m.order_id = od.id and m.kind = 'pickup_day')
  loop
    body := format('GoodCane: Good morning %s! Order %s (%s bottle%s) is pressed and ready today. %s',
      split_part(o.name, ' ', 1), '#' || lpad(o.number::text, 4, '0'), o.n_bottles, case when o.n_bottles = 1 then '' else 's' end,
      case when o.fulfilment = 'pickup' then 'Collect at ' || replace(o.location, ' · ', ', ') || '.' else 'We''ll bring it to you.' end);
    perform public.send_text(o.phone, left(body, 160), 'pickup_day', o.customer_id, o.id, o.batch_date);
    n := n + 1;
  end loop;
  return n;
end
$$;

create or replace function public.daily_summary_text(p_day date) returns text
language sql stable security definer set search_path = '' as $$
  with nb as (
    select min(d)::date as d from generate_series(p_day, p_day + 7, '1 day') d where extract(isodow from d) = 6
  ), today as (
    select count(*) as n, coalesce(sum((select sum((l ->> 'qty')::int) from jsonb_array_elements(o.lines) l)), 0) as b
    from public.orders o where not o.is_sample and o.created_at >= p_day and o.created_at < p_day + 1
  ), batch as (
    select
      coalesce(sum((select sum((l ->> 'qty')::int) from jsonb_array_elements(o.lines) l)) filter (where o.status in ('confirmed', 'paid', 'fulfilled')), 0) as firm,
      count(*) filter (where o.status = 'requested') as waiting
    from public.orders o, nb where o.batch_date = nb.d and not o.is_sample
  )
  select format('GoodCane today: %s new order%s (%s bottles). %s: %s bottles confirmed, %s order%s to confirm.',
    today.n, case when today.n = 1 then '' else 's' end, today.b,
    to_char(nb.d, 'Dy FMDD Mon'), batch.firm, batch.waiting, case when batch.waiting = 1 then '' else 's' end)
  from today, batch, nb
$$;

create or replace function public.cron_daily_summary() returns int
language plpgsql security definer set search_path = '' as $$
declare phone text;
begin
  select value into phone from public.settings where key = 'staff_phone';
  if not public.setting_on('auto_daily_summary') or coalesce(phone, '') !~ '^0[2-5][0-9]{8}$' then return 0; end if;
  if exists (select 1 from public.sms_log where kind = 'daily_summary' and created_at::date = current_date) then return 0; end if;
  perform public.send_text(phone, public.daily_summary_text(current_date), 'daily_summary', null, null, null);
  return 1;
end
$$;

-- Staff read and change the automation switches and the summary phone.
create or replace function public.staff_settings() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  return (select jsonb_object_agg(key, value) from public.settings
          where key in ('auto_reminder', 'auto_pickup_day', 'auto_daily_summary', 'staff_phone', 'sms_live', 'sms_sender'));
end
$$;

create or replace function public.staff_set_setting(p_key text, p_value text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  if p_key in ('auto_reminder', 'auto_pickup_day', 'auto_daily_summary', 'sms_live') then
    if p_value not in ('true', 'false') then raise exception 'Use true or false.'; end if;
  elsif p_key = 'staff_phone' then
    p_value := regexp_replace(coalesce(p_value, ''), '\D', '', 'g');
    if p_value ~ '^233[0-9]{9}$' then p_value := '0' || substr(p_value, 4); end if;
    if p_value <> '' and p_value !~ '^0[2-5][0-9]{8}$' then raise exception 'Enter a 10-digit mobile number.'; end if;
  else
    raise exception 'That setting can''t be changed here.';
  end if;
  update public.settings set value = p_value where key = p_key;
end
$$;

-- Send today's summary now (the dashboard's "Send me today's summary" button).
create or replace function public.staff_send_summary_now() returns void
language plpgsql security definer set search_path = '' as $$
declare phone text;
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  select value into phone from public.settings where key = 'staff_phone';
  if coalesce(phone, '') !~ '^0[2-5][0-9]{8}$' then raise exception 'Add your phone number first.'; end if;
  perform public.send_text(phone, public.daily_summary_text(current_date), 'daily_summary', null, null, null);
end
$$;

revoke execute on function public.setting_on(text), public.send_reminders_for(date), public.cron_last_call(), public.cron_pickup_day(),
  public.daily_summary_text(date), public.cron_daily_summary() from public, anon, authenticated;
revoke execute on function public.staff_settings(), public.staff_set_setting(text, text), public.staff_send_summary_now() from public, anon;
grant execute on function public.staff_settings(), public.staff_set_setting(text, text), public.staff_send_summary_now() to authenticated;

select cron.schedule('goodcane-last-call', '0 9 * * 4', $$select public.cron_last_call()$$);
select cron.schedule('goodcane-pickup-day', '0 7 * * 6', $$select public.cron_pickup_day()$$);
select cron.schedule('goodcane-daily-summary', '0 20 * * *', $$select public.cron_daily_summary()$$);
-- Pick up SasuSync's answers every minute so the dashboard shows sent/failed promptly.
select cron.schedule('goodcane-sms-status', '* * * * *', $$select public.refresh_sms_status()$$);

-- Public, aggregate only: how many bottles are already reserved for a batch.
create or replace function public.batch_reserved(d date) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(sum((l ->> 'qty')::int), 0)::int
  from public.orders o, jsonb_array_elements(o.lines) l
  where o.batch_date = d and o.status <> 'cancelled' and not o.is_sample
$$;
grant execute on function public.batch_reserved(date) to anon, authenticated;
