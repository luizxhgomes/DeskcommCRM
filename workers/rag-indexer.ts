/**
 * RAG indexer worker — consumes domain events and indexes content into
 * `ai_chunks` + `ai_knowledge_versions` for semantic retrieval.
 *
 * Events handled:
 *   - nuvemshop.product_synced  → fetches product, embeds chunks, activates version
 *   - knowledge_source.updated  → extracts policy Markdown/PDF, embeds and activates KB
 *
 * Service-role caveat (CLAUDE.md §multi-tenancy): every query filters
 * `organization_id` from the trusted event row, never from user input.
 */

import { isEmbeddingProviderConfigured } from "@/lib/ai/gateway";
import { embedText } from "@/lib/ai/embed";
import { acquireDebounce } from "@/lib/ai/rag/debounce";
import { chunkText, computeContentHash } from "@/lib/ai/rag/chunker";
import { formatProductForRag, type NuvemshopProduct } from "@/lib/ai/rag/format-product";
import { ingestPolicyFile } from "@/lib/ai/rag/ingest/policy";
import {
  createKnowledgeVersion,
  markVersionReady,
  markVersionFailed,
  activateVersion,
} from "@/lib/ai/rag/version";
import type { EventRow, HandlerResult } from "@/lib/event-log/dispatcher";
import { createAdminClient } from "@/lib/supabase/admin";
import { NuvemshopApiClient } from "@/lib/nuvemshop/api-client";

const DEBOUNCE_TTL_SEC = 30;
const LAG_WARN_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SkipResult = { type: "skip"; reason: string };
type ErrorResult = { type: "error"; detail: string };
type OkResult = { type: "ok"; versionId: string; chunkCount: number };
type ProcessResult = SkipResult | ErrorResult | OkResult;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function skip(reason: string): SkipResult {
  return { type: "skip", reason };
}

function estimateTokenCount(content: string): number {
  // A coluna é telemetria e não pode ser nula. A chamada de embedding devolve
  // tokens de prompt, mas não por chunk em todas as versões do SDK.
  return Math.max(1, Math.ceil(content.length / 4));
}

/**
 * Loads the default active agent for the org.
 * Returns null when no agent is configured.
 */
async function resolveAgent(
  organizationId: string,
): Promise<{ id: string; active_kb_version_id: string | null } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ai_agents")
    .select("id, organization_id, active_kb_version_id, is_active, is_default")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    id: (data as { id: string }).id,
    active_kb_version_id:
      (data as { active_kb_version_id: string | null }).active_kb_version_id ?? null,
  };
}

/**
 * Loads the decrypted Nuvemshop access token + store ID for the org.
 * Returns null when the integration is not connected.
 */
async function resolveNuvemshopCredentials(
  organizationId: string,
): Promise<{ accessToken: string; storeId: string } | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("tenant_integrations")
    .select("id, organization_id, provider, store_metadata, oauth_access_token_encrypted")
    .eq("organization_id", organizationId)
    .eq("provider", "nuvemshop")
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;

  // store_metadata carries the storeId as { store_id: string } or { id: number }
  const meta = (data as { store_metadata: Record<string, unknown> | null }).store_metadata ?? {};
  const storeId = String(
    meta["store_id"] ?? meta["id"] ?? "",
  );
  if (!storeId) return null;

  // Decrypt the access token via Postgres helper fn_decrypt_oauth.
  // We use RPC to avoid shipping plaintext bytes through the app layer.
  const { data: decrypted, error: decErr } = await admin.rpc(
    "fn_decrypt_oauth" as never,
    {
      p_organization_id: organizationId,
      p_integration_id: (data as { id: string }).id,
    } as never,
  );

  if (decErr || !decrypted) return null;

  const accessToken = String(decrypted);
  if (!accessToken) return null;

  return { accessToken, storeId };
}

/**
 * Fetches a single product from Nuvemshop REST API.
 * Returns null when credentials are unavailable or product not found.
 */
