// Generate provisioning SQL for an already-created, confirmed demo Auth user.
// Run: node --import tsx scripts/demo-workspace-sql.ts > /tmp/civilhub-demo.sql
// Execute the result through the privileged Supabase SQL connection, never the browser.
// Intentionally refuses existing membership: reruns cannot overwrite user edits or real data.
import { seedWorkspace } from '../client/src/services/seed';
import { companies } from '../client/src/lib/constants';

const fixture = JSON.stringify({ ...seedWorkspace(), companies });
if (fixture.includes('$fixture$')) throw new Error('Invalid fixture delimiter');
console.log(`
begin;
do $provision$
declare
  demo_user uuid;
  demo_workspace uuid;
  fixture jsonb := $fixture$${fixture}$fixture$::jsonb;
  item jsonb;
  source_job jsonb;
  target_job uuid;
begin
  select id into demo_user from auth.users
    where lower(email) = 'demo@civilhub.my' and email_confirmed_at is not null;
  if demo_user is null then
    raise exception 'Create and auto-confirm demo@civilhub.my in Supabase Authentication first';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('civilhub-demo-provision', 0));
  if exists (select 1 from public.workspace_members where user_id = demo_user)
     or exists (select 1 from public.workspaces where owner_id = demo_user) then
    raise exception 'Demo account already has a workspace; refusing to overwrite it';
  end if;
  insert into public.users(id, name, email) values (demo_user, 'Demo Admin', 'demo@civilhub.my')
    on conflict(id) do nothing;
  insert into public.workspaces(name, owner_id, next_job_number)
    values ('CivilHub Demo — sample data only', demo_user, 1049) returning id into demo_workspace;
  insert into public.workspace_members(workspace_id, user_id, role)
    values (demo_workspace, demo_user, 'admin');
  for item in select value from jsonb_array_elements(fixture->'companies') loop
    insert into public.companies(workspace_id, code, name)
      values (demo_workspace, item->>'id', item->>'name');
  end loop;
  for item in select value from jsonb_array_elements(fixture->'clients') loop
    insert into public.clients(workspace_id, name) values (demo_workspace, item #>> '{}');
  end loop;
  for item in select value from jsonb_array_elements(fixture->'jobs') loop
    insert into public.jobs(workspace_id, job_number, company_id, client_id, work_type,
      price, location_address, latitude, longitude, job_date, description, status,
      created_by, created_at, updated_at)
    select demo_workspace, item->>'number', c.id, cl.id, item->>'workType',
      (item->>'price')::numeric / 100, item->>'location', (item->>'lat')::float8,
      (item->>'lng')::float8, (item->>'date')::date, item->>'description', item->>'status',
      demo_user, (item->>'createdAt')::timestamptz, (item->>'updatedAt')::timestamptz
    from public.companies c join public.clients cl on cl.workspace_id = c.workspace_id
    where c.workspace_id = demo_workspace and c.code = item->>'companyId' and cl.name = item->>'client';
  end loop;
  for item in select value from jsonb_array_elements(fixture->'expenses') loop
    select value into source_job from jsonb_array_elements(fixture->'jobs')
      where value->>'id' = item->>'jobId';
    select id into strict target_job from public.jobs
      where workspace_id = demo_workspace and job_number = source_job->>'number';
    insert into public.job_expenses(workspace_id, job_id, category, description, amount,
      expense_date, created_by, created_at, updated_at)
    values (demo_workspace, target_job, item->>'category', item->>'description',
      (item->>'amount')::numeric / 100, (item->>'date')::date, demo_user,
      (item->>'createdAt')::timestamptz, (item->>'updatedAt')::timestamptz);
  end loop;
  for item in select value from jsonb_array_elements(fixture->'overheads') loop
    insert into public.overhead_costs(workspace_id, company_id, category, description,
      amount, expense_date, is_recurring, recurrence_frequency, created_by, created_at, updated_at)
    values (demo_workspace,
      (select id from public.companies where workspace_id = demo_workspace and code = item->>'companyId'),
      item->>'category', item->>'description', (item->>'amount')::numeric / 100,
      (item->>'date')::date, (item->>'recurring')::boolean, item->>'frequency', demo_user,
      (item->>'createdAt')::timestamptz, (item->>'updatedAt')::timestamptz);
  end loop;
  if (select count(*) from public.jobs where workspace_id = demo_workspace) <> 15
    or (select count(*) from public.job_expenses where workspace_id = demo_workspace) <> 45
    or (select count(*) from public.overhead_costs where workspace_id = demo_workspace) <> 4 then
    raise exception 'Unexpected demo fixture counts; provisioning rolled back';
  end if;
end $provision$;
commit;
`);
