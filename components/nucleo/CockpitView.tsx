"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { EmptyState } from "@/components/empty";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { request } from "@/lib/nucleo/client";
import { reais } from "@/lib/nucleo/presentation";
import type {
  NucleoCockpitSummary,
  NucleoDashboardInitialData,
  NucleoSquadSummary,
} from "@/lib/nucleo/types";
import {
  ArrowsClockwise,
  ChartBar,
  ChatsCircle,
  Play,
  Robot,
  Sparkle,
  Users,
  Warning,
} from "@/lib/ui/icons";

import { CostChart } from "./CostChart";
import { NucleoPageHeader } from "./NucleoPageHeader";
import { OperationalError } from "./OperationalError";
import { SquadsGrid } from "./SquadsGrid";

interface CockpitViewProps {
  readonly initialData: NucleoDashboardInitialData | null;
  readonly initialError: string | null;
}

function horaAgora(): string {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function CockpitView({ initialData, initialError }: CockpitViewProps) {
  const [data, setData] = useState<NucleoDashboardInitialData | null>(initialData);
  const [error, setError] = useState<string | null>(initialError);
  const [refreshing, setRefreshing] = useState(false);
  // Preenchido só após o mount: o horário do cliente no SSR causaria mismatch
  // de hidratação.
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  useEffect(() => {
    if (!initialData) return;
    const frame = requestAnimationFrame(() => setUpdatedAt(horaAgora()));
    return () => cancelAnimationFrame(frame);
  }, [initialData]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [squads, cockpit] = await Promise.all([
        request<NucleoSquadSummary[]>("/api/nucleo/squads"),
        request<NucleoCockpitSummary>("/api/nucleo/cockpit"),
      ]);
      setData({ squads, cockpit });
      setError(null);
      setUpdatedAt(horaAgora());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível atualizar a telemetria.",
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  const squads = data?.squads ?? [];
  const cockpit = data?.cockpit ?? null;
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
      >
        <p aria-live="polite" className="text-xs tabular-nums text-muted-foreground">
          {updatedAt ? `Atualizado às ${updatedAt}` : "—"}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Atualizar dados"
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          <ArrowsClockwise aria-hidden className={refreshing ? "size-4 animate-spin" : "size-4"} />
        </Button>
      </NucleoPageHeader>
      <OperationalError message={error} />
      {cockpit && (
        <>
          <section className="nucleo-enter nucleo-enter-1 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
                  </div>
                  <span className="flex size-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Icon aria-hidden className="size-5" />
                  </span>
                </CardContent>
              </Card>
            ))}
          </section>
          <section className="nucleo-enter nucleo-enter-2 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Custo por dia</CardTitle>
                <CardDescription>Telemetria OpenRouter da organização ativa.</CardDescription>
              </CardHeader>
              <CardContent className="h-56">
                <CostChart series={cockpit.cost_series} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Fila de decisão</CardTitle>
                <CardDescription>Ações sempre exigem aprovação humana.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="flex items-center gap-2">
                  <Warning aria-hidden className="size-4 text-warning" />
                  <strong className="tabular-nums">{cockpit.pending_actions}</strong> ações
                  pendentes
                </p>
                <p className="flex items-center gap-2">
                  <ChatsCircle aria-hidden className="size-4 text-info" />
                  <strong className="tabular-nums">{cockpit.open_simulations}</strong> simulações
                  abertas
                </p>
                <p className="flex items-center gap-2">
                  <Users aria-hidden className="size-4 text-accent" />
                  <strong className="tabular-nums" data-testid="cockpit-open-leads">
                    {cockpit.open_leads}
                  </strong>{" "}
                  leads ativos no CRM
                </p>
                <Button variant="outline" asChild>
                  <Link href="/app/nucleo/command">Revisar propostas</Link>
                </Button>
              </CardContent>
            </Card>
          </section>
        </>
      )}
      <div className="nucleo-enter nucleo-enter-3">
        <SquadsGrid squads={squads} />
        {!error && squads.length === 0 && (
          <EmptyState
            icon={Sparkle}
            headline="Nenhum squad carregado"
            subcopy="Rode o seed local do Núcleo (make seed) para materializar os squads desta organização e atualize."
            primary={{ label: "Atualizar", onClick: () => void refresh() }}
          />
        )}
      </div>
    </main>
  );
}
