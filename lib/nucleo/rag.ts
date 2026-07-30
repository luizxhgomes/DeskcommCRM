import type { SupabaseClient } from "@supabase/supabase-js";

import { embedText } from "@/lib/ai/embed";

type KnowledgeHit = {
  chunk_id: string;
  knowledge_source_id: string | null;
  content: string;
  similarity: number;
  metadata: Record<string, unknown> | null;
};

/**
 * Ponte deliberadamente pequena entre o dry-run nativo e a KB nativa. Não cria
 * índice paralelo: usa a mesma versão ativa, embeddings e RPC pgvector usados
 * pelo agent-engine. O retorno é próprio para uma tool e não lança conteúdo de
 * KB para telemetria fora do trace do run.
 */
export async function searchNucleoKnowledge(
  supabase: SupabaseClient,
  input: { organizationId: string; agentId: string; query: string },
): Promise<{ ok: true; results: KnowledgeHit[] } | { ok: false; error: { code: string; message: string } }> {
  try {
    const { data: agent, error: agentError } = await supabase
      .from("ai_agents")
      .select("active_kb_version_id, config")
      .eq("id", input.agentId)
      .eq("organization_id", input.organizationId)
      .maybeSingle();
    if (agentError || !agent?.active_kb_version_id) {
      return { ok: false, error: { code: "no_knowledge_base", message: "Este agente não possui uma base ativa." } };
    }
    const config = (agent.config ?? {}) as { rag_top_k?: unknown; rag_similarity_threshold?: unknown };
    const topK = typeof config.rag_top_k === "number" ? Math.min(Math.max(config.rag_top_k, 1), 10) : 5;
    const threshold = typeof config.rag_similarity_threshold === "number" ? config.rag_similarity_threshold : 0.5;
    const embedding = await embedText(input.query, { organizationId: input.organizationId });
    const { data, error } = await supabase.rpc("retrieve_top_k_chunks" as never, {
      p_organization_id: input.organizationId,
      p_kb_version_id: agent.active_kb_version_id,
      p_embedding: `[${embedding.embedding.join(",")}]`,
      p_k: topK,
      p_threshold: threshold,
    } as never);
    if (error) throw error;
    const hits = ((data ?? []) as unknown as KnowledgeHit[]).filter((hit) => hit.similarity >= threshold);
    const topScore = Math.max(...((data ?? []) as unknown as KnowledgeHit[]).map((hit) => hit.similarity).filter(Number.isFinite));
    await supabase.from("knowledge_searches").insert({
      organization_id: input.organizationId,
      // `knowledge_searches.job_id` referencia exclusivamente `job_queue`.
      // O dry-run é rastreado por `ai_agent_runs`, portanto não pode gravar
      // esse UUID nesta FK. A auditoria do run permanece em `ai_agent_runs`
      // e em seu trace; a busca fica corretamente registrada sem job de fila.
      job_id: null,
      kb_version_id: agent.active_kb_version_id,
      hits: hits.length,
      top_score: Number.isFinite(topScore) ? topScore : null,
      threshold,
    });
    return { ok: true, results: hits };
  } catch {
    return { ok: false, error: { code: "knowledge_unavailable", message: "A base de conhecimento está indisponível agora." } };
  }
}
