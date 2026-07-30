"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight as ArrowUpRight, ChartBar as Coins, Play, Robot as Bot, Sparkle, Users } from "@/lib/ui/icons";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { costSeries, squads as fallbackSquads } from "@/lib/nucleo/mock-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface NucleoDashboardProps { readonly mode?: "cockpit" | "squads" | "command"; }
type Squad = (typeof fallbackSquads)[number] & { id?: string };
type Cockpit = { squads: number; agents: number; runs_today: number; cost_cents_today: number; cost_series: typeof costSeries };

function reais(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor / 100);
}

export function NucleoDashboard({ mode = "cockpit" }: NucleoDashboardProps) {
  const [liveSquads, setLiveSquads] = useState<Squad[] | null>(null);
  const [cockpit, setCockpit] = useState<Cockpit | null>(null);

  useEffect(() => {
    void Promise.all([
      fetch("/api/nucleo/squads").then(async (response) => response.ok ? (await response.json()).data as Squad[] : null),
      fetch("/api/nucleo/cockpit").then(async (response) => response.ok ? (await response.json()).data as Cockpit : null),
    ]).then(([nextSquads, nextCockpit]) => {
      if (nextSquads) setLiveSquads(nextSquads);
      if (nextCockpit) setCockpit(nextCockpit);
    }).catch(() => undefined);
  }, []);

  const squads = liveSquads ?? fallbackSquads;
  const isLive = liveSquads !== null || cockpit !== null;
  const metrics = useMemo(() => [
    { label: "Squads ativos", value: String(cockpit?.squads ?? squads.length), icon: Users },
    { label: "Agentes disponíveis", value: String(cockpit?.agents ?? squads.reduce((total, squad) => total + squad.agents, 0)), icon: Bot },
    { label: "Runs hoje", value: cockpit ? String(cockpit.runs_today) : "—", icon: Play },
    { label: "Custo estimado", value: cockpit ? reais(cockpit.cost_cents_today) : "R$ 0,00", icon: Coins },
  ], [cockpit, squads]);

  if (mode === "command") return <CommandRoom squads={squads} />;

  return <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-medium text-primary">Núcleo de Inteligência Operacional</p><h1 className="text-3xl font-semibold tracking-tight">{mode === "squads" ? "Squads" : "Cockpit executivo"}</h1><p className="mt-1 text-sm text-muted-foreground">{mode === "squads" ? "Catálogo operacional dos especialistas disponíveis." : "Visão de decisão, capacidade e custo da operação assistida."}</p></div>
      <Button asChild><Link href="/app/nucleo/command"><Sparkle className="mr-2 size-4" />Abrir Sala de Comando</Link></Button>
    </header>
    {mode === "cockpit" && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, icon: Icon }) => <Card key={label}><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div><Icon className="size-5 text-primary" /></CardContent></Card>)}</section>
      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]"><Card><CardHeader><CardTitle>Custo por dia</CardTitle><CardDescription>{isLive ? "Telemetria live da organização ativa." : "Mostrando dados locais até autenticar no Núcleo."}</CardDescription></CardHeader><CardContent className="h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={cockpit?.cost_series.length ? cockpit.cost_series : costSeries}><defs><linearGradient id="cost" x1="0" x2="0" y1="0" y2="1"><stop stopColor="currentColor" stopOpacity=".35"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs><XAxis dataKey="day" axisLine={false} tickLine={false}/><Tooltip/><Area dataKey="cost" stroke="hsl(var(--primary))" fill="url(#cost)" /></AreaChart></ResponsiveContainer></CardContent></Card><Card><CardHeader><CardTitle>Próxima ação</CardTitle><CardDescription>Concluir a conexão live do RAG.</CardDescription></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">A interface já lê catálogo, capacidade, runs e custo sem alterar sua estrutura visual.</p></CardContent></Card></section>
    </>}
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{squads.map((squad) => <Card key={squad.slug} className="transition-shadow hover:shadow-md"><CardHeader className="pb-3"><CardDescription>{squad.status}</CardDescription><CardTitle>{squad.name}</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{squad.focus}</p><div className="mt-5 flex items-center justify-between text-sm"><span>{squad.agents} agentes</span><Link className="inline-flex items-center gap-1 text-primary" href="/app/nucleo/command">Acionar <ArrowUpRight className="size-3" /></Link></div></CardContent></Card>)}</section>
  </div>;
}

function CommandRoom({ squads }: { squads: readonly Squad[] }) {
  const [selected, setSelected] = useState<Squad>(squads[0] ?? fallbackSquads[0]);
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("Olá. Escolha um especialista e descreva a decisão que precisa tomar.");
  const [running, setRunning] = useState(false);

  async function invoke(): Promise<void> {
    if (!message.trim() || !selected.chief_agent_id) return;
    setRunning(true);
    try {
      const res = await fetch(`/api/nucleo/agents/${selected.chief_agent_id}/invoke`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      const payload = await res.json() as { data?: { final_text?: string }; error?: { message?: string } };
      setResponse(payload.data?.final_text ?? payload.error?.message ?? "Não foi possível executar o agente.");
    } catch { setResponse("Não foi possível conectar à Sala de Comando."); }
    finally { setRunning(false); }
  }

  return <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[280px_1fr]"><Card><CardHeader><CardTitle>Especialistas</CardTitle><CardDescription>Escolha o chief do squad.</CardDescription></CardHeader><CardContent className="space-y-2">{squads.map((squad) => <button key={squad.slug} onClick={() => setSelected(squad)} className={`w-full rounded-md border p-3 text-left text-sm hover:bg-accent ${selected.slug === squad.slug ? "border-primary bg-accent" : ""}`}><strong>{squad.name}</strong><span className="block text-xs text-muted-foreground">{squad.focus}</span></button>)}</CardContent></Card><Card className="min-h-[520px]"><CardHeader><CardTitle>{selected.name} Chief</CardTitle><CardDescription>Sala de Comando · simulação segura</CardDescription></CardHeader><CardContent className="flex h-[420px] flex-col justify-between"><div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">{response}</div><div className="flex gap-2"><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void invoke(); }} className="flex-1 rounded-md border bg-background px-3 py-2 text-sm" placeholder="Descreva a decisão que precisa tomar…"/><Button disabled={running || !selected.chief_agent_id || !message.trim()} onClick={() => void invoke()}>{running ? "Enviando…" : "Enviar"}</Button></div>{!selected.chief_agent_id && <p className="mt-2 text-xs text-muted-foreground">A simulação ficará disponível assim que o chief for publicado na F4.</p>}</CardContent></Card></div>;
}
