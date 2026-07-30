import { describe, expect, it } from "vitest";

import { buildModel } from "@/lib/ai/runtime/agent";

describe("Núcleo OpenRouter", () => {
  it("constrói um modelo OpenRouter com slug de fornecedor sem realizar rede", () => {
    expect(() => buildModel("openrouter", "test-key", "anthropic/claude-haiku-4.5")).not.toThrow();
  });
});
