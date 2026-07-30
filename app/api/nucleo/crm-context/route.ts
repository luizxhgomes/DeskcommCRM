/** GET /api/nucleo/crm-context — opções seguras para propostas humanas no CRM. */
import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "nucleo_command" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const [{ data: pipelines, error: pipelineError }, { data: leads, error: leadsError }] = await Promise.all([
    supabase
      .from("crm_pipelines")
      .select("id, name, slug, crm_stages(id, name, position)")
      .eq("organization_id", authz.org.orgId)
      .eq("is_archived", false)
      .order("created_at")
      // Sem esta ordenação as etapas chegam em ordem arbitrária e o seletor
      // deixa de refletir o funil — inclusive expondo etapas terminais antes
      // das iniciais.
      .order("position", { referencedTable: "crm_stages" }),
    supabase
      .from("crm_leads")
      .select("id, title, pipeline_id, stage_id, status")
      .eq("organization_id", authz.org.orgId)
      .eq("status", "open")
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);
  if (pipelineError || leadsError) return fail("internal_error", "Não foi possível carregar as opções do CRM.", 500, { requestId });
  return ok({ pipelines: pipelines ?? [], leads: leads ?? [] }, { requestId });
}
