-- Run only in the isolated test cluster prepared by bootstrap-local.sql.
\set ON_ERROR_STOP on
begin;
select gen_random_uuid() as owner_a, gen_random_uuid() as owner_b, gen_random_uuid() as staff \gset
insert into auth.users(id, email) values (:'owner_a', 'owner-a@example.invalid'), (:'owner_b', 'owner-b@example.invalid'), (:'staff', 'staff@example.invalid');
select set_config('request.jwt.claims', jsonb_build_object('sub', :'owner_a', 'email', 'owner-a@example.invalid')::text, true);
set local role authenticated;
select public.create_construction_workspace('Workspace A') as workspace_a \gset
select id as company_a from public.companies order by name limit 1 \gset
select id as client_a from public.clients limit 1 \gset
insert into public.jobs(workspace_id, job_number, company_id, client_id, work_type, price, location_address, latitude, longitude, job_date)
values (:'workspace_a', 'JOB-0001', :'company_a', :'client_a', 'Resurface', 15000.00, 'Shah Alam', 3.0738, 101.5183, '2026-11-03') returning id as job_a \gset
insert into public.job_expenses(workspace_id, job_id, description, category, amount, expense_date)
values (:'workspace_a', :'job_a', 'Materials', 'Materials', 3900.00, '2026-11-03') returning id as expense_a \gset
insert into public.attachments(workspace_id, job_id, original_filename, storage_path, mime_type, file_size)
values (:'workspace_a', :'job_a', 'receipt.pdf', :'workspace_a' || '/receipt.pdf', 'application/pdf', 100);
insert into storage.objects(bucket_id, name) values ('job-documents', :'workspace_a' || '/receipt.pdf');
do $$ begin
  if (select count(*) from public.companies) <> 5 then raise exception 'Company defaults not seeded'; end if;
  if (select count(*) from public.clients where name = 'Sunway') <> 1 then raise exception 'Client default missing'; end if;
  if (select price from public.jobs) <> 15000.00 then raise exception 'Original value changed'; end if;
  if (select price from public.jobs) - (select sum(amount) from public.job_expenses) <> 11100.00 then raise exception 'Incorrect balance'; end if;
  if (select created_by from public.jobs) <> auth.uid() then raise exception 'Incorrect audit identity'; end if;
end $$;
select 'PASS: onboarding, defaults, exact money and audit identity' as result;

insert into public.overhead_costs(workspace_id, category, description, amount, expense_date, is_recurring, recurrence_frequency)
values (:'workspace_a', 'Internet', 'Broadband', 200.10, '2026-11-01', true, 'monthly');
do $$ begin
  begin
    insert into public.overhead_costs(workspace_id, category, description, amount, expense_date, is_recurring, recurrence_frequency)
    select workspace_id, 'Internet', ' broadband ', 200.10, '2026-11-20', true, 'monthly' from public.jobs limit 1;
    raise exception 'Duplicate recurring period accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.job_expenses(workspace_id, job_id, description, category, amount, expense_date)
    select workspace_id, id, 'Invalid amount', 'Other', 'NaN'::numeric, '2026-11-03' from public.jobs limit 1;
    raise exception 'NaN money accepted';
  exception when check_violation then null; end;
  begin
    insert into public.job_expenses(workspace_id, job_id, description, category, amount, expense_date)
    select workspace_id, id, 'Negative amount', 'Other', -1, '2026-11-03' from public.jobs limit 1;
    raise exception 'Negative money accepted';
  exception when check_violation then null; end;
  begin
    insert into public.attachments(workspace_id, original_filename, storage_path, mime_type, file_size)
    select workspace_id, 'orphan.pdf', workspace_id::text || '/orphan.pdf', 'application/pdf', 100 from public.jobs limit 1;
    raise exception 'Attachment without parent accepted';
  exception when check_violation then null; end;
end $$;
select 'PASS: recurrence, valid money and attachment parent constraints' as result;

reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub', :'owner_b', 'email', 'owner-b@example.invalid')::text, true);
set local role authenticated;
select public.create_construction_workspace('Workspace B') as workspace_b \gset
select id as company_b from public.companies order by name limit 1 \gset
select set_config('civilhub.test_b_company', :'company_b', true);
do $$ begin
  if (select count(*) from public.companies) <> 5 then raise exception 'Company tenant isolation failed'; end if;
  if (select count(*) from public.workspaces) <> 1 then raise exception 'Workspace isolation failed'; end if;
  if exists(select 1 from public.jobs) then raise exception 'Other tenant jobs visible'; end if;
  if exists(select 1 from public.job_expenses) then raise exception 'Other tenant expenses visible'; end if;
  if exists(select 1 from public.attachments) then raise exception 'Other tenant attachment metadata visible'; end if;
  if exists(select 1 from storage.objects) then raise exception 'Other tenant files visible'; end if;
end $$;
select 'PASS: independent workspace cannot read tenant A data/files' as result;

reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub', :'owner_a', 'email', 'owner-a@example.invalid')::text, true);
set local role authenticated;
do $$ begin
  begin
    insert into public.jobs(workspace_id, job_number, company_id, client_id, work_type, price, location_address, latitude, longitude, job_date)
    select workspace_id, 'JOB-0002', current_setting('civilhub.test_b_company')::uuid, client_id, 'Curb', 1000, 'Shah Alam', 3, 101, '2026-11-03' from public.jobs limit 1;
    raise exception 'Cross-workspace company foreign key accepted';
  exception when foreign_key_violation then null; end;
  begin
    update public.jobs set created_by = gen_random_uuid();
    raise exception 'Audit identity editing permitted';
  exception when insufficient_privilege then null; end;
  begin
    update public.workspaces set owner_id = gen_random_uuid();
    raise exception 'Workspace ownership editing permitted';
  exception when insufficient_privilege then null; end;
end $$;
select 'PASS: cross-workspace references and audit/ownership edits denied' as result;

reset role;
insert into public.workspace_members(workspace_id, user_id, role) values (:'workspace_a', :'staff', 'staff');
select set_config('request.jwt.claims', jsonb_build_object('sub', :'staff', 'email', 'staff@example.invalid')::text, true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.jobs) <> 1 then raise exception 'Staff cannot read assigned workspace'; end if;
  if (select count(*) from storage.objects) <> 1 then raise exception 'Staff cannot read assigned documents'; end if;
  begin
    insert into public.job_expenses(workspace_id, job_id, description, category, amount, expense_date)
    select workspace_id, id, 'Forbidden staff expense', 'Other', 10, '2026-11-03' from public.jobs limit 1;
    raise exception 'Staff expense write permitted';
  exception when insufficient_privilege then null; end;
  begin
    update public.workspace_members set role = 'admin';
    raise exception 'Staff role escalation permitted';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id, name)
    select 'job-documents', workspace_id::text || '/forbidden.pdf' from public.jobs limit 1;
    raise exception 'Staff document upload permitted';
  exception when insufficient_privilege then null; end;
end $$;
select 'PASS: staff reads permitted; writes and privilege escalation denied' as result;

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role anon;
do $$ begin
  begin
    perform count(*) from public.jobs;
    raise exception 'Anonymous business data read permitted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_construction_workspace('Forbidden');
    raise exception 'Anonymous onboarding permitted';
  exception when insufficient_privilege then null; end;
end $$;
select 'PASS: anonymous reads and onboarding denied' as result;

reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub', :'owner_a', 'email', 'owner-a@example.invalid')::text, true);
set local role authenticated;
delete from public.jobs where id = :'job_a';
do $$ begin
  if exists(select 1 from public.job_expenses) then raise exception 'Expense cascade failed'; end if;
  if exists(select 1 from public.attachments) then raise exception 'Attachment cascade failed'; end if;
end $$;
select 'PASS: job deletion cascades financial records and document metadata' as result;
reset role;
do $$ begin
  if (select count(*) from pg_tables where schemaname = 'public' and rowsecurity) <> 9 then raise exception 'Expected RLS on all 9 tables'; end if;
  if (select public from storage.buckets where id = 'job-documents') then raise exception 'Documents bucket is public'; end if;
end $$;
select 'PASS: all nine tables have RLS and documents bucket is private' as result;
rollback;
