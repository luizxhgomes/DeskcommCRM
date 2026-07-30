"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { request } from "@/lib/nucleo/client";
import type { SquadDetailData } from "@/lib/nucleo/types";

import { OperationalError } from "./OperationalError";

export function SquadDetail({ slug }: { slug: string }) {
  const [detail, setDetail] = useState<SquadDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void request<SquadDetailData>(`/api/nucleo/squads/${slug}`)
      .then(setDetail)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Não foi possível carregar o squad."),
      );
  }, [slug]);
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Link className="text-sm text-primary" href="/app/nucleo/squads">
        ← Voltar aos squads
      </Link>
      <OperationalError message={error} />
      {!detail ? (
        !error && <p className="text-sm text-muted-foreground">Carregando squad…</p>
      ) : (
        <>
          <header>
            <p className="text-sm font-medium text-primary">Squad operacional</p>
            <h1 className="text-3xl font-semibold">{detail.name}</h1>
            <p className="mt-1 text-muted-foreground">
              {detail.manifest?.description ?? "Especialistas e skills compilados."}
            </p>
          </header>
          <section className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>Chief</CardDescription>
                <CardTitle className="text-lg">{detail.chief?.name ?? "Não definido"}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {detail.chief?.published ? "Publicado e disponível." : "Ainda não publicado."}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Agentes</CardDescription>
                <CardTitle>{detail.agents.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Skills</CardDescription>
                <CardTitle>{detail.skills}</CardTitle>
              </CardHeader>
            </Card>
          </section>
          <Card>
            <CardHeader>
              <CardTitle>Catálogo de agentes</CardTitle>
              <CardDescription>Publicação e tier reais.</CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              {detail.agents.map((agent) => (
                <div className="flex items-center justify-between gap-4 py-3 text-sm" key={agent.id}>
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-muted-foreground">{agent.description ?? "Sem descrição"}</p>
                  </div>
                  <div className="text-right">
                    <p>
                      Tier {agent.tier} · {agent.role}
                    </p>
                    <p className={agent.published ? "text-primary" : "text-muted-foreground"}>
                      {agent.published ? "Publicado" : "Rascunho"}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Button asChild disabled={!detail.chief?.published}>
            <Link href="/app/nucleo/command">Acionar chief na Sala de Comando</Link>
          </Button>
        </>
      )}
    </main>
  );
}
