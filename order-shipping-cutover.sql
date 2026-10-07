-- Run after the production site uses the email-only checkout RPC.
-- Prevent old browser clients from sending shipping details to our database before payment.
begin;
revoke all on function public.reserve_scoutcard_order_with_consent(uuid,text,text,text,boolean,boolean)
  from public, anon, authenticated;
notify pgrst,'reload schema';
commit;
