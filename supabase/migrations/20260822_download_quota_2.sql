-- ═══════════════════════════════════════════════════════════════════════════════
-- FINOSUTRA — Lower free-tier download quota from 5/month to 2/month
--
-- Replaces the cap in fs_try_consume_download() (defined in
-- 20260821_download_usage.sql). Table/RLS/grants from that migration are
-- untouched — this only redefines the function body with a new cap.
--
-- HOW TO DEPLOY:
--   1. Go to: https://supabase.com/dashboard/project/uymuivmktvtxmodblxie/sql/new
--   2. Paste this entire file and click "Run"
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace function public.fs_try_consume_download()
returns table(allowed boolean, remaining int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
  v_count int;
  v_uid   uuid := auth.uid();
  v_cap   int := 2;
begin
  if v_uid is null then
    return query select false, 0;
    return;
  end if;

  insert into download_usage (user_id, month_key, count)
  values (v_uid, v_month, 0)
  on conflict (user_id, month_key) do nothing;

  select count into v_count
    from download_usage
    where user_id = v_uid and month_key = v_month
    for update;

  if v_count >= v_cap then
    return query select false, 0;
  else
    update download_usage
      set count = count + 1, updated_at = now()
      where user_id = v_uid and month_key = v_month;
    return query select true, (v_cap - (v_count + 1));
  end if;
end;
$$;

grant execute on function public.fs_try_consume_download() to authenticated;
