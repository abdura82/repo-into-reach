import { createServerFn } from "@tanstack/react-start";
import { PAPER_INSTRUCTIONS, parsePaperReply } from "./paper-ai";

export type { PaperRow } from "./paper-ai";

const MAX_IMAGES = 6;
const MAX_IMAGE_CHARS = 4_000_000;
const isoRe = /^\d{4}-\d{2}-\d{2}$/;

export const analyzePaperAttendance = createServerFn({ method: "POST" })
  .inputValidator((input: { images: string[]; students: { id: string; name: string }[]; start: string; end: string }) => {
    const images = Array.isArray(input?.images) ? input.images.map(String) : [];
    if (!images.length) throw new Error("Önce fotoğraf seçin.");
    if (images.length > MAX_IMAGES) throw new Error(`En fazla ${MAX_IMAGES} fotoğraf yükleyebilirsiniz.`);
    if (images.some((i) => !i.startsWith("data:image/") || i.length > MAX_IMAGE_CHARS)) throw new Error("Fotoğraf okunamadı.");
    const students = (input?.students ?? []).slice(0, 300).map((s) => ({ id: String(s.id), name: String(s.name).slice(0, 100) }));
    if (!students.length) throw new Error("Önce talebe ekleyin.");
    const start = String(input?.start ?? "");
    const end = String(input?.end ?? "");
    if (!isoRe.test(start) || !isoRe.test(end) || start > end) throw new Error("Tarih aralığı geçersiz.");
    return { images, students, start, end };
  })
  .handler(async ({ data }) => {
    const { generateWithImagesViaGateway, aiErrorMessage } = await import("./ai-gateway.server");
    const prompt = `Tarih aralığı: ${data.start} – ${data.end}\nTalebeler (id: isim):\n${data.students.map((s) => `${s.id}: ${s.name}`).join("\n")}`;
    try {
      const text = await generateWithImagesViaGateway(PAPER_INSTRUCTIONS, prompt, data.images, "high");
      const rows = parsePaperReply(text, { studentIds: data.students.map((s) => s.id), start: data.start, end: data.end });
      return { ok: true as const, rows };
    } catch (error) {
      console.error("analyzePaperAttendance failed", error);
      return { ok: false as const, error: error instanceof SyntaxError ? "Fotoğraf okunamadı, daha net bir fotoğraf deneyin." : aiErrorMessage(error) };
    }
  });
