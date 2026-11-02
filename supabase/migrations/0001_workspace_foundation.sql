-- FUTURE INTEGRATION FOUNDATION. Not applied or called by the browser-local demo.
-- Apply to a development Supabase project and test policies before production use.
begin;
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Passwords and sessions belong to Supabase Auth, never to a public profile table.
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check(role in ('admin','staff')),
  primary key(workspace_id,user_id)
);
create index members_by_user on public.workspace_members(user_id);
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,id), unique(workspace_id,name)
);
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,id)
);
create unique index unique_client_names on public.clients(workspace_id,lower(trim(name)));
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_number text not null,
  company_id uuid not null,
  client_id uuid not null,
  work_type text not null,
  custom_work_type text,
  price numeric(14,2) not null check(price>0),
  location_address text not null,
  latitude double precision not null check(latitude between -90 and 90),
  longitude double precision not null check(longitude between -180 and 180),
  job_date date not null,
  description text not null default '',
  status text not null default 'Active' check(status in ('Active','Completed','On hold')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,id), unique(workspace_id,job_number),
  foreign key(workspace_id,company_id) references public.companies(workspace_id,id),
  foreign key(workspace_id,client_id) references public.clients(workspace_id,id)
);
create index jobs_by_company_date on public.jobs(workspace_id,company_id,job_date desc);
create index jobs_by_client on public.jobs(workspace_id,client_id);
create table public.job_expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid not null,
  description text not null,
  category text not null,
  amount numeric(14,2) not null check(amount>0),
  expense_date date not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,id),
  foreign key(workspace_id,job_id) references public.jobs(workspace_id,id) on delete cascade
);
create index expenses_by_job_date on public.job_expenses(workspace_id,job_id,expense_date);
create table public.overhead_costs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid,
  category text not null,
  description text not null,
  amount numeric(14,2) not null check(amount>0),
  expense_date date not null,
  is_recurring boolean not null default false,
  recurrence_frequency text check(recurrence_frequency in ('monthly','yearly')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(not is_recurring or recurrence_frequency is not null),
  unique(workspace_id,id),
  foreign key(workspace_id,company_id) references public.companies(workspace_id,id)
);
create index overheads_by_period on public.overhead_costs(workspace_id,expense_date);
create unique index no_duplicate_recurring_period on public.overhead_costs(
  workspace_id,coalesce(company_id::text,'shared'),category,lower(trim(description)),recurrence_frequency,
  (extract(year from expense_date)::integer*100 + case when recurrence_frequency='yearly' then 0 else extract(month from expense_date)::integer end)
) where is_recurring;
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid,
  expense_id uuid,
  overhead_id uuid,
  original_filename text not null,
  storage_path text not null unique,
  mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png')),
  file_size bigint not null check(file_size between 1 and 5242880),
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  check(num_nonnulls(job_id,expense_id,overhead_id)=1),
  foreign key(workspace_id,job_id) references public.jobs(workspace_id,id) on delete cascade,
  foreign key(workspace_id,expense_id) references public.job_expenses(workspace_id,id) on delete cascade,
  foreign key(workspace_id,overhead_id) references public.overhead_costs(workspace_id,id) on delete cascade
);
create index attachments_by_job on public.attachments(workspace_id,job_id);
create index attachments_by_expense on public.attachments(workspace_id,expense_id);
create index attachments_by_overhead on public.attachments(workspace_id,overhead_id);
create function public.is_workspace_member(target uuid) returns boolean
language sql stable security definer set search_path=public
as $$ select exists(select 1 from workspace_members where workspace_id=target and user_id=auth.uid()); $$;
create function public.is_workspace_admin(target uuid) returns boolean
language sql stable security definer set search_path=public
as $$ select exists(select 1 from workspace_members where workspace_id=target and user_id=auth.uid() and role='admin'); $$;
revoke all on function public.is_workspace_member(uuid),public.is_workspace_admin(uuid) from public;
grant execute on function public.is_workspace_member(uuid),public.is_workspace_admin(uuid) to authenticated;
alter table public.users enable row level security;
create policy profile_read on public.users for select to authenticated using(id=auth.uid());
create policy profile_update on public.users for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
alter table public.workspaces enable row level security;
create policy workspace_read on public.workspaces for select to authenticated using(public.is_workspace_member(id));
create policy workspace_update on public.workspaces for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
alter table public.workspace_members enable row level security;
create policy membership_read on public.workspace_members for select to authenticated using(public.is_workspace_member(workspace_id));
-- Membership changes are a future server-only operation, not a client write.
do $$ declare t text; begin
  foreach t in array array['companies','clients','jobs','job_expenses','overhead_costs','attachments'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy workspace_read on public.%I for select to authenticated using(public.is_workspace_member(workspace_id))',t);
    execute format('create policy admin_insert on public.%I for insert to authenticated with check(public.is_workspace_admin(workspace_id))',t);
    execute format('create policy admin_update on public.%I for update to authenticated using(public.is_workspace_admin(workspace_id)) with check(public.is_workspace_admin(workspace_id))',t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using(public.is_workspace_admin(workspace_id))',t);
  end loop;
end $$;
create function public.touch_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['users','companies','clients','jobs','job_expenses','overhead_costs'] loop
    execute format('create trigger audit_timestamp before update on public.%I for each row execute function public.touch_updated_at()',t);
  end loop;
end $$;
-- Explicit onboarding RPC for the later integration. Seeds company names and Sunway only.
create function public.create_construction_workspace(workspace_name text) returns uuid
language plpgsql security definer set search_path=public as $$
declare new_workspace uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(workspace_name)) not between 1 and 120 then raise exception 'Invalid workspace name'; end if;
  insert into workspaces(name,owner_id) values(trim(workspace_name),auth.uid()) returning id into new_workspace;
  insert into workspace_members(workspace_id,user_id,role) values(new_workspace,auth.uid(),'admin');
  insert into companies(workspace_id,name) select new_workspace,name from unnest(array['Akar Sepakat Sdn Bhd','Mastura','Trust Me','Amiza','Kugiran Sdn Bhd']) as name;
  insert into clients(workspace_id,name) values(new_workspace,'Sunway');
  return new_workspace;
end $$;
revoke all on function public.create_construction_workspace(text) from public;
grant execute on function public.create_construction_workspace(text) to authenticated;
-- Private documents: workspace UUID must be the first folder in every object path.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('job-documents','job-documents',false,5242880,array['application/pdf','image/jpeg','image/png']);
create policy workspace_document_read on storage.objects for select to authenticated using(bucket_id='job-documents' and (storage.foldername(name))[1] in (select workspace_id::text from public.workspace_members where user_id=auth.uid()));
create policy admin_document_upload on storage.objects for insert to authenticated with check(bucket_id='job-documents' and (storage.foldername(name))[1] in (select workspace_id::text from public.workspace_members where user_id=auth.uid() and role='admin'));
create policy admin_document_delete on storage.objects for delete to authenticated using(bucket_id='job-documents' and (storage.foldername(name))[1] in (select workspace_id::text from public.workspace_members where user_id=auth.uid() and role='admin'));
commit;
