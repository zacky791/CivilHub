create table public.job_payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid not null,
  amount numeric(14,2) not null check (amount > 0 and amount < 1000000000000),
  payment_date date not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, job_id) references public.jobs(workspace_id, id) on delete cascade
);
create index payments_by_job_date on public.job_payments(workspace_id, job_id, payment_date);
create index payments_by_creator on public.job_payments(created_by);
alter table public.job_payments enable row level security;
revoke all on public.job_payments from public, anon, authenticated;
grant select, delete on public.job_payments to authenticated;
grant insert (id, workspace_id, job_id, amount, payment_date) on public.job_payments to authenticated;
create policy workspace_read on public.job_payments for select to authenticated
  using (civilhub_private.is_workspace_member(workspace_id));
create policy admin_insert on public.job_payments for insert to authenticated
  with check (civilhub_private.is_workspace_admin(workspace_id));
create policy admin_delete on public.job_payments for delete to authenticated
  using (civilhub_private.is_workspace_admin(workspace_id));
