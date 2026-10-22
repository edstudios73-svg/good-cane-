-- Start fresh: removes every order, customer, text and batch record.
-- Staff logins, settings, the SasuSync key and the menu are kept.
begin;
delete from public.sms_log;
delete from public.login_codes;
delete from public.orders;
delete from public.customers;
delete from public.batch_records;
alter sequence public.order_number_seq restart with 1;
commit;
