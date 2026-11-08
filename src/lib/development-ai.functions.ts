import { createServerFn } from "@tanstack/react-start";
import { developmentInputSchema } from "./development";

// Only caller-supplied notes are processed; this endpoint never reads stored student data.
export const summarizeDevelopment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => developmentInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    const { DEVELOPMENT_INSTRUCTIONS, buildDevelopmentPrompt, developmentSummarySchema } = await import("./development");
    try {
      const response = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions: DEVELOPMENT_INSTRUCTIONS,
        input: buildDevelopmentPrompt(data),
        reasoning: { effort: "low" },
        text: { format: { type: "json_schema", name: "student_development", strict: true, schema: {
          type: "object", additionalProperties: false, required: ["summary", "strengths", "followUp"],
          properties: { summary: { type: "string" }, strengths: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 }, followUp: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 } },
        } } },
      });
      const raw = response.output.flatMap((item) => item.type === "message" ? item.content.filter((part) => part.type === "output_text").map((part) => part.text) : []).join("");
      if (!raw) return { ok: false as const, error: "Bu notlar için değerlendirme üretilemedi. Notlarınız korundu." };
      return { ok: true as const, result: developmentSummarySchema.parse(JSON.parse(raw)) };
    } catch (error) {
      if (error instanceof GatewayError) {
        console.error("Development AI failed", { code: error.code, ids: error.ids });
        if (error.httpStatus === 402) return { ok: false as const, error: "AI kullanım hakkı doldu. Kredi eklendikten sonra tekrar deneyin." };
        if (error.httpStatus === 429) return { ok: false as const, error: "AI şu anda yoğun. Biraz sonra tekrar deneyin." };
      }
      return { ok: false as const, error: "Gelişim özeti hazırlanamadı. Notlarınız korundu; daha sonra tekrar deneyebilirsiniz." };
    }
  });