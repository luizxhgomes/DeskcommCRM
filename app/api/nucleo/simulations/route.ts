import { randomInt, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().trim().min(2).max(160),
  contact_name: z.string().trim().min(2).max(120),
  message: z.string().trim().min(1).max(4000),
});

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "nucleo_simulations" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("nucleo_simulations")
    .select("id, title, status, contact_id, conversation_id, lead_id, created_at, updated_at")
    .eq("organization_id", authz.org.orgId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return fail("internal_error", "Não foi possível carregar as simulações.", 500, { requestId });
  return ok(data ?? [], { requestId });
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "nucleo_simulations" });
  if (!authz.ok) return authz.response;
  let raw: unknown;
  try { raw = await request.json(); } catch { return fail("invalid_request", "Body JSON inválido.", 400, { requestId }); }
  const input = createSchema.safeParse(raw);
  if (!input.success) return fail("validation_failed", "Dados da simulação inválidos.", 422, { requestId, details: input.error.flatten() });

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("channel_sessions")
    .select("id")
    .eq("organization_id", authz.org.orgId)
    .eq("waha_session_name", "nucleo-hq")
    .maybeSingle();
  if (!session) return fail("nucleo_session_missing", "A sessão local do Núcleo ainda não foi criada pelo seed.", 409, { requestId });

  // Somente dígitos: contacts_phone_e164_format exige ^\+\d{8,15}$ — um slice
  // de UUID contém hex (a–f) e estoura o CHECK de forma intermitente.
  const simulationPhone = `+55000${randomInt(0, 1_000_000_000).toString().padStart(9, "0")}`;
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .insert({
      organization_id: authz.org.orgId,
      name: input.data.contact_name,
      display_name: input.data.contact_name,
      phone_number: simulationPhone,
      source: "nucleo_simulation",
      source_metadata: { simulation: true },
      created_by_user_id: authz.user.id,
    })
    .select("id")
    .single();
  if (contactError || !contact) return fail("internal_error", "Não foi possível criar o contato simulado.", 500, { requestId });

  const now = new Date().toISOString();
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .insert({
      organization_id: authz.org.orgId,
      contact_id: contact.id,
      channel_session_id: session.id,
      channel: "whatsapp",
      status: "open",
      last_inbound_at: now,
      last_message_at: now,
      last_message_preview: input.data.message.slice(0, 280),
      metadata: { nucleo_simulation: true },
    })
    .select("id")
    .single();
  if (conversationError || !conversation) return fail("internal_error", "Não foi possível criar a conversa simulada.", 500, { requestId });

  const { error: messageError } = await supabase.from("messages").insert({
    organization_id: authz.org.orgId,
    conversation_id: conversation.id,
    channel_session_id: session.id,
    contact_id: contact.id,
    type: "text",
    direction: "inbound",
    status: "received",
    body: input.data.message,
    sent_via: "system",
    metadata: { nucleo_simulation: true },
  });
  if (messageError) return fail("internal_error", "Não foi possível registrar a mensagem simulada.", 500, { requestId });

  const { data: simulation, error: simulationError } = await supabase
    .from("nucleo_simulations")
    .insert({
      organization_id: authz.org.orgId,
      title: input.data.title,
      contact_id: contact.id,
      conversation_id: conversation.id,
      created_by: authz.user.id,
      metadata: { initial_message: input.data.message },
    })
    .select("id, title, contact_id, conversation_id, status, created_at")
    .single();
  if (simulationError || !simulation) return fail("internal_error", "Não foi possível finalizar a simulação.", 500, { requestId });
  return ok({ ...simulation, message: input.data.message }, { requestId, status: 201 });
}
