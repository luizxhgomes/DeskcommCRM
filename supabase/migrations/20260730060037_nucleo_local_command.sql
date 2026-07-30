-- Núcleo local: simulações persistentes e ações de CRM sujeitas a aprovação.
-- Idempotente e sem transação explícita, conforme PORT-NOTES.md.

create table if not exists public.nucleo_simulations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  status text not null default 'open' check (status in ('open', 'closed')),
  contact_id uuid references public.contacts(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  lead_id uuid references public.crm_leads(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create index if not exists idx_nucleo_simulations_org_created
  on public.nucleo_simulations (organization_id, created_at desc);

create table if not exists public.nucleo_run_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  simulation_id uuid references public.nucleo_simulations(id) on delete set null,
  run_id uuid not null references public.ai_agent_runs(id) on delete cascade,
  action_kind text not null check (action_kind in (
    'create_lead', 'update_lead', 'move_lead_stage', 'create_activity', 'create_note'
  )),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in (
    'pending', 'approved', 'applied', 'rejected', 'failed'
  )),
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  requested_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  applied_at timestamptz,
  result jsonb not null default '{}'::jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  unique (id, organization_id),
  foreign key (simulation_id, organization_id)
    references public.nucleo_simulations(id, organization_id) on delete cascade
);

create index if not exists idx_nucleo_run_actions_org_status_created
  on public.nucleo_run_actions (organization_id, status, created_at desc);
create index if not exists idx_nucleo_run_actions_run
  on public.nucleo_run_actions (run_id, created_at asc);

do $$
declare t text;
begin
  foreach t in array array['nucleo_simulations', 'nucleo_run_actions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation_%s_all on public.%I', t, t);
    execute format(
      'create policy tenant_isolation_%s_all on public.%I for all to authenticated
       using (organization_id in (select * from public.fn_user_org_ids()))
       with check (organization_id in (select * from public.fn_user_org_ids()))',
      t, t
    );
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
