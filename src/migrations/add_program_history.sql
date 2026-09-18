-- ============================================================================
-- HISTORY FEATURE: auto-archive a program 7 days after it happens
-- ============================================================================
-- What this does, in plain terms:
--   1. Once a program's date is more than 7 days in the past, its summary
--      (name, date, how many clients joined, how much was collected) is
--      copied into `program_history`.
--   2. Every payment record tied to that program is deleted.
--   3. Any client left with NO payments anywhere (i.e. they were only ever
--      in this one program) is deleted too.
--   4. The program itself is removed from `programs`, since it's done.
--   5. A daily scheduled job (pg_cron) runs this automatically — nobody has
--      to log in or click anything for it to happen.

-- 1. Where the history lives -------------------------------------------------
create table if not exists program_history (
  id uuid primary key default gen_random_uuid(),
  program_name text not null,
  program_date date not null,
  total_clients int not null default 0,
  total_amount numeric not null default 0,
  archived_at timestamptz not null default now()
);

alter table program_history enable row level security;

create policy "program_history readable by authenticated admins"
  on program_history for select
  using (auth.role() = 'authenticated');

-- 2. The archiving function ---------------------------------------------------
-- security definer: runs with elevated rights so it can delete across
-- tables regardless of which role calls it (the cron job runs as postgres;
-- an admin manually triggering it only has their normal authenticated role).
create or replace function archive_completed_programs()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  prog record;
  v_total_clients int;
  v_total_amount numeric;
  v_archived_count int := 0;
begin
  for prog in
    select id, name, date
    from programs
    where date is not null
      and date <= (now() - interval '7 days')
  loop
    select
      count(distinct client_id),
      coalesce(sum(amount) filter (where status = 'paid'), 0)
    into v_total_clients, v_total_amount
    from payments
    where program_id = prog.id;

    insert into program_history (program_name, program_date, total_clients, total_amount)
    values (prog.name, prog.date, v_total_clients, v_total_amount);

    delete from payments where program_id = prog.id;

    -- Only remove clients who now have zero payments left anywhere —
    -- someone registered for two programs at once keeps their record.
    delete from clients c
    where not exists (select 1 from payments p where p.client_id = c.id);

    delete from programs where id = prog.id;

    v_archived_count := v_archived_count + 1;
  end loop;

  return v_archived_count;
end;
$$;

-- Only logged-in admins (or the cron job, which bypasses grants entirely)
-- can invoke this — not the public.
revoke all on function archive_completed_programs() from public;
grant execute on function archive_completed_programs() to authenticated;

-- 3. The daily schedule --------------------------------------------------------
-- Requires the pg_cron extension. In the Supabase dashboard:
--   Database → Extensions → search "pg_cron" → Enable
-- Then run the two statements below (only once).
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'archive-completed-programs-daily',
  '0 2 * * *',  -- every day at 02:00 UTC
  $$select archive_completed_programs();$$
);
