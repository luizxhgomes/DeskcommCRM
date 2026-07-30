"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight as ArrowUpRight, ChartBar as Coins, Play, Robot as Bot, Sparkle, Users } from "@/lib/ui/icons";

interface NucleoDashboardProps {
  readonly mode?: "cockpit" | "squads" | "command";
}

type Squad = {
  id: string;
  slug: string;
  name: string;
  agents: number;
  chief_agent_id: string | null;
  focus: string;
  status: string;
};
type CostPoint = { day: string; cost: number };
type Cockpit = {
  squads: number;
  agents: number;
  published_agents: number;
  runs_today: number;
  cost_cents_today: number;
  pending_actions: number;
  open_simulations: number;
  open_leads: number;
  cost_series: CostPoint[];
};
type Simulation = {
  id: string;
  title: string;
  status: string;
  contact_id: string | null;
  conversation_id: string | null;
  lead_id: string | null;
  created_at: string;
};
type CommandAction = {
  id: string;
  run_id: string;
  action_kind: string;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "applied" | "rejected" | "failed";
  result?: Record<string, unknown>;
  error_code?: string | null;
};
type RagSource = { knowledge_source_id: string | null; similarity: number | null; excerpt: string };
type SimulationDetail = Simulation & {
  messages: Array<{ id: string; body: string | null; direction: "inbound" | "outbound"; sent_at: string }>;
  actions: CommandAction[];
  activities: Array<{ id: string; type: string; reason: string | null; created_at: string }>;
  contacts?: { id: string; name: string | null } | null;
  crm_leads?: { id: string; title: string; stage_id: string; status: string } | null;
};
type Pipeline = { id: string; name: string; crm_stages: Array<{ id: string; name: string; position: number }> | null };
type CrmContext = { pipelines: Pipeline[]; leads: Array<{ id: string; title: string; stage_id: string }> };
type ApiEnvelope<T> = { data?: T; error?: { message?: string } };

function reais(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "A operação não pôde ser concluída.");
  return payload.data;
}

function OperationalError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{message}</p>;
}

export function NucleoDashboard({ mode = "cockpit" }: NucleoDashboardProps) {
  const [squads, setSquads] = useState<Squad[]>([]);
  const [cockpit, setCockpit] = useState<Cockpit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([request<Squad[]>("/api/nucleo/squads"), request<Cockpit>("/api/nucleo/cockpit")])
      .then(([nextSquads, nextCockpit]) => {
        setSquads(nextSquads);
        setCockpit(nextCockpit);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Não foi possível carregar o Núcleo."))
      .finally(() => setLoading(false));
  }, []);

  if (mode === "command") return <CommandRoom squads={squads} loading={loading} />;
  const metrics = [
    { label: "Squads ativos", value: cockpit ? String(cockpit.squads) : "—", icon: Users },
    { label: "Agentes publicados", value: cockpit ? String(cockpit.published_agents) : "—", icon: Bot },
    { label: "Runs hoje", value: cockpit ? String(cockpit.runs_today) : "—", icon: Play },
    { label: "Custo hoje", value: cockpit ? reais(cockpit.cost_cents_today) : "—", icon: Coins },
  ];

  return <main className="mx-auto flex w-full max-w-7xl flex-col gap-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-medium text-primary">Núcleo de Inteligência Operacional</p>
        <h1 className="text-3xl font-semibold tracking-tight">{mode === "squads" ? "Squads" : "Cockpit executivo"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{mode === "squads" ? "Catálogo live de especialistas, skills e publicação." : "Capacidade, custos, decisões e CRM da organização ativa."}</p>
      </div>
      <Button asChild><Link href="/app/nucleo/command"><Sparkle className="mr-2 size-4" />Abrir Sala de Comando</Link></Button>
    </header>
    <OperationalError message={error} />
    {loading && <p className="text-sm text-muted-foreground">Carregando dados operacionais…</p>}
    {mode === "cockpit" && cockpit && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, icon: Icon }) => <Card key={label}><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div><Icon className="size-5 text-primary" /></CardContent></Card>)}</section>
      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card><CardHeader><CardTitle>Custo por dia</CardTitle><CardDescription>Telemetria OpenRouter da organização ativa.</CardDescription></CardHeader><CardContent className="h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={cockpit.cost_series}><defs><linearGradient id="cost" x1="0" x2="0" y1="0" y2="1"><stop stopColor="currentColor" stopOpacity=".35"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs><XAxis dataKey="day" axisLine={false} tickLine={false}/><Tooltip formatter={(value) => reais(Number(value))}/><Area dataKey="cost" stroke="hsl(var(--primary))" fill="url(#cost)" /></AreaChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle>Fila de decisão</CardTitle><CardDescription>Ações sempre exigem aprovação humana.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><p><strong>{cockpit.pending_actions}</strong> ações pendentes</p><p><strong>{cockpit.open_simulations}</strong> simulações abertas</p><p><strong>{cockpit.open_leads}</strong> leads ativos no CRM</p><Button variant="outline" asChild><Link href="/app/nucleo/command">Revisar propostas</Link></Button></CardContent></Card>
      </section>
    </>}
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{squads.map((squad) => <Card key={squad.slug} className="transition-shadow hover:shadow-md"><CardHeader className="pb-3"><CardDescription>{squad.status}</CardDescription><CardTitle>{squad.name}</CardTitle></CardHeader><CardContent><p className="min-h-10 text-sm text-muted-foreground">{squad.focus}</p><div className="mt-5 flex items-center justify-between text-sm"><span>{squad.agents} agentes</span><Link className="inline-flex items-center gap-1 text-primary" href={`/app/nucleo/squads/${squad.slug}`}>Detalhar <ArrowUpRight className="size-3" /></Link></div></CardContent></Card>)}</section>
    {!loading && !error && squads.length === 0 && <p className="rounded-md border p-4 text-sm text-muted-foreground">Nenhum squad foi carregado. Rode o seed local do Núcleo antes de utilizar o painel.</p>}
  </main>;
}

