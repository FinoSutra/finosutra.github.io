-- ═══════════════════════════════════════════════════════════════════════════════
-- FINOSUTRA — Free-tier download quota (5 downloads / calendar month, logged-in users)
--
-- Replaces the ₹199 one-time-export paywall. Enforcement lives server-side in
-- fs_try_consume_download() (SECURITY DEFINER) so it can't be bypassed by
-- editing client JS or calling the table directly — same principle as
-- confirm-subscription verifying Razorpay payments server-side.
--
-- HOW TO DEPLOY (no CLI needed — this repo has no linked Supabase project):
--   1. Go to: https://supabase.com/dashboard/project/uymuivmktvtxmodblxie/sql/new
--   2. Paste this entire file and click "Run"
--   3. That's it — no secrets, no Edge Function deploy needed for this part.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.download_usage (
  user_id    uuid not null references auth.users(id) on delete cascade,
  month_key  text not null,              -- 'YYYY-MM', e.g. '2026-08'
  count      int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, month_key)
);

alter table public.download_usage enable row level security;

drop policy if exists "users can read own usage" on public.download_usage;
create policy "users can read own usage"
  on public.download_usage
  for select
  using (auth.uid() = user_id);

-- RLS policies alone are not enough — Postgres also requires a base table
-- grant before a role may touch the table at all (RLS only filters rows
-- once that base privilege is present). Without this, direct SELECTs from
-- the client (used to show "X/5 left" on the button) fail with 42501
-- "permission denied for table download_usage", even though the RLS policy
-- above is otherwise correct.
grant select on public.download_usage to authenticated;

-- No insert/update policy for regular users — all writes go through the
-- SECURITY DEFINER function below, which enforces the 5/month cap atomically.

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

  if v_count >= 5 then
    return query select false, 0;
  else
    update download_usage
      set count = count + 1, updated_at = now()
      where user_id = v_uid and month_key = v_month;
    return query select true, (5 - (v_count + 1));
  end if;
end;
$$;

grant execute on function public.fs_try_consume_download() to authenticated;
