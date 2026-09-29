-- Run only after the deployed order form uses reserve_scoutcard_order_with_consent.
-- The original function is retained for historical migrations, but may no
-- longer be called from a browser session without order acknowledgments.
revoke all on function public.reserve_scoutcard_order(uuid,text,text,text)
  from public, anon, authenticated;
notify pgrst, 'reload schema';
