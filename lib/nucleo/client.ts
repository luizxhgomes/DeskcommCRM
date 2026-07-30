/**
 * Helpers client-side do painel do Núcleo.
 *
 * Todas as telas interativas usam este fetch com timeout: uma rede travada
 * vira erro explícito em pt-BR em vez de estado preso em carregamento.
 */
export type ApiEnvelope<T> = { data?: T; error?: { message?: string } };

export interface RequestOptions {
  /** Padrão 15s; execuções de agente (RAG + LLM) precisam de janela maior. */
  readonly timeoutMs?: number;
}

export async function request<T>(
  url: string,
  init?: RequestInit,
  options?: RequestOptions,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), options?.timeoutMs ?? 15_000);
  try {
    const response = await fetch(url, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const payload = (await response.json()) as ApiEnvelope<T>;
    if (!response.ok || !payload.data)
      throw new Error(payload.error?.message ?? "A operação não pôde ser concluída.");
    return payload.data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "A solicitação demorou mais que o esperado. Verifique a conexão local e tente novamente.",
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
