import Link from "next/link";

import { EmptyState } from "@/components/empty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SquadDetailData } from "@/lib/nucleo/types";
import { ArrowRight, Robot } from "@/lib/ui/icons";

export function SquadDetailView({ detail }: { detail: SquadDetailData }) {
  const publishedCount = detail.agents.filter((agent) => agent.published).length;
  const chiefPublished = Boolean(detail.chief?.published);
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Link
        className="nucleo-enter inline-flex items-center gap-1 text-sm text-primary transition-colors duration-fast ease-out hover:text-accent-hover"
        href="/app/nucleo/squads"
      >
        ← Voltar aos squads
      </Link>
      <header className="nucleo-enter nucleo-enter-1">
        <p className="text-sm font-medium text-primary">Squad operacional</p>
        <h1 className="text-2xl font-semibold tracking-tight">{detail.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {detail.manifest?.description ?? "Especialistas e skills compilados."}
        </p>
      </header>
      <section className="nucleo-enter nucleo-enter-2 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="space-y-2">
            <CardDescription>Chief</CardDescription>
            <CardTitle className="text-lg">{detail.chief?.name ?? "Não definido"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={chiefPublished ? "success" : "warning"}>
              {chiefPublished ? "Publicado e disponível" : "Ainda não publicado"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-2">
            <CardDescription>Agentes</CardDescription>
            <CardTitle>{detail.agents.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {publishedCount} publicados · {detail.agents.length - publishedCount} em rascunho
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-2">
            <CardDescription>Skills</CardDescription>
            <CardTitle>{detail.skills}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Playbooks compilados disponíveis para os agentes.
          </CardContent>
        </Card>
      </section>
      <Card className="nucleo-enter nucleo-enter-3">
        <CardHeader>
          <CardTitle>Catálogo de agentes</CardTitle>
          <CardDescription>Publicação e tier reais.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {detail.agents.length === 0 ? (
            <EmptyState
              icon={Robot}
              headline="Nenhum agente neste squad"
              subcopy="Rode o seed do Núcleo para materializar os agentes compilados desta organização."
            />
          ) : (
            detail.agents.map((agent) => (
              <div className="flex items-center justify-between gap-4 py-3 text-sm" key={agent.id}>
                <div className="min-w-0">
                  <p className="font-medium">{agent.name}</p>
                  <p className="truncate text-muted-foreground">
                    {agent.description ?? "Sem descrição"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-right">
                  <span className="text-muted-foreground">
                    Tier {agent.tier} · {agent.role}
                  </span>
                  <Badge variant={agent.published ? "success" : "neutral"}>
                    {agent.published ? "Publicado" : "Rascunho"}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <div className="nucleo-enter nucleo-enter-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        {chiefPublished ? (
          <Button asChild>
            <Link href="/app/nucleo/command">
              Acionar chief na Sala de Comando
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        ) : (
          <>
            <Button disabled>Acionar chief na Sala de Comando</Button>
            <p className="text-sm text-muted-foreground">
              Publique o chief deste squad para habilitar a Sala de Comando.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
