import { createServerFn } from "@tanstack/react-start";

const MAX_LEN = 4000;

export const polishTutanak = createServerFn({ method: "POST" })
  .inputValidator((input: { text: string; category: string; positive: boolean }) => {
    const text = String(input?.text ?? "").trim();
    if (!text) throw new Error("Önce tutanak metnini yazın.");
    if (text.length > MAX_LEN) throw new Error(`Metin en fazla ${MAX_LEN} karakter olabilir.`);
    return { text, category: String(input?.category ?? "").slice(0, 80), positive: Boolean(input?.positive) };
  })
  .handler(async ({ data }) => {
    const { generateTextViaGateway, aiErrorMessage } = await import("./ai-gateway.server");
    const { POLISH_TUTANAK_INSTRUCTIONS, parseAiTutanak, resolveTutanakCategory } = await import("./ai-tutanak");
    const prompt = `Tür: ${data.positive ? "Olumlu" : "Olumsuz"}\nKategori: ${data.category}\n\nHam notlar:\n${data.text}`;
    try {
      const raw = await generateTextViaGateway(POLISH_TUTANAK_INSTRUCTIONS, prompt);
      const result = parseAiTutanak(raw, { title: "Tutanak", tag: "Tutanak" });
      return { ok: true as const, text: result.body, category: resolveTutanakCategory(data.category, result.tag) };
    } catch (error) {
      console.error("polishTutanak failed", error);
      return { ok: false as const, error: aiErrorMessage(error) };
    }
  });

/** Expands a short note into a complete, formal tutanak that names the child and the date. */
export const writeFullTutanak = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string; date: string; positive: boolean; category: string; note: string; group?: string }) => {
    const note = String(input?.note ?? "").trim();
    const name = String(input?.name ?? "").trim();
    if (!name) throw new Error("Önce talebeyi seçin.");
    if (!note) throw new Error("Önce kısa notu yazın.");
    if (note.length > MAX_LEN) throw new Error(`Not en fazla ${MAX_LEN} karakter olabilir.`);
    return {
      name: name.slice(0, 120),
      date: String(input?.date ?? "").slice(0, 10),
      positive: Boolean(input?.positive),
      category: String(input?.category ?? "").slice(0, 80),
      note,
      group: String(input?.group ?? "").slice(0, 80),
    };
  })
  .handler(async ({ data }) => {
    const { generateTextViaGateway, aiErrorMessage } = await import("./ai-gateway.server");
    const { FULL_TUTANAK_INSTRUCTIONS, buildFullTutanakPrompt, parseAiTutanak, resolveTutanakCategory } = await import("./ai-tutanak");
    try {
      const raw = await generateTextViaGateway(FULL_TUTANAK_INSTRUCTIONS, buildFullTutanakPrompt(data));
      const fallbackTag = data.category || (data.positive ? "Güzel Davranış" : "Diğer");
      const result = parseAiTutanak(raw, { title: fallbackTag, tag: fallbackTag });
      return { ok: true as const, ...result, tag: resolveTutanakCategory(data.category, result.tag) };
    } catch (error) {
      console.error("writeFullTutanak failed", error);
      return { ok: false as const, error: aiErrorMessage(error) };
    }
  });
