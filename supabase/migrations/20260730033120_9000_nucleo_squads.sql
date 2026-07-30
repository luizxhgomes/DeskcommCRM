-- 9000_nucleo_squads
-- Núcleo: catálogo de squads e portfólio OpenRouter. Idempotente; sem transação
-- explícita, conforme lib/agent-engine/PORT-NOTES.md.

-- ==== NUCLEO: extensão permitida das três constraints core de provider ====
alter table public.ai_agent_versions drop constraint if exists ai_agent_versions_provider_check;
alter table public.ai_agent_versions add constraint ai_agent_versions_provider_check
  check (provider in ('anthropic', 'openai', 'google', 'openrouter'));

alter table public.ai_models drop constraint if exists ai_models_provider_check;
alter table public.ai_models add constraint ai_models_provider_check
  check (provider in ('anthropic', 'openai', 'google', 'openrouter'));

alter table public.ai_provider_credentials drop constraint if exists ai_provider_credentials_provider_check;
alter table public.ai_provider_credentials add constraint ai_provider_credentials_provider_check
  check (provider in ('anthropic', 'openai', 'google', 'openrouter'));

-- Catálogo compilado: é a ponte auditável entre squads-source e ai_agents.
create table if not exists public.nucleo_squads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (length(name) > 0),
  manifest jsonb not null default '{}'::jsonb,
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  unique (id, organization_id)
);

create index if not exists idx_nucleo_squads_org_slug
  on public.nucleo_squads (organization_id, slug);

create table if not exists public.nucleo_squad_agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  squad_id uuid not null references public.nucleo_squads(id) on delete cascade,
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  role text not null check (role in ('chief', 'specialist', 'meta')),
  tier integer not null,
  source_path text not null check (length(source_path) > 0),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (squad_id, agent_id),
  unique (organization_id, agent_id)
);

create index if not exists idx_nucleo_squad_agents_org_squad
  on public.nucleo_squad_agents (organization_id, squad_id, tier);

-- Perfis de capacidade são estáveis; modelos/custos concretos são candidatos
-- por org e podem ser sincronizados sem recompilar squads.
create table if not exists public.nucleo_model_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9_-]+$'),
  name text not null check (length(name) > 0),
  capability text not null check (capability in (
    'text_fast', 'text_reasoning', 'code_agent', 'vision_document', 'web_research',
    'image_generation', 'video_generation', 'transcription', 'speech', 'batch_background'
  )),
  input_modalities text[] not null default array['text']::text[],
  output_modalities text[] not null default array['text']::text[],
  requires_tools boolean not null default false,
  requires_structured_output boolean not null default false,
  max_cost_cents integer check (max_cost_cents is null or max_cost_cents > 0),
  allow_degraded_free boolean not null default false,
  is_active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  unique (id, organization_id)
);

create table if not exists public.nucleo_model_profile_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null,
  provider text not null check (provider = 'openrouter'),
  model_id text not null check (length(model_id) > 0),
  priority integer not null check (priority between 1 and 99),
  fallback_kind text not null check (fallback_kind in ('primary', 'paid', 'free')),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, priority),
  unique (profile_id, model_id),
  foreign key (profile_id, organization_id)
    references public.nucleo_model_profiles(id, organization_id) on delete cascade,
  check ((fallback_kind <> 'free') or model_id = 'openrouter/free')
);

create index if not exists idx_nucleo_model_candidates_resolve
  on public.nucleo_model_profile_candidates (organization_id, profile_id, priority)
  where is_active;

-- Tentativas, inclusive falhas antes de existir llm_calls; sem texto/PII/chave.
create table if not exists public.nucleo_model_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid references public.nucleo_model_profiles(id) on delete set null,
  llm_call_id uuid references public.llm_calls(id) on delete set null,
  job_id uuid,
  provider text not null check (provider = 'openrouter'),
  model_id text not null check (length(model_id) > 0),
  attempt_number integer not null check (attempt_number >= 1),
  fallback_kind text not null check (fallback_kind in ('primary', 'paid', 'free')),
  status text not null check (status in ('attempted', 'succeeded', 'failed')),
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_nucleo_model_attempts_org_created
  on public.nucleo_model_attempts (organization_id, created_at desc);

-- RLS: mesma política tenant_isolation_* canônica do fork. O service role do
-- seeder continua bypassrls; usuários autenticados só enxergam sua organização.
do $$
declare t text;
begin
  foreach t in array array[
    'nucleo_squads', 'nucleo_squad_agents', 'nucleo_model_profiles',
    'nucleo_model_profile_candidates', 'nucleo_model_attempts'
  ] loop
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
