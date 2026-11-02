\set ON_ERROR_STOP on
begin;
select gen_random_uuid() as admin, gen_random_uuid() as unapproved, gen_random_uuid() as unverified \gset
insert into auth.users(id,email,email_confirmed_at) values
 (:'admin','approved@example.invalid',now()),(:'unapproved','other@example.invalid',now()),(:'unverified','unverified@example.invalid',null);
insert into civilhub_private.admin_setup(email) values ('approved@example.invalid'),('unverified@example.invalid');
select set_config('request.jwt.claims',jsonb_build_object('sub',:'unapproved','email','approved@example.invalid')::text,true);
set local role authenticated;
do $$ begin
 begin perform public.create_construction_workspace('Not allowed');raise exception 'Unapproved account claimed admin';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',:'unverified','email','unverified@example.invalid')::text,true);
set local role authenticated;
do $$ begin
 begin perform public.create_construction_workspace('Not verified');raise exception 'Unverified account claimed admin';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',:'admin','email','approved@example.invalid')::text,true);
set local role authenticated;
select public.create_construction_workspace('My company') as workspace \gset
select public.create_construction_workspace('My company again') as same_workspace \gset
select gen_random_uuid() as request_id \gset
select set_config('civilhub.test_request',:'request_id',true);
select (public.save_construction_job(:'workspace',jsonb_build_object('id',:'request_id','company_code','akar','client','Sunway','work_type','Resurface','price','15000.00','location_address','Shah Alam','latitude',3.07,'longitude',101.51,'job_date','2026-11-03'))).id as job \gset
select public.save_construction_job(:'workspace',jsonb_build_object('id',:'request_id','company_code','akar','client','Sunway','work_type','Resurface','price','15000.00','location_address','Shah Alam','latitude',3.07,'longitude',101.51,'job_date','2026-11-03'));
do $$ begin
 if (select count(*) from public.workspaces)<>1 then raise exception 'Onboarding was not idempotent';end if;
 if (select count(*) from public.companies where code is not null)<>5 then raise exception 'Stable company codes missing';end if;
 if (select count(*) from public.jobs)<>1 then raise exception 'Job request was duplicated';end if;
 if (select job_number from public.jobs)<>'JOB-0001' then raise exception 'Wrong job number';end if;
 if (select next_job_number from public.workspaces)<>2 then raise exception 'Duplicate request advanced the counter';end if;
end $$;
select public.save_construction_job(:'workspace',jsonb_build_object('company_code','akar','client','  sunway  ','work_type','Other','custom_work_type','Drainage','price','25000.10','location_address','Shah Alam','latitude',3.07,'longitude',101.51,'job_date','2026-11-03'));
do $$ begin
 if (select count(*) from public.clients)<>1 then raise exception 'Case-insensitive client was duplicated';end if;
 if not exists(select 1 from public.jobs where job_number='JOB-0002' and price=25000.10 and custom_work_type='Drainage') then raise exception 'Job allocation or decimal parsing failed';end if;
 begin
  perform public.save_construction_job((select id from public.workspaces limit 1),'{"company_code":"akar","client":"Should roll back","work_type":"Curb","price":"-1","location_address":"Shah Alam","latitude":3,"longitude":101,"job_date":"2026-11-03"}');
  raise exception 'Negative job accepted';
 exception when check_violation then null;end;
 if (select next_job_number from public.workspaces)<>3 then raise exception 'Failed job advanced the counter';end if;
 if exists(select 1 from public.clients where name='Should roll back') then raise exception 'Failed job committed a client';end if;
 begin update public.workspaces set next_job_number=1;raise exception 'Counter tampering permitted';exception when insufficient_privilege then null;end;
end $$;
select 'PASS: verified-admin reservation, idempotent onboarding, transactional numbering/client creation, rollback and protected counters' as result;
rollback;
