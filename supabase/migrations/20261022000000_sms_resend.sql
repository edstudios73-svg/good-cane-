-- SasuSync returns data.task_id on live sends and data.job_id in the sandbox.
create or replace function public.refresh_sms_status() returns void
language sql security definer set search_path = '' as $$
  update public.sms_log m
  set status = case when ok then 'sent' else 'failed' end,
      provider_ref = coalesce(j -> 'data' ->> 'task_id', j -> 'data' ->> 'job_id'),
      error = case when ok then null else coalesce(left(j ->> 'detail', 200), left(r.error_msg, 200), 'HTTP ' || r.status_code) end
  from net._http_response r,
       lateral (select public.safe_jsonb(r.content) as j) parsed,
       lateral (select r.status_code between 200 and 299 and coalesce((j ->> 'success')::boolean, false) as ok) outcome
  where m.status = 'queued' and m.request_id = r.id
$$;

-- Staff can send a failed text again, e.g. after topping up SMS credit.
-- Sign-in codes are never resent (the code itself isn't stored).
create function public.staff_resend_sms(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.sms_log;
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  select * into m from public.sms_log where id = p_id;
  if not found then raise exception 'Message not found.'; end if;
  if m.kind = 'login_code' then raise exception 'Sign-in codes can''t be resent. Ask the customer to request a new one.'; end if;
  if m.status not in ('failed', 'skipped') then raise exception 'Only failed messages can be resent.'; end if;
  if m.to_phone = '' then raise exception 'This customer removed their number.'; end if;
  perform public.send_text(m.to_phone, m.body, m.kind, m.customer_id, m.order_id, m.batch_date);
end
$$;

revoke execute on function public.staff_resend_sms(uuid) from public, anon;
grant execute on function public.staff_resend_sms(uuid) to authenticated;
