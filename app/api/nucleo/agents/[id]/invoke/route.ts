/**
 * POST /api/nucleo/agents/:id/invoke
 *
 * Executa somente a versão já publicada do agente em modo de simulação. Não
 * cria mensagem, conversa ou despacho para canal externo; a Sala de Comando
 * permanece um espaço seguro de decisão até a fase de publicação operacional.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invokeSchema = z.object({ message: z.string().trim().min(1).max(4000) }).strict();
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  if (!UUID_RX.test(id)) return fail("invalid_request", "Identificador do agente inválido.", 400, { requestId });

  // Uma invocação pode consumir saldo da organização: a mesma proteção do
  // endpoint nativo de teste é deliberada, em vez de expor o runtime a viewers.
  const authz = await requireRole("admin", { requestId, resource: "nucleo_command" });
  if (!authz.ok) return authz.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("invalid_request", "Body JSON inválido.", 400, { requestId });
  }
  const parsed = invokeSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Mensagem inválida.", 422, { requestId });

  const admin = createAdminClient();
  const { data: version, error } = await admin
    .from("ai_agent_versions")
    .select("id, channel_session_id")
    .eq("organization_id", authz.org.orgId)
    .eq("agent_id", id)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return fail("internal_error", "Não foi possível localizar a versão do agente.", 500, { requestId });
  if (!version) {
    return fail("nucleo_agent_not_ready", "Este agente ainda não possui uma versão publicada para a Sala de Comando.", 409, { requestId });
  }

  const { data: run, error: runError } = await admin
    .from("ai_agent_runs")
    .insert({
      organization_id: authz.org.orgId,
      agent_id: id,
      agent_version_id: version.id,
      channel_session_id: version.channel_session_id,
      status: "running",
      is_dry_run: true,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (runError || !run) return fail("internal_error", "Não foi possível iniciar a simulação.", 500, { requestId });

  try {
    const { runAgent } = await import("@/lib/ai/runtime/agent");
    const result = await runAgent({ runId: run.id, override: { sampleMessage: parsed.data.message } });
    return ok({ ...result, dry_run: true }, { requestId });
  } catch {
    return fail("internal_error", "A execução do agente falhou. Consulte o histórico de runs.", 500, { requestId });
  }
}