export function SquadDetail({ slug }: { slug: string }) {
  const [detail, setDetail] = useState<{ name: string; manifest: { description?: string } | null; skills: number; chief: { id: string; name: string; published: boolean } | null; agents: Array<{ id: string; name: string; description: string | null; role: string; tier: number; published: boolean }> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void request<typeof detail>(`/api/nucleo/squads/${slug}`).then(setDetail).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Não foi possível carregar o squad.")); }, [slug]);
  return <main className="mx-auto flex w-full max-w-6xl flex-col gap-6"><Link className="text-sm text-primary" href="/app/nucleo/squads">← Voltar aos squads</Link><OperationalError message={error} />{!detail ? !error && <p className="text-sm text-muted-foreground">Carregando squad…</p> : <><header><p className="text-sm font-medium text-primary">Squad operacional</p><h1 className="text-3xl font-semibold">{detail.name}</h1><p className="mt-1 text-muted-foreground">{detail.manifest?.description ?? "Especialistas e skills compilados."}</p></header><section className="grid gap-4 md:grid-cols-3"><Card><CardHeader><CardDescription>Chief</CardDescription><CardTitle className="text-lg">{detail.chief?.name ?? "Não definido"}</CardTitle></CardHeader><CardContent className="text-sm">{detail.chief?.published ? "Publicado e disponível." : "Ainda não publicado."}</CardContent></Card><Card><CardHeader><CardDescription>Agentes</CardDescription><CardTitle>{detail.agents.length}</CardTitle></CardHeader></Card><Card><CardHeader><CardDescription>Skills</CardDescription><CardTitle>{detail.skills}</CardTitle></CardHeader></Card></section><Card><CardHeader><CardTitle>Catálogo de agentes</CardTitle><CardDescription>Publicação e tier reais.</CardDescription></CardHeader><CardContent className="divide-y">{detail.agents.map((agent) => <div className="flex items-center justify-between gap-4 py-3 text-sm" key={agent.id}><div><p className="font-medium">{agent.name}</p><p className="text-muted-foreground">{agent.description ?? "Sem descrição"}</p></div><div className="text-right"><p>Tier {agent.tier} · {agent.role}</p><p className={agent.published ? "text-primary" : "text-muted-foreground"}>{agent.published ? "Publicado" : "Rascunho"}</p></div></div>)}</CardContent></Card><Button asChild disabled={!detail.chief?.published}><Link href="/app/nucleo/command">Acionar chief na Sala de Comando</Link></Button></>}</main>;
}

function CommandRoom({ squads, loading }: { squads: Squad[]; loading: boolean }) {
  const [selected, setSelected] = useState<Squad | null>(null);
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [simulation, setSimulation] = useState<SimulationDetail | null>(null);
  const [crm, setCrm] = useState<CrmContext>({ pipelines: [], leads: [] });
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("Teste de qualificação comercial");
  const [contactName, setContactName] = useState("Contato de teste");
  const [initialMessage, setInitialMessage] = useState("Quero entender como vocês podem me ajudar a organizar o processo comercial.");
  const [leadTitle, setLeadTitle] = useState("Oportunidade criada pelo Núcleo");
  const [stageId, setStageId] = useState("");
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [response, setResponse] = useState("Crie uma conversa simulada, escolha um chief publicado e envie uma solicitação.");
  const [ragSources, setRagSources] = useState<RagSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void Promise.all([request<Simulation[]>("/api/nucleo/simulations"), request<CrmContext>("/api/nucleo/crm-context")]).then(([nextSimulations, nextCrm]) => { setSimulations(nextSimulations); setCrm(nextCrm); const firstStage = nextCrm.pipelines[0]?.crm_stages?.[0]; if (firstStage) setStageId(firstStage.id); }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Não foi possível preparar a Sala de Comando.")); }, []);

  const selectedSquad = selected ?? squads[0] ?? null;
  const stages = useMemo(() => crm.pipelines.flatMap((pipeline) => (pipeline.crm_stages ?? []).map((stage) => ({ ...stage, pipelineId: pipeline.id, pipelineName: pipeline.name }))), [crm]);
  async function loadSimulation(id: string): Promise<void> {
    const next = await request<SimulationDetail>(`/api/nucleo/simulations/${id}`);
    setSimulation(next);
    setSimulations((current) => current.map((row) => row.id === id ? { ...row, lead_id: next.lead_id } : row));
  }
  async function createSimulation(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setBusy(true); setError(null);
    try { const created = await request<Simulation & { message: string }>("/api/nucleo/simulations", { method: "POST", body: JSON.stringify({ title, contact_name: contactName, message: initialMessage }) }); setSimulations((current) => [created, ...current]); await loadSimulation(created.id); setMessage(created.message); setResponse("Conversa criada. Agora envie a solicitação ao chief publicado."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível criar a simulação."); }
    finally { setBusy(false); }
  }
  async function invoke(): Promise<void> {
    if (!selectedSquad?.chief_agent_id || !message.trim()) return;
    setBusy(true); setError(null);
    try { const output = await request<{ run_id: string; final_text?: string; actions?: CommandAction[]; rag_sources?: RagSource[] }>(`/api/nucleo/agents/${selectedSquad.chief_agent_id}/invoke`, { method: "POST", body: JSON.stringify({ message, simulation_id: simulation?.id }) }); setLastRunId(output.run_id); setResponse(output.final_text ?? "O agente concluiu a execução sem texto final."); setRagSources(output.rag_sources ?? []); setMessage(""); if (simulation) await loadSimulation(simulation.id); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível executar o agente."); }
    finally { setBusy(false); }
  }
  async function proposeLead(): Promise<void> {
    const stage = stages.find((candidate) => candidate.id === stageId);
    if (!lastRunId || !stage) { setError("Execute o agente e selecione uma etapa antes de propor o lead."); return; }
    setBusy(true); setError(null);
    try { await request<CommandAction>(`/api/nucleo/runs/${lastRunId}/actions`, { method: "POST", body: JSON.stringify({ simulation_id: simulation?.id, action_kind: "create_lead", payload: { pipeline_id: stage.pipelineId, stage_id: stage.id, title: leadTitle, contact_id: simulation?.contact_id ?? undefined } }) }); if (simulation) await loadSimulation(simulation.id); setResponse("Proposta criada. Revise e aprove para aplicá-la no CRM."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível registrar a proposta."); }
    finally { setBusy(false); }
  }
  async function proposeMove(): Promise<void> {
    const stage = stages.find((candidate) => candidate.id === stageId);
    if (!lastRunId || !stage || !simulation?.lead_id) { setError("Crie e aplique um lead antes de propor sua movimentação."); return; }
    setBusy(true); setError(null);
    try { await request<CommandAction>(`/api/nucleo/runs/${lastRunId}/actions`, { method: "POST", body: JSON.stringify({ simulation_id: simulation.id, action_kind: "move_lead_stage", payload: { lead_id: simulation.lead_id, stage_id: stage.id, reason: "Aprovado na Sala de Comando do Núcleo" } }) }); await loadSimulation(simulation.id); setResponse("Movimentação proposta. Revise e aprove antes de alterar o pipeline."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível registrar a movimentação."); }
    finally { setBusy(false); }
  }
  async function apply(action: CommandAction): Promise<void> {
    setBusy(true); setError(null);
    try { await request<{ status: string }>(`/api/nucleo/runs/${action.run_id}/actions/${action.id}/apply`, { method: "POST", body: "{}" }); if (simulation) await loadSimulation(simulation.id); setResponse("Ação aprovada e aplicada no CRM. O histórico foi atualizado."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível aplicar a ação."); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[280px_1fr]">
    <Card><CardHeader><CardTitle>Especialistas</CardTitle><CardDescription>Chiefs publicados do catálogo.</CardDescription></CardHeader><CardContent className="space-y-2">{loading && <p className="text-sm text-muted-foreground">Carregando…</p>}{squads.map((squad) => <button type="button" aria-label={`Selecionar squad ${squad.name}`} key={squad.slug} onClick={() => setSelected(squad)} className={`w-full rounded-md border p-3 text-left text-sm hover:bg-accent ${selectedSquad?.slug === squad.slug ? "border-primary bg-accent" : ""}`}><strong>{squad.name}</strong><span className="block text-xs text-muted-foreground">{squad.focus}</span>{!squad.chief_agent_id && <span className="block pt-1 text-xs text-destructive">Chief indisponível</span>}</button>)}</CardContent></Card>
    <div className="space-y-6"><header><p className="text-sm font-medium text-primary">Sala de Comando</p><h1 className="text-3xl font-semibold">{selectedSquad?.name ?? "Selecione um squad"}</h1><p className="mt-1 text-sm text-muted-foreground">Simulação interna: nenhuma mensagem é enviada ao WhatsApp.</p></header><OperationalError message={error} />
      {!simulation ? <Card><CardHeader><CardTitle>1. Criar conversa simulada</CardTitle><CardDescription>O contato e a conversa ficam no CRM local para validação completa.</CardDescription></CardHeader><CardContent><form className="grid gap-3" onSubmit={(event) => void createSimulation(event)}><input className="rounded-md border bg-background px-3 py-2" value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Título da simulação" required/><input className="rounded-md border bg-background px-3 py-2" value={contactName} onChange={(event) => setContactName(event.target.value)} aria-label="Nome do contato" required/><textarea className="min-h-24 rounded-md border bg-background px-3 py-2" value={initialMessage} onChange={(event) => setInitialMessage(event.target.value)} aria-label="Mensagem inicial" required/><Button type="submit" disabled={busy}>Criar conversa de teste</Button></form></CardContent></Card> : <Card><CardHeader><CardTitle>Conversa: {simulation.title}</CardTitle><CardDescription>{simulation.lead_id ? "Lead vinculado ao CRM." : "Sem lead vinculado até uma proposta ser aprovada."}</CardDescription></CardHeader><CardContent className="space-y-4">{simulation.messages.map((item) => <div key={item.id} className={`rounded-lg p-3 text-sm ${item.direction === "outbound" ? "ml-8 bg-primary/10" : "mr-8 bg-muted"}`}><p className="mb-1 text-xs text-muted-foreground">{item.direction === "outbound" ? "Agente" : "Contato"}</p>{item.body}</div>)}{simulation.messages.length === 0 && <p className="text-sm text-muted-foreground">Ainda não há mensagens registradas.</p>}{simulation.crm_leads && <div className="rounded-md border p-3 text-sm"><p className="font-medium">CRM: {simulation.crm_leads.title}</p><p className="text-muted-foreground">Lead {simulation.crm_leads.status} · etapa {stages.find((stage) => stage.id === simulation.crm_leads?.stage_id)?.name ?? "não identificada"}</p></div>}{simulation.lead_id && <div className="rounded-md border p-3 text-sm"><p className="font-medium">Timeline oficial do lead</p>{simulation.activities.length > 0 ? <ul className="mt-2 space-y-1 text-muted-foreground">{simulation.activities.map((activity) => <li key={activity.id}>{activity.type}{activity.reason ? ` · ${activity.reason}` : ""}</li>)}</ul> : <p className="mt-1 text-muted-foreground">As atividades aprovadas aparecerão aqui.</p>}</div>}</CardContent></Card>}
      <Card><CardHeader><CardTitle>2. Solicitação ao agente</CardTitle><CardDescription>Resposta OpenRouter em dry-run, registrada no histórico.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="rounded-lg bg-muted p-4 text-sm whitespace-pre-wrap">{response}</div>{lastRunId && <div className="rounded-md border p-3 text-sm"><p className="font-medium">Fontes RAG</p>{ragSources.length > 0 ? <ul className="mt-2 space-y-2 text-muted-foreground">{ragSources.map((source) => <li key={`${source.knowledge_source_id ?? "kb"}:${source.excerpt}`}><p>{source.similarity === null ? "Base ativa" : `${Math.round(source.similarity * 100)}% de similaridade`}</p><p className="text-xs">{source.excerpt}</p></li>)}</ul> : <p className="mt-1 text-muted-foreground">A execução não recuperou trechos da KB ativa.</p>}</div>}<div className="flex gap-2"><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void invoke(); }} className="flex-1 rounded-md border bg-background px-3 py-2 text-sm" placeholder="Descreva a decisão que precisa tomar…"/><Button disabled={busy || !selectedSquad?.chief_agent_id || !message.trim()} onClick={() => void invoke()}>{busy ? "Processando…" : "Enviar"}</Button></div>{!selectedSquad?.chief_agent_id && <p className="text-xs text-destructive">Este squad ainda não possui chief publicado.</p>}</CardContent></Card>
      {lastRunId && <Card><CardHeader><CardTitle>3. Propostas de alteração</CardTitle><CardDescription>Crie, mova, revise e só então aplique no CRM.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]"><input className="rounded-md border bg-background px-3 py-2" value={leadTitle} onChange={(event) => setLeadTitle(event.target.value)} aria-label="Título do lead"/><select className="rounded-md border bg-background px-3 py-2" value={stageId} onChange={(event) => setStageId(event.target.value)} aria-label="Etapa do lead">{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.pipelineName} · {stage.name}</option>)}</select><Button disabled={busy || !stageId} onClick={() => void proposeLead()}>Propor lead</Button>{simulation?.lead_id && <Button variant="outline" disabled={busy || !stageId} onClick={() => void proposeMove()}>Propor movimentação</Button>}</CardContent></Card>}
      {simulation && <Card><CardHeader><CardTitle>4. Aprovação humana</CardTitle><CardDescription>Aplicação idempotente pelos fluxos oficiais do CRM.</CardDescription></CardHeader><CardContent className="space-y-3">{simulation.actions.map((action) => <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between" key={action.id}><div className="text-sm"><p className="font-medium">{action.action_kind}</p><pre className="mt-1 max-w-xl overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{JSON.stringify(action.payload, null, 2)}</pre><p className="mt-1 text-xs text-muted-foreground">Estado: {action.status}{action.error_code ? ` · ${action.error_code}` : ""}</p></div>{action.status === "pending" && <Button aria-label={`Aprovar ${action.action_kind} ${action.id}`} disabled={busy} onClick={() => void apply(action)}>Aprovar e aplicar</Button>}</div>)}{simulation.actions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma alteração pendente. Use “Propor lead” após a execução ou aguarde uma proposta estruturada do agente.</p>}</CardContent></Card>}
      {simulations.length > 0 && <Card><CardHeader><CardTitle>Outras simulações</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{simulations.map((item) => <Button key={item.id} variant="outline" disabled={busy} onClick={() => void loadSimulation(item.id)}>{item.title}</Button>)}</CardContent></Card>}
    </div>
  </main>;
}
