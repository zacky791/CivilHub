-- Live account onboarding and transactional job registration.
create table civilhub_private.admin_setup (
  email text primary key check (email = lower(trim(email))),
  claimed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table civilhub_private.admin_setup enable row level security;
revoke all on civilhub_private.admin_setup from public, anon, authenticated;

alter table public.companies add column code text;
update public.companies set code = case name
  when 'Akar Sepakat Sdn Bhd' then 'akar' when 'Mastura' then 'mastura'
  when 'Trust Me' then 'trust' when 'Amiza' then 'amiza' when 'Kugiran Sdn Bhd' then 'kugiran' end;
alter table public.companies alter column code set not null;
alter table public.companies add constraint company_code_valid check (code in ('akar','mastura','trust','amiza','kugiran'));
alter table public.companies add constraint company_code_unique unique(workspace_id, code);
-- Companies are created by onboarding; a browser cannot alter their stable codes.

alter table public.workspaces add column next_job_number bigint not null default 1 check(next_job_number > 0);
update public.workspaces w set next_job_number = coalesce((
  select max(substring(j.job_number from 5)::bigint) + 1 from public.jobs j where j.workspace_id = w.id
), 1);

create or replace function public.create_construction_workspace(workspace_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_workspace uuid; caller uuid := auth.uid(); caller_email text; caller_name text;
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select lower(email) into caller_email from auth.users where id = caller and email_confirmed_at is not null;
  if caller_email is null then raise exception 'Confirm your email address before setting up the workspace' using errcode = '42501'; end if;
  perform 1 from civilhub_private.admin_setup where email = caller_email and (claimed_by is null or claimed_by = caller) for update;
  if not found then raise exception 'This account has not been approved for administrator setup. Contact the workspace owner.' using errcode = '42501'; end if;
  if workspace_name is null or length(trim(workspace_name)) not between 1 and 120 then
    raise exception 'Workspace name must contain 1 to 120 characters' using errcode = '22023';
  end if;
  select id into new_workspace from public.workspaces where owner_id = caller order by created_at limit 1;
  if new_workspace is not null then return new_workspace; end if;
  caller_name := left(coalesce(nullif(trim(auth.jwt()->'user_metadata'->>'full_name'), ''), caller_email), 160);
  insert into public.users(id, name, email) values (caller, caller_name, caller_email)
    on conflict (id) do update set email = excluded.email;
  insert into public.workspaces(name, owner_id) values (trim(workspace_name), caller) returning id into new_workspace;
  insert into public.workspace_members(workspace_id, user_id, role) values (new_workspace, caller, 'admin');
  insert into public.companies(workspace_id, code, name) values
    (new_workspace, 'akar', 'Akar Sepakat Sdn Bhd'), (new_workspace, 'mastura', 'Mastura'),
    (new_workspace, 'trust', 'Trust Me'), (new_workspace, 'amiza', 'Amiza'), (new_workspace, 'kugiran', 'Kugiran Sdn Bhd');
  insert into public.clients(workspace_id, name) values (new_workspace, 'Sunway');
  update civilhub_private.admin_setup set claimed_by = caller where email = caller_email;
  return new_workspace;
end $$;

create function public.save_construction_job(target_workspace uuid, job_data jsonb, existing_job uuid default null)
returns public.jobs language plpgsql security definer set search_path = '' as $$
declare result public.jobs; company uuid; client uuid; requested_id uuid; job_no text; sequence_no bigint;
begin
  if not civilhub_private.is_workspace_admin(target_workspace) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  -- One locked workspace row serializes numbering and duplicate requests.
  perform 1 from public.workspaces where id = target_workspace for update;
  if existing_job is null then
    requested_id := coalesce(nullif(job_data->>'id', '')::uuid, gen_random_uuid());
    select * into result from public.jobs where workspace_id = target_workspace and id = requested_id;
    if found then return result; end if;
  else
    select * into result from public.jobs where workspace_id = target_workspace and id = existing_job for update;
    if not found then raise exception 'Job no longer exists' using errcode = 'P0002'; end if;
  end if;
  select id into company from public.companies where workspace_id = target_workspace and code = job_data->>'company_code';
  if company is null then raise exception 'Select a valid company' using errcode = '22023'; end if;
  insert into public.clients as c(workspace_id, name) values (target_workspace, trim(job_data->>'client'))
    on conflict (workspace_id, lower(trim(name))) do update set name = c.name returning id into client;
  if existing_job is null then
    update public.workspaces set next_job_number = next_job_number + 1 where id = target_workspace returning next_job_number - 1 into sequence_no;
    job_no := 'JOB-' || lpad(sequence_no::text, greatest(4, length(sequence_no::text)), '0');
    insert into public.jobs(id, workspace_id, job_number, company_id, client_id, work_type, custom_work_type, price, location_address, latitude, longitude, job_date, description, status, created_by)
    values (requested_id, target_workspace, job_no, company, client, job_data->>'work_type', job_data->>'custom_work_type',
      (job_data->>'price')::numeric, trim(job_data->>'location_address'), (job_data->>'latitude')::double precision,
      (job_data->>'longitude')::double precision, (job_data->>'job_date')::date, coalesce(job_data->>'description', ''),
      coalesce(job_data->>'status', 'Active'), auth.uid()) returning * into result;
  else
    update public.jobs set company_id = company, client_id = client, work_type = job_data->>'work_type',
      custom_work_type = job_data->>'custom_work_type', price = (job_data->>'price')::numeric,
      location_address = trim(job_data->>'location_address'), latitude = (job_data->>'latitude')::double precision,
      longitude = (job_data->>'longitude')::double precision, job_date = (job_data->>'job_date')::date,
      description = coalesce(job_data->>'description', ''), status = coalesce(job_data->>'status', 'Active')
      where id = existing_job and workspace_id = target_workspace returning * into result;
  end if;
  return result;
end $$;
revoke all on function public.save_construction_job(uuid,jsonb,uuid) from public, anon;
grant execute on function public.save_construction_job(uuid,jsonb,uuid) to authenticated;
