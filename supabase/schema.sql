
create table public.admins (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  username text not null unique,
  email text not null,
  role text not null default 'admin' check (role in ('admin', 'super_admin')),
  created_by uuid references public.admins (id),
  created_at timestamptz not null default now()
);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(12, 2) not null default 0,
  duration text,
  is_active boolean not null default true,
  created_by uuid references public.admins (id),
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  added_by uuid references public.admins (id),
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete cascade,
  program_id uuid references public.programs (id),
  amount numeric(12, 2) not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue')),
  due_date date,
  paid_at timestamptz,
  recorded_by uuid references public.admins (id),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.admins (id),
  action_type text not null,
  target_table text not null,
  target_id uuid,
  old_value jsonb,
  new_value jsonb,
  new_value 
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

alter table public.admins enable row level security;
alter table public.programs enable row level security;
alter table public.clients enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;

-- Any logged-in admin can see the admin list, but only a super admin can
-- change roles or remove someone. Creating a new admin happens through an
-- Edge Function using the service role key, not through this policy.
create policy "Admins can view all admins"
  on public.admins for select
  using (auth.uid() is not null);

create policy "Super admins can update admins"
  on public.admins for update
  using (exists (
    select 1 from public.admins a where a.id = auth.uid() and a.role = 'super_admin'
  ));

create policy "Super admins can delete admins"
  on public.admins for delete
  using (exists (
    select 1 from public.admins a where a.id = auth.uid() and a.role = 'super_admin'
  ));

-- Any logged-in admin can manage programs.
create policy "Admins can view programs"
  on public.programs for select
  using (auth.uid() is not null);

create policy "Admins can insert programs"
  on public.programs for insert
  with check (auth.uid() is not null);

create policy "Admins can update programs"
  on public.programs for update
  using (auth.uid() is not null);

create policy "Admins can delete programs"
  on public.programs for delete
  using (auth.uid() is not null);

-- Any logged-in admin can manage clients and payments.
create policy "Admins can view clients"
  on public.clients for select
  using (auth.uid() is not null);

create policy "Admins can insert clients"
  on public.clients for insert
  with check (auth.uid() is not null);

create policy "Admins can update clients"
  on public.clients for update
  using (auth.uid() is not null);

create policy "Admins can view payments"
  on public.payments for select
  using (auth.uid() is not null);

create policy "Admins can insert payments"
  on public.payments for insert
  with check (auth.uid() is not null);

create policy "Admins can update payments"
  on public.payments for update
  using (auth.uid() is not null);

-- Audit log is read-only from the client side. Rows are only ever written
-- by the trigger function below, which runs as security definer and
-- therefore bypasses these policies.
create policy "Admins can view audit logs"
  on public.audit_logs for select
  using (auth.uid() is not null);

-- ─────────────────────────────────────────────
-- AUDIT TRIGGER
-- Fires on every insert/update/delete on clients, payments, admins.
-- Cannot be bypassed by application code — it's enforced at the DB level.
-- ─────────────────────────────────────────────

create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action_type, target_table, target_id, old_value, new_value)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger programs_audit
  after insert or update or delete on public.programs
  for each row execute function public.log_audit_event();

create trigger clients_audit
  after insert or update or delete on public.clients
  for each row execute function public.log_audit_event();

create trigger payments_audit
  after insert or update or delete on public.payments
  for each row execute function public.log_audit_event();

create trigger admins_audit
  after insert or update or delete on public.admins
  for each row execute function public.log_audit_event();

-- ─────────────────────────────────────────────
-- BOOTSTRAP: creating your first login (username: admin)
-- ─────────────────────────────────────────────
-- The app logs admins in with a username, not an email. Supabase Auth still
-- needs an email internally — the app generates one automatically as
-- "<username>@edenplus.local" and the admin never sees or types it.
--
-- 1. Supabase dashboard -> Authentication -> Users -> Add user
--    Email:    admin@edenplus.local
--    Password: pick a dummy password, e.g. EdenPlus#2026 (change it later)
--    (Auto Confirm User: on, so no verification email is sent)
--
-- 2. Copy that user's UUID, then run:
--
-- insert into public.admins (id, name, username, email, role)
-- values ('paste-uuid-here', 'Admin', 'admin', 'admin@edenplus.local', 'super_admin');
--
-- 3. In the app's login screen, sign in with:
--    Username: admin
--    Password: (whatever you set in step 1)
--
-- Every admin added after this one goes through the app's "Add admin" flow,
-- which uses an Edge Function to create their login securely.
