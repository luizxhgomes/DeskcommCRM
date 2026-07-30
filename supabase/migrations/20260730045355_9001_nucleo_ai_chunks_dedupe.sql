-- F4 Núcleo: o worker RAG reindexa fontes idempotentemente por versão+hash.
-- Limpa somente duplicatas exatas antes de instituir a chave física exigida pelo
-- upsert, preservando a linha mais antiga de cada conteúdo.
with ranked as (
  select id,
         row_number() over (
           partition by organization_id, kb_version_id, content_hash
           order by created_at asc, id asc
         ) as row_number
    from public.ai_chunks
)
delete from public.ai_chunks chunks
using ranked
where chunks.id = ranked.id
  and ranked.row_number > 1;

create unique index if not exists uniq_ai_chunks_org_version_content_hash
  on public.ai_chunks (organization_id, kb_version_id, content_hash);
