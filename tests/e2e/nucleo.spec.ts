/**
 * Jornada F5 do Núcleo contra a instância local (next start) e o Supabase de
 * desenvolvimento. Cria contato, conversa, lead e movimentação REAIS — nunca
 * executar contra produção. A asserção final de "leads ativos +1" pressupõe
 * execução serial num ambiente local dedicado (fullyParallel: false).
 *
 * Evidência visual: screenshots em .superpowers/evidence/f5/ (gitignored).
 */
import { test, expect } from "@playwright/test";

import { loadEnvLocal } from "./helpers/auth";

const localEnv = loadEnvLocal();
const email = localEnv.NUCLEO_E2E_EMAIL;
const password = localEnv.NUCLEO_E2E_PASSWORD;

const EVIDENCE = ".superpowers/evidence/f5";

test.describe("nucleo local completo", () => {
  test.skip(!email || !password, "Configure NUCLEO_E2E_EMAIL e NUCLEO_E2E_PASSWORD somente em .env.local.");

  test("nucleo: login sem 2FA → cockpit → RAG → aprovar lead e movimentação → rejeitar → cockpit atualizado", async ({ page }) => {
    test.setTimeout(240_000);
    const suffix = Date.now();
    const title = `E2E Núcleo ${suffix}`;

    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Senha", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/\/app\//, { timeout: 30_000 });

    await page.goto("/app/nucleo");
    await expect(page.getByRole("heading", { name: "Cockpit executivo" })).toBeVisible();
    await expect(page.getByText("Agentes publicados")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Squads ativos")).toBeVisible();
    const leadsBefore = Number(await page.getByTestId("cockpit-open-leads").innerText());
    expect(Number.isNaN(leadsBefore)).toBe(false);
    await page.screenshot({ path: `${EVIDENCE}/01-cockpit-inicial.png`, fullPage: true });

    await page.goto("/app/nucleo/squads/sales");
    await expect(page.getByRole("heading", { name: "sales" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Catálogo de agentes")).toBeVisible();
    await page.screenshot({ path: `${EVIDENCE}/02-detalhe-sales.png`, fullPage: true });

    await page.goto("/app/nucleo/command");
    await expect(page.getByRole("heading", { name: "Sala de Comando" })).toBeVisible();
    await page.getByLabel("Título da simulação").fill(title);
    await page.getByLabel("Nome do contato").fill(`Contato E2E ${suffix}`);
    await page.getByLabel("Mensagem inicial").fill("Uma empresa B2B pediu uma demonstração do CRM.");
    await page.getByRole("button", { name: "Criar conversa de teste" }).click();
    await expect(page.getByText(`Conversa: ${title}`)).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Selecionar squad sales" }).click();
    const requestInput = page.getByPlaceholder("Descreva a decisão que precisa tomar…");
    await requestInput.fill("Consulte a KB MEDDPICC e recomende o próximo passo seguro antes de uma demonstração.");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Fontes RAG")).toBeVisible({ timeout: 120_000 });
    // A resposta precisa ser texto real do agente, não o placeholder da tela.
    const agentResponse = page.getByTestId("nucleo-agent-response");
    await expect(agentResponse).not.toContainText("Crie uma conversa simulada");
    expect((await agentResponse.innerText()).trim().length).toBeGreaterThan(40);
    await expect(page.getByRole("button", { name: "Propor lead" })).toBeVisible();
    await page.screenshot({ path: `${EVIDENCE}/03-resposta-rag.png`, fullPage: true });

    await page.getByLabel("Título do lead").fill(`Lead E2E ${suffix}`);
    await page.getByRole("button", { name: "Propor lead" }).click();
    await expect(page.locator('[data-status="pending"]').first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Aprovar create_lead/ }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Aprovar e aplicar" }).click();
    await expect(page.getByText("Lead vinculado ao CRM.")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-status="applied"]').first()).toBeVisible();

    await page.getByLabel("Etapa do lead").click();
    await page.getByRole("option").nth(1).click();
    await page.getByRole("button", { name: "Propor movimentação" }).click();
    await expect(page.getByRole("button", { name: /Aprovar move_lead_stage/ })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Aprovar move_lead_stage/ }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Aprovar e aplicar" }).click();
    await expect(page.getByText("Timeline oficial do lead")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-activity-type="stage_changed"]').first()).toBeVisible();
    await page.screenshot({ path: `${EVIDENCE}/04-acoes-aplicadas.png`, fullPage: true });

    // Rejeição: uma segunda proposta é descartada sem tocar o CRM.
    await page.getByLabel("Título do lead").fill(`Lead E2E rejeitado ${suffix}`);
    await page.getByRole("button", { name: "Propor lead" }).click();
    await expect(page.getByRole("button", { name: /Rejeitar create_lead/ })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Rejeitar create_lead/ }).first().click();
    await expect(page.locator('[data-status="rejected"]').first()).toBeVisible({ timeout: 30_000 });

    // De volta ao Cockpit: a jornada precisa refletir nos dados agregados.
    await page.goto("/app/nucleo");
    await expect(page.getByRole("heading", { name: "Cockpit executivo" })).toBeVisible();
    await expect(page.getByTestId("cockpit-open-leads")).toBeVisible({ timeout: 30_000 });
    const leadsAfter = Number(await page.getByTestId("cockpit-open-leads").innerText());
    expect(leadsAfter).toBe(leadsBefore + 1);
    await page.screenshot({ path: `${EVIDENCE}/05-cockpit-atualizado.png`, fullPage: true });
  });
});
