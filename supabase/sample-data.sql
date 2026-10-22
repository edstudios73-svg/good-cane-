-- Sample history for the staff dashboard. Every row has is_sample = true,
-- uses a fake 00000000xx number, and is never texted.
do $$
declare
  flavours text[] := array['mint-lemon','passion','lemon-ginger','tigernut-coconut','raw'];
  places text[] := array['GoodCane shop · Aviation Road, Adenta','Pickup point B (sample)','Delivery area 1 (sample)','Delivery area 2 (sample)','Delivery area 3 (sample)'];
  next_sat date := current_date + ((6 - extract(isodow from current_date)::int + 7) % 7);
  cust uuid[] := '{}';
  c uuid;
  w int;
  i int;
  d date;
  st text;
  firm int;
begin
  perform setseed(0.24);
  if not public.batch_is_open(next_sat) then next_sat := next_sat + 7; end if;

  for i in 1..16 loop
    insert into public.customers (name, phone, reminders_opt_in, is_sample, created_at)
    values ('Sample Customer ' || lpad(i::text, 2, '0'), '00000000' || lpad(i::text, 2, '0'), i % 3 <> 0, true, now() - interval '60 days')
    returning id into c;
    cust := cust || c;
  end loop;

  -- six past Saturdays, slowly growing
  for w in 1..6 loop
    d := next_sat - 7 * (7 - w);
    for i in 1..(7 + w) loop
      continue when random() > 0.65;
      st := case when random() < 0.1 then 'cancelled' when d >= current_date then 'paid' else 'fulfilled' end;
      insert into public.orders (customer_id, batch_date, lines, fulfilment, location, status, history, source, is_sample, created_at)
      values (cust[i], d,
        jsonb_build_array(jsonb_build_object('productId', flavours[1 + (i % 5)], 'qty', 1 + floor(random() * 4)::int)),
        case when i % 2 = 0 then 'delivery' else 'pickup' end, places[1 + (i % 5)], st,
        jsonb_build_array(jsonb_build_object('status', 'requested', 'at', d - 4, 'by', 'customer'), jsonb_build_object('status', st, 'at', d - 2, 'by', 'business')),
        case when w = 1 then 'tiktok' else 'reorder' end, true, (d - 4)::timestamptz);
    end loop;
    if d < current_date then
      select coalesce(sum((l ->> 'qty')::int), 0) into firm from public.orders o, jsonb_array_elements(o.lines) l
      where o.batch_date = d and o.status <> 'cancelled' and o.is_sample;
      insert into public.batch_records (batch_date, forecast, produced, sold)
      values (d, firm + floor(random() * 5)::int - 1, firm + 4, firm + floor(random() * 4)::int)
      on conflict (batch_date) do nothing;
    end if;
  end loop;

  -- the batch that's open now: a mix of statuses
  for i in 1..7 loop
    st := (array['paid','confirmed','confirmed','requested','requested','requested','cancelled'])[i];
    insert into public.orders (customer_id, batch_date, lines, fulfilment, location, status, history, source, is_sample, created_at)
    values (cust[i * 2], next_sat,
      jsonb_build_array(jsonb_build_object('productId', flavours[1 + (i % 5)], 'qty', 1 + (i % 3)), jsonb_build_object('productId', flavours[1 + ((i + 2) % 5)], 'qty', 1)),
      'pickup', places[1], st,
      jsonb_build_array(jsonb_build_object('status', 'requested', 'at', now() - interval '1 day', 'by', 'customer')), 'reminder', true, now() - (i || ' hours')::interval);
  end loop;
end $$;
