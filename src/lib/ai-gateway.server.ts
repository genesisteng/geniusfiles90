import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Server-only helper that builds the Lovable AI Gateway provider.
 * Never import this from client code — it reads LOVABLE_API_KEY.
 */
export function createLovableAiGatewayProvider(lovableApiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}
