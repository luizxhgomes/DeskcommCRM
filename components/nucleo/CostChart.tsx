"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { reais } from "@/lib/nucleo/presentation";

/**
 * O recharts anima via JS (react-smooth), fora do CSS — então o bloco
 * prefers-reduced-motion do nucleo.css não o alcança e o media query precisa
 * ser lido aqui.
 */
function usePrefereMenosMovimento(): boolean {
  const [reduzido, setReduzido] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduzido(query.matches);
    const aoMudar = (evento: MediaQueryListEvent) => setReduzido(evento.matches);
    query.addEventListener("change", aoMudar);
    return () => query.removeEventListener("change", aoMudar);
  }, []);
  return reduzido;
}

interface CostChartProps {
  readonly series: ReadonlyArray<{ day: string; cost: number }>;
}

/**
 * Série de custo diário no padrão dos gráficos do fork (UsageCharts).
 * Os tokens do tema são HEX — `var(--color-accent)` direto; `hsl(var(--…))`
 * seria CSS inválido e derrubaria a cor para o default do recharts.
 */
export function CostChart({ series }: CostChartProps) {
  const semMovimento = usePrefereMenosMovimento();
  const hasCost = series.some((point) => point.cost > 0);
  if (!hasCost) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Sem custo registrado no período.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={[...series]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="nucleo-cost" x1="0" x2="0" y1="0" y2="1">
            <stop stopColor="var(--color-accent)" stopOpacity=".28" />
            <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={70}
          tickFormatter={(value) => reais(Number(value))}
        />
        <Tooltip
          formatter={(value) => [reais(Number(value)), "Custo"]}
          contentStyle={{
            borderRadius: "8px",
            fontSize: "12px",
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
          }}
        />
        <Area
          dataKey="cost"
          stroke="var(--color-accent)"
          strokeWidth={2}
          fill="url(#nucleo-cost)"
          // O padrão do recharts é 1500ms — longo demais para um painel
          // operacional. 320ms é o --duration-slow do tema.
          isAnimationActive={!semMovimento}
          animationDuration={320}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