async function fetchNuvemshopProduct(
  organizationId: string,
  productId: string,
): Promise<NuvemshopProduct | null> {
  const creds = await resolveNuvemshopCredentials(organizationId);
  if (!creds) {
    // Wave 4 stub — full Nuvemshop credential resolution implemented in S-06.x
    // Concern: fn_decrypt_oauth RPC may not exist; if so, this returns null gracefully.
    console.warn(
      "[rag-indexer] nuvemshop credentials unavailable for org",
      organizationId,
      "— skipping product fetch (stub path)",
    );
    return null;
  }

  const client = new NuvemshopApiClient({
    storeId: creds.storeId,
    accessToken: creds.accessToken,
  });

  try {
    const product = await client.get<NuvemshopProduct>(`/products/${productId}`);
    return product ?? null;
  } catch (err) {
    console.warn(
      "[rag-indexer] fetchNuvemshopProduct failed",
      productId,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleProductSynced(
  row: EventRow,
  agentId: string,
): Promise<ProcessResult> {
  const productId = String(row.payload["product_id"] ?? "");
  if (!productId) {
    return skip("missing_product_id_in_payload");
  }

  const product = await fetchNuvemshopProduct(row.organization_id, productId);
  if (!product) {
    return skip("product_fetch_failed_or_stub");
  }

  const text = formatProductForRag(product);
  const chunks = chunkText(text);

  if (chunks.length === 0) {
    return skip("no_chunks_generated");
  }

  // Create a new version in 'building' status.
  const { versionId, versionNumber } = await createKnowledgeVersion({
    agentId,
    organizationId: row.organization_id,
    sourceType: "nuvemshop_product",
  });

  console.warn(
    `[rag-indexer] created version ${versionNumber} (${versionId}) for org ${row.organization_id}`,
  );

  // Embed and upsert each chunk.
  const admin = createAdminClient();
  let successCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i] ?? "";
    if (!content) continue;
    const contentHash = computeContentHash(content);

    let embedding: number[];
    try {
      const result = await embedText(content, { organizationId: row.organization_id });
      embedding = result.embedding;
    } catch (err) {
      // If embedding fails mid-way, abort and fail the version.
      const detail = err instanceof Error ? err.message : String(err);
      return { type: "error", detail: `embed_failed at chunk ${i}: ${detail}` };
    }

    // Upsert chunk — conflict on (organization_id, kb_version_id, content_hash) → do nothing
    const { error: upsertErr } = await admin
      .from("ai_chunks")
      .upsert(
        {
          organization_id: row.organization_id,
          kb_version_id: versionId,
          knowledge_source_id: null, // product-level indexing; source link deferred to S-06.05
          position: i,
          content,
          content_hash: contentHash,
          embedding: embedding as unknown as string,
          metadata: {
            source_type: "nuvemshop_product",
            product_id: productId,
          },
        },
        {
          onConflict: "organization_id,kb_version_id,content_hash",
          ignoreDuplicates: true,
        },
      );

    if (upsertErr) {
      // Log but don't fail the whole version for a single chunk upsert error.
      console.warn(
        `[rag-indexer] chunk upsert error at position ${i}:`,
        upsertErr.message,
      );
    } else {
      successCount++;
    }
  }

  await markVersionReady(versionId, row.organization_id, successCount);
  await activateVersion({
    agentId,
    versionId,
    organizationId: row.organization_id,
  });

  return { type: "ok", versionId, chunkCount: successCount };
}

async function handleKnowledgeSourceUpdated(row: EventRow): Promise<ProcessResult> {
  const sourceId = String(row.payload["knowledge_source_id"] ?? "");
  if (!sourceId) return skip("missing_knowledge_source_id_in_payload");

  const admin = createAdminClient();
  const { data: source, error: sourceErr } = await admin
    .from("ai_knowledge_sources")
    .select("id, agent_id, source_type, source_metadata, status")
    .eq("id", sourceId)
    .eq("organization_id", row.organization_id)
    .maybeSingle();

  if (sourceErr) return { type: "error", detail: `knowledge_source_lookup_failed: ${sourceErr.message}` };
  if (!source) return skip("knowledge_source_not_found_for_org");
  if (source.source_type !== "policy") return skip(`unsupported_knowledge_source_type:${source.source_type}`);

  const metadata = (source.source_metadata ?? {}) as Record<string, unknown>;
  const blobPath = typeof metadata.blob_path === "string" ? metadata.blob_path : "";
  const filename = typeof metadata.filename === "string" ? metadata.filename : "";
  const ext = filename.toLowerCase().endsWith(".pdf") ? "pdf" : filename.toLowerCase().endsWith(".md") ? "md" : null;
  if (!blobPath || !ext) return skip("policy_blob_metadata_missing_or_invalid");

  const agentId = source.agent_id;
  const debounceKey = `rag:debounce:${row.organization_id}:${agentId}:knowledge_source:${sourceId}`;
  if (!(await acquireDebounce(debounceKey, DEBOUNCE_TTL_SEC))) {
    return skip("debounced");
  }

  let versionId: string | undefined;
  try {
    const ingested = await ingestPolicyFile({
      organizationId: row.organization_id,
      agentId,
      knowledgeSourceId: sourceId,
      blobPath,
      ext,
    });
    if (ingested.chunks.length === 0) return skip("no_chunks_generated");

    const created = await createKnowledgeVersion({
      agentId,
      organizationId: row.organization_id,
      sourceType: "policy",
    });
    versionId = created.versionId;

    for (const [position, content] of ingested.chunks.entries()) {
      const embedding = await embedText(content, { organizationId: row.organization_id });
      const { error: upsertErr } = await admin
        .from("ai_chunks")
        .upsert(
          {
            organization_id: row.organization_id,
            kb_version_id: versionId,
            knowledge_source_id: sourceId,
            position,
            content,
            content_hash: computeContentHash(content),
            token_count: estimateTokenCount(content),
            embedding: embedding.embedding as unknown as string,
            metadata: { source_type: "policy", filename },
          },
          { onConflict: "organization_id,kb_version_id,content_hash", ignoreDuplicates: true },
        );
      if (upsertErr) throw new Error(`policy_chunk_upsert_failed at chunk ${position}: ${upsertErr.message}`);
    }

    await markVersionReady(versionId, row.organization_id, ingested.chunks.length);
    await activateVersion({ agentId, versionId, organizationId: row.organization_id });
    return { type: "ok", versionId, chunkCount: ingested.chunks.length };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if (versionId) await markVersionFailed(versionId, row.organization_id, detail).catch(() => undefined);
    return { type: "error", detail: `policy_reindex_failed: ${detail}` };
  }
}

// ---------------------------------------------------------------------------
// Main processor — exported for handler adapter + unit tests
// ---------------------------------------------------------------------------

export async function processRagIndexer(row: EventRow): Promise<HandlerResult> {
  const consumerKey = "rag-indexer.v1";

  // Lag monitor (IA-11)
  const lagMs = Date.now() - new Date(row.payload["created_at"] as string ?? row.id).getTime();
  if (lagMs > LAG_WARN_MS) {
    console.warn(
      `[rag-indexer] lag exceeded 5min: ${Math.round(lagMs / 1000)}s for event ${row.id} (${row.event_type})`,
    );
  }

  // Guard: embedding provider must be configured.
  if (!isEmbeddingProviderConfigured()) {
    return { consumer_key: consumerKey, status: "skipped", detail: "openai_key_missing" };
  }

  if (row.event_type === "knowledge_source.updated") {
    const result = await handleKnowledgeSourceUpdated(row);
    if (result.type === "skip") return { consumer_key: consumerKey, status: "skipped", detail: result.reason };
    if (result.type === "error") return { consumer_key: consumerKey, status: "error", detail: result.detail };
    return { consumer_key: consumerKey, status: "ok", detail: `version=${result.versionId} chunks=${result.chunkCount}` };
  }

  // Resolve the active agent for this org.
  let agentId: string;
  try {
    const agent = await resolveAgent(row.organization_id);
    if (!agent) {
      return { consumer_key: consumerKey, status: "skipped", detail: "agent_inactive_or_missing" };
    }
    agentId = agent.id;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[rag-indexer] resolveAgent failed:", detail);
    return { consumer_key: consumerKey, status: "error", detail };
  }

  // Debounce key scoped to (org, agent, event_type) to coalesce bursts.
  const debounceKey = `rag:debounce:${row.organization_id}:${agentId}:${row.event_type}`;
  const acquired = await acquireDebounce(debounceKey, DEBOUNCE_TTL_SEC);
  if (!acquired) {
    return { consumer_key: consumerKey, status: "skipped", detail: "debounced" };
  }

  let versionId: string | undefined;

  try {
    let result: ProcessResult;

    switch (row.event_type) {
      case "nuvemshop.product_synced":
        result = await handleProductSynced(row, agentId);
        break;

      default:
        return { consumer_key: consumerKey, status: "skipped", detail: `unhandled_event:${row.event_type}` };
    }

    if (result.type === "skip") {
      return { consumer_key: consumerKey, status: "skipped", detail: result.reason };
    }

    if (result.type === "error") {
      if (versionId) {
        await markVersionFailed(versionId, row.organization_id, result.detail).catch(() => {
          // best-effort
        });
      }
      return { consumer_key: consumerKey, status: "error", detail: result.detail };
    }

    // type === "ok"
    versionId = result.versionId;
    return {
      consumer_key: consumerKey,
      status: "ok",
      detail: `version=${result.versionId} chunks=${result.chunkCount}`,
    };
  } catch (err) {
    // Global catch — worker must NOT throw.
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[rag-indexer] unhandled error:", detail);

    if (versionId) {
      await markVersionFailed(versionId, row.organization_id, detail).catch(() => {
        // best-effort
      });
    }

    return { consumer_key: consumerKey, status: "error", detail };
  }
}
