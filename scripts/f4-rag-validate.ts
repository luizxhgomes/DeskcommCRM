/**
 * Prova F4 sem dados de cliente: envia a KB original de docs/ ao storage privado
 * e executa o mesmo worker de reindexação que o event-log usa em produção.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createAdminClient } from "@/lib/supabase/admin";
import { processRagIndexer } from "@/workers/rag-indexer";

async function main(): Promise<void> {
  const admin = createAdminClient();
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", "nucleo")
    .single();
  if (orgError || !org) throw new Error("Organização nucleo não encontrada.");
  const { data: agent, error: agentError } = await admin
    .from("ai_agents")
    .select("id")
    .eq("organization_id", org.id)
    .eq("name", "nucleo/sales/sales-chief")
    .single();
  if (agentError || !agent) throw new Error("Sales chief não encontrado.");

  const name = "F4 · guia MEDDPICC original de validação";
  const blobPath = "nucleo/f4/kb-validacao-meddpicc.md";
  const content = await readFile(resolve(process.cwd(), "..", "docs", "KB_VALIDACAO_F4.md"), "utf8");
  const { error: uploadError } = await admin.storage
    .from("ai-policy")
    .upload(blobPath, new Blob([content], { type: "text/markdown; charset=utf-8" }), { upsert: true, contentType: "text/markdown; charset=utf-8" });
  if (uploadError) throw new Error(`Upload da KB falhou: ${uploadError.message}`);

  const { data: previous, error: previousError } = await admin
    .from("ai_knowledge_sources")
    .select("id, source_metadata")
    .eq("organization_id", org.id)
    .eq("agent_id", agent.id)
    .maybeSingle();
  if (previousError) throw new Error(`Consulta da KB falhou: ${previousError.message}`);
  const priorMetadata = (previous?.source_metadata ?? {}) as Record<string, unknown>;
  const metadata = {
    blob_path: blobPath,
    filename: "KB_VALIDACAO_F4.md",
    source: "nucleo_f4_original",
    replaced_source: {
      blob_path: priorMetadata.blob_path ?? null,
      filename: priorMetadata.filename ?? null,
      replaced_at: new Date().toISOString(),
    },
  };
  const source = previous
    ? await admin.from("ai_knowledge_sources").update({ name, source_metadata: metadata, status: "ready" }).eq("id", previous.id).select("id").single()
    : await admin.from("ai_knowledge_sources").insert({ organization_id: org.id, agent_id: agent.id, source_type: "policy", name, status: "ready", source_metadata: metadata, ingested_at: new Date().toISOString() }).select("id").single();
  if (source.error || !source.data) throw new Error(`Registro da KB falhou: ${source.error?.message ?? "sem fonte"}`);

  const result = await processRagIndexer({
    id: `f4-kb-${source.data.id}`,
    organization_id: org.id,
    event_type: "knowledge_source.updated",
    entity_kind: "ai_knowledge_source",
    entity_id: source.data.id,
    payload: { knowledge_source_id: source.data.id, created_at: new Date().toISOString() },
    metadata: { source: "f4-validation" },
    consumed_by: [],
    attempts: 0,
  });
  if (result.status !== "ok") throw new Error(`Reindexação não concluiu: ${result.detail ?? result.status}`);
  const { count, error: chunksError } = await admin
    .from("ai_chunks")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .eq("knowledge_source_id", source.data.id);
  if (chunksError || !count) throw new Error(`Chunks não confirmados: ${chunksError?.message ?? "zero"}`);
  console.info(`F4 RAG PASS: source=${source.data.id} chunks=${count} ${result.detail ?? ""}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
