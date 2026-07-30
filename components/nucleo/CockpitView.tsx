"use client";

import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { reais } from "@/lib/nucleo/presentation";
import type { NucleoDashboardInitialData } from "@/lib/nucleo/types";
import { ChartBar, Play, Robot, Users } from "@/lib/ui/icons";

import { NucleoPageHeader } from "./NucleoPageHeader";
import { OperationalError } from "./OperationalError";
import { SquadsGrid } from "./SquadsGrid";

interface CockpitViewProps {
  readonly initialData: NucleoDashboardInitialData | null;
  readonly initialError: string | null;
}

export function CockpitView({ initialData, initialError }: CockpitViewProps) {
  const squads = initialData?.squads ?? [];
  const cockpit = initialData?.cockpit ?? null;
  const metrics = cockpit
    ? [
        { label: "Squads ativos", value: String(cockpit.squads), icon: Users },
        { label: "Agentes publicados", value: String(cockpit.published_agents), icon: Robot },
        { label: "Runs hoje", value: String(cockpit.runs_today), icon: Play },
        { label: "Custo hoje", value: reais(cockpit.cost_cents_today), icon: ChartBar },
      ]
    : [];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <NucleoPageHeader
        title="Cockpit executivo"
        subtitle="Capacidade, custos, decisões e CRM da organização ativa."
        cta={{ href: "/app/nucleo/command", label: "Abrir Sala de Comando" }}
      />
      <OperationalError message={initialError} />
      {cockpit && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="mt-1 text-2xl font-semibold">{value}</p>
                  </div>
                  <Icon className="size-5 text-primary" />
                </CardContent>
              </Card>
            ))}
          </section>
          <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Custo por dia</CardTitle>
                <CardDescription>Telemetria OpenRouter da organização ativa.</CardDescription>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cockpit.cost_series}>
                    <defs>
                      <linearGradient id="cost" x1="0" x2="0" y1="0" y2="1">
                        <stop stopColor="currentColor" stopOpacity=".35" />
                        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => reais(Number(value))} />
                    <Area dataKey="cost" stroke="hsl(var(--primary))" fill="url(#cost)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Fila de decisão</CardTitle>
                <CardDescription>Ações sempre exigem aprovação humana.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  <strong>{cockpit.pending_actions}</strong> ações pendentes
                </p>
                <p>
                  <strong>{cockpit.open_simulations}</strong> simulações abertas
                </p>
                <p>
                  <strong>{cockpit.open_leads}</strong> leads ativos no CRM
                </p>
                <Button variant="outline" asChild>
                  <Link href="/app/nucleo/command">Revisar propostas</Link>
                </Button>
              </CardContent>
            </Card>
          </section>
        </>
      )}
      <SquadsGrid squads={squads} />
      {!initialError && squads.length === 0 && (
        <p className="rounded-md border p-4 text-sm text-muted-foreground">
          Nenhum squad foi carregado. Rode o seed local do Núcleo antes de utilizar o painel.
        </p>
      )}
    </main>
  );
}
