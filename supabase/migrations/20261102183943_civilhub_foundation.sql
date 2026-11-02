-- CivilHub foundation. Apply as one transaction through Supabase migrations.
-- Auth owns passwords/sessions. Application profiles never store password hashes.
create schema if not exists civilhub_private;
revoke all on schema civilhub_private from public, anon;
grant usage on schema civilhub_private to authenticated;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index workspaces_by_owner on public.workspaces(owner_id);
create unique index unique_owner_workspace_name on public.workspaces(owner_id, lower(trim(name)));
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index members_by_user on public.workspace_members(user_id, workspace_id);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create unique index unique_company_names on public.companies(workspace_id, lower(trim(name)));
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create unique index unique_client_names on public.clients(workspace_id, lower(trim(name)));

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_number text not null check (job_number ~ '^JOB-[0-9]{4,}$'),
  company_id uuid not null,
  client_id uuid not null,
  work_type text not null check (length(trim(work_type)) between 1 and 160),
  custom_work_type text,
  price numeric(14,2) not null check (price > 0 and price < 1000000000000),
  location_address text not null check (length(trim(location_address)) between 2 and 500),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  job_date date not null,
  description text not null default '' check (length(description) <= 5000),
  status text not null default 'Active' check (status in ('Active', 'Completed', 'On hold')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (work_type <> 'Other' or nullif(trim(custom_work_type), '') is not null),
  unique (workspace_id, id), unique (workspace_id, job_number),
  foreign key (workspace_id, company_id) references public.companies(workspace_id, id),
  foreign key (workspace_id, client_id) references public.clients(workspace_id, id)
);
create index jobs_by_company_date on public.jobs(workspace_id, company_id, job_date desc);
create index jobs_by_client on public.jobs(workspace_id, client_id);
create index jobs_by_creator on public.jobs(created_by);

create table public.job_expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid not null,
  description text not null check (length(trim(description)) between 1 and 500),
  category text not null check (length(trim(category)) between 1 and 120),
  amount numeric(14,2) not null check (amount > 0 and amount < 1000000000000),
  expense_date date not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, job_id) references public.jobs(workspace_id, id) on delete cascade
);
create index expenses_by_job_date on public.job_expenses(workspace_id, job_id, expense_date);
create index expenses_by_creator on public.job_expenses(created_by);

create table public.overhead_costs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid,
  category text not null check (length(trim(category)) between 1 and 120),
  description text not null check (length(trim(description)) between 1 and 500),
  amount numeric(14,2) not null check (amount > 0 and amount < 1000000000000),
  expense_date date not null,
  is_recurring boolean not null default false,
  recurrence_frequency text check (recurrence_frequency in ('monthly', 'yearly')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_recurring or recurrence_frequency is not null),
  unique (workspace_id, id),
  foreign key (workspace_id, company_id) references public.companies(workspace_id, id)
);
create index overheads_by_period on public.overhead_costs(workspace_id, expense_date);
create index overheads_by_company on public.overhead_costs(workspace_id, company_id);
create index overheads_by_creator on public.overhead_costs(created_by);
create unique index no_duplicate_recurring_period on public.overhead_costs(
  workspace_id, coalesce(company_id::text, 'shared'), category, lower(trim(description)), recurrence_frequency,
  (extract(year from expense_date)::integer * 100 + case when recurrence_frequency = 'yearly' then 0 else extract(month from expense_date)::integer end)
) where is_recurring;

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid,
  expense_id uuid,
  overhead_id uuid,
  original_filename text not null check (length(trim(original_filename)) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size bigint not null check (file_size between 1 and 5242880),
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  check (num_nonnulls(job_id, expense_id, overhead_id) = 1),
  check (split_part(storage_path, '/', 1) = workspace_id::text),
  foreign key (workspace_id, job_id) references public.jobs(workspace_id, id) on delete cascade,
  foreign key (workspace_id, expense_id) references public.job_expenses(workspace_id, id) on delete cascade,
  foreign key (workspace_id, overhead_id) references public.overhead_costs(workspace_id, id) on delete cascade
);
create index attachments_by_job on public.attachments(workspace_id, job_id);
create index attachments_by_expense on public.attachments(workspace_id, expense_id);
create index attachments_by_overhead on public.attachments(workspace_id, overhead_id);
create index attachments_by_uploader on public.attachments(uploaded_by);

