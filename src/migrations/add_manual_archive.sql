-- Adds the ability to archive ONE program immediately (used when an admin
-- manually marks a program "Done" on the Programs page), instead of only
-- waiting for the daily 7-day auto-archive.
--
-- Run this AFTER add_program_history.sql has already been run successfully.

-- Shared logic, used by both the manual "mark done" action and the daily
-- auto-archive loop, so there's exactly one place that defines what
-- "archiving a program" means.
create or replace function archive_one_program(p_program_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prog record;
  v_total_clients int;
  v_total_amount numeric;
begin
  select id, name, date into prog from programs where id = p_program_id;
  if not found then
    return;
  end if;

  select
    count(distinct client_id),
    coalesce(sum(amount) filter (where status = 'paid'), 0)
  into v_total_clients, v_total_amount
  from payments
  where program_id = prog.id;

  insert into program_history (program_name, program_date, total_clients, total_amount)
  values (prog.name, coalesce(prog.date, current_date), v_total_clients, v_total_amount);

  delete from payments where program_id = prog.id;

  delete from clients c
  where not exists (select 1 from payments p where p.client_id = c.id);

  delete from programs where id = prog.id;
end;
$$;

revoke all on function archive_one_program(uuid) from public;
grant execute on function archive_one_program(uuid) to authenticated;

-- Re-point the daily auto-archive loop at the same shared logic, so both
-- paths stay in sync going forward.
create or replace function archive_completed_programs()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  prog record;
  v_archived_count int := 0;
begin
  for prog in
    select id
    from programs
    where date is not null
      and date <= (now() - interval '7 days')
  loop
    perform archive_one_program(prog.id);
    v_archived_count := v_archived_count + 1;
  end loop;

  return v_archived_count;
end;
$$;

-- The manual trigger — this is what "mark as done" calls from the app.
-- Same security-definer treatment as the others, so it can delete across
-- tables regardless of the calling admin's own row-level permissions.
create or replace function admin_mark_program_done(p_program_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform archive_one_program(p_program_id);
end;
$$;

revoke all on function admin_mark_program_done(uuid) from public;
grant execute on function admin_mark_program_done(uuid) to authenticated;
