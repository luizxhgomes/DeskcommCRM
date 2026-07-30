"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Sparkle } from "@/lib/ui/icons";

interface NucleoPageHeaderProps {
  readonly title: string;
  readonly subtitle: string;
  readonly cta?: { href: string; label: string } | null;
  readonly children?: ReactNode;
}

export function NucleoPageHeader({ title, subtitle, cta, children }: NucleoPageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-medium text-primary">Núcleo de Inteligência Operacional</p>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        {children}
        {cta && (
          <Button asChild>
            <Link href={cta.href}>
              <Sparkle className="mr-2 size-4" />
              {cta.label}
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}