-- Helpers live outside exposed API schemas. Membership checks use caller identity.
create function civilhub_private.is_workspace_member(target uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select (select auth.uid()) is not null and exists (
  select 1 from public.workspace_members
  where workspace_id = target and user_id = (select auth.uid())
); $$;
create function civilhub_private.is_workspace_admin(target uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select (select auth.uid()) is not null and exists (
  select 1 from public.workspace_members
  where workspace_id = target and user_id = (select auth.uid()) and role = 'admin'
); $$;
create function civilhub_private.can_read_profile(target uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select (select auth.uid()) is not null and (
  target = (select auth.uid()) or exists (
    select 1 from public.workspace_members viewer
    join public.workspace_members colleague using (workspace_id)
    where viewer.user_id = (select auth.uid()) and colleague.user_id = target
  )
); $$;
revoke all on function civilhub_private.is_workspace_member(uuid), civilhub_private.is_workspace_admin(uuid), civilhub_private.can_read_profile(uuid) from public, anon;
grant execute on function civilhub_private.is_workspace_member(uuid), civilhub_private.is_workspace_admin(uuid), civilhub_private.can_read_profile(uuid) to authenticated;

-- Explicit grants accompany RLS. Anonymous callers cannot read business records.
revoke all on public.users, public.workspaces, public.workspace_members, public.companies, public.clients, public.jobs, public.job_expenses, public.overhead_costs, public.attachments from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.users, public.workspaces, public.workspace_members, public.companies, public.clients, public.jobs, public.job_expenses, public.overhead_costs, public.attachments to authenticated;
grant update (name) on public.users, public.workspaces to authenticated;
grant insert (id, workspace_id, name, logo_url), update (name, logo_url), delete on public.companies to authenticated;
grant insert (id, workspace_id, name), update (name), delete on public.clients to authenticated;
grant insert (id, workspace_id, job_number, company_id, client_id, work_type, custom_work_type, price, location_address, latitude, longitude, job_date, description, status),
  update (company_id, client_id, work_type, custom_work_type, price, location_address, latitude, longitude, job_date, description, status), delete on public.jobs to authenticated;
grant insert (id, workspace_id, job_id, description, category, amount, expense_date),
  update (job_id, description, category, amount, expense_date), delete on public.job_expenses to authenticated;
grant insert (id, workspace_id, company_id, category, description, amount, expense_date, is_recurring, recurrence_frequency),
  update (company_id, category, description, amount, expense_date, is_recurring, recurrence_frequency), delete on public.overhead_costs to authenticated;
grant insert (id, workspace_id, job_id, expense_id, overhead_id, original_filename, storage_path, mime_type, file_size), delete on public.attachments to authenticated;

alter table public.users enable row level security;
create policy profile_read on public.users for select to authenticated using (civilhub_private.can_read_profile(id));
create policy profile_update on public.users for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter table public.workspaces enable row level security;
create policy workspace_read on public.workspaces for select to authenticated using (civilhub_private.is_workspace_member(id));
create policy workspace_update on public.workspaces for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
alter table public.workspace_members enable row level security;
create policy membership_read on public.workspace_members for select to authenticated using (civilhub_private.is_workspace_member(workspace_id));
-- Membership/role changes have no direct client write grant.
do $$ declare t text; begin
  foreach t in array array['companies', 'clients', 'jobs', 'job_expenses', 'overhead_costs', 'attachments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy workspace_read on public.%I for select to authenticated using (civilhub_private.is_workspace_member(workspace_id))', t);
    execute format('create policy admin_insert on public.%I for insert to authenticated with check (civilhub_private.is_workspace_admin(workspace_id))', t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using (civilhub_private.is_workspace_admin(workspace_id))', t);
    if t <> 'attachments' then
      execute format('create policy admin_update on public.%I for update to authenticated using (civilhub_private.is_workspace_admin(workspace_id)) with check (civilhub_private.is_workspace_admin(workspace_id))', t);
    end if;
  end loop;
end $$;

create function civilhub_private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$ begin
  new.created_at = old.created_at;
  new.updated_at = now();
  return new;
end $$;
revoke all on function civilhub_private.touch_updated_at() from public, anon, authenticated;
do $$ declare t text; begin
  foreach t in array array['users', 'companies', 'clients', 'jobs', 'job_expenses', 'overhead_costs'] loop
    execute format('create trigger audit_timestamp before update on public.%I for each row execute function civilhub_private.touch_updated_at()', t);
  end loop;
end $$;

-- Authenticated onboarding is atomic: profile + workspace + admin membership + defaults.
-- It creates no jobs, sample financial values, or demo accounts.
create function public.create_construction_workspace(workspace_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_workspace uuid; caller uuid := auth.uid(); caller_email text; caller_name text;
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if workspace_name is null or length(trim(workspace_name)) not between 1 and 120 then
    raise exception 'Workspace name must contain 1 to 120 characters' using errcode = '22023';
  end if;
  caller_email := coalesce(auth.jwt()->>'email', '');
  caller_name := left(coalesce(nullif(trim(auth.jwt()->'user_metadata'->>'full_name'), ''), nullif(caller_email, ''), 'User'), 160);
  insert into public.users(id, name, email) values (caller, caller_name, caller_email)
    on conflict (id) do update set email = excluded.email;
  insert into public.workspaces(name, owner_id) values (trim(workspace_name), caller) returning id into new_workspace;
  insert into public.workspace_members(workspace_id, user_id, role) values (new_workspace, caller, 'admin');
  insert into public.companies(workspace_id, name)
    select new_workspace, company_name from unnest(array['Akar Sepakat Sdn Bhd', 'Mastura', 'Trust Me', 'Amiza', 'Kugiran Sdn Bhd']) as defaults(company_name);
  insert into public.clients(workspace_id, name) values (new_workspace, 'Sunway');
  return new_workspace;
end $$;
revoke all on function public.create_construction_workspace(text) from public, anon;
grant execute on function public.create_construction_workspace(text) to authenticated;

-- Private uploads use <workspace UUID>/<unique file name>, with a 5 MB limit.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('job-documents', 'job-documents', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png']);
create policy civilhub_document_read on storage.objects for select to authenticated
using (bucket_id = 'job-documents' and (storage.foldername(name))[1] in (
  select workspace_id::text from public.workspace_members where user_id = (select auth.uid())
));
create policy civilhub_document_upload on storage.objects for insert to authenticated
with check (bucket_id = 'job-documents' and (storage.foldername(name))[1] in (
  select workspace_id::text from public.workspace_members where user_id = (select auth.uid()) and role = 'admin'
));
create policy civilhub_document_delete on storage.objects for delete to authenticated
using (bucket_id = 'job-documents' and (storage.foldername(name))[1] in (
  select workspace_id::text from public.workspace_members where user_id = (select auth.uid()) and role = 'admin'
));
