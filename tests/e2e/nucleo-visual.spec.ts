/**
 * Evidência visual das quatro telas do Núcleo em tema claro, escuro e com
 * `prefers-reduced-motion`. Só navega e fotografa — não cria nem altera dados;
 * a jornada com escrita no CRM é `nucleo.spec.ts`.
 *
 * Rode com: pnpm test:e2e -g "nucleo visual"
 */
import { test, expect, type Page } from "@playwright/test";

import { loadEnvLocal } from "./helpers/auth";

/** Espera as animações de entrada terminarem — senão a evidência sai a meio fade. */
async function animacoesConcluidas(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all(
      document.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}

const localEnv = loadEnvLocal();
const email = localEnv.NUCLEO_E2E_EMAIL;
const password = localEnv.NUCLEO_E2E_PASSWORD;

const EVIDENCE = ".superpowers/evidence/f5/visual";
const TELAS = [
  { path: "/app/nucleo", nome: "cockpit", heading: "Cockpit executivo" },
  { path: "/app/nucleo/squads", nome: "catalogo", heading: "Squads" },
  { path: "/app/nucleo/squads/sales", nome: "detalhe", heading: "sales" },
  { path: "/app/nucleo/command", nome: "comando", heading: "Sala de Comando" },
] as const;

test.describe("nucleo visual", () => {
  test.skip(!email || !password, "Configure NUCLEO_E2E_EMAIL e NUCLEO_E2E_PASSWORD somente em .env.local.");

  test("nucleo visual: quatro telas em claro, escuro e reduced-motion", async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Senha", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/\/app\//, { timeout: 30_000 });

    for (const tema of ["light", "dark"] as const) {
      await page.evaluate((valor) => {
        document.documentElement.setAttribute("data-theme", valor);
        window.localStorage.setItem("deskcomm-theme", valor);
      }, tema);
      for (const tela of TELAS) {
        await page.goto(tela.path);
        await expect(page.getByRole("heading", { name: tela.heading })).toBeVisible({
          timeout: 30_000,
        });
        await animacoesConcluidas(page);
        await page.screenshot({
          path: `${EVIDENCE}/${tema}-${tela.nome}.png`,
          fullPage: true,
        });
      }
    }

    // Reduced motion: o conteúdo precisa aparecer normalmente, sem depender da
    // animação de entrada (nucleo.css zera as animações neste modo).
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    for (const tela of TELAS) {
      await page.goto(tela.path);
      await expect(page.getByRole("heading", { name: tela.heading })).toBeVisible({
        timeout: 30_000,
      });
      await animacoesConcluidas(page);
      await page.screenshot({ path: `${EVIDENCE}/reduced-motion-${tela.nome}.png`, fullPage: true });
    }

    // Navegação por teclado: o CTA principal do Cockpit precisa ser alcançável
    // e ter foco visível.
    await page.emulateMedia({ reducedMotion: null });
    await page.goto("/app/nucleo");
    const cta = page.getByRole("link", { name: "Abrir Sala de Comando" });
    await cta.focus();
    await expect(cta).toBeFocused();
    await page.screenshot({ path: `${EVIDENCE}/foco-teclado.png` });
  });
});
