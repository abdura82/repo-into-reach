import { COLUMNS, VAKITLER, emptyCells, setCellStatus, type CellStatus } from "./stats";
import type { AttendanceRow } from "./store";

/** One student-day read from a paper chart; `supheli` = cells the AI could not read with certainty. */
export type PaperRow = Pick<AttendanceRow, "studentId" | "date" | "vakitler" | "ders" | "durum" | "durumlar"> & { supheli: string[] };

export const PAPER_INSTRUCTIONS = `Kur'an kursunun kâğıda alınmış yoklama çizelgesinin fotoğraflarını okuyorsun. Hata yapmaman çok önemli.
Çizelge düzeni: her satır bir talebe; her gün için sırayla ${[...VAKITLER, "Ders"].join(", ")} sütunları vardır (bazı çizelgelerde Ders sütunu olmayabilir).
Her hücreyi tek tek, satır ve sütunu dikkatle hizalayarak oku. Satır kaydırma: ismin bulunduğu satırla aynı yatay çizgideki hücreleri oku.
İşaretlerin anlamı (çok dikkat et):
- ✓ (tik), √, +, nokta, imza, "G" harfi olmayan herhangi bir onay işareti = "geldi"
- X, ×, çarpı, eksi (-), 0 = "gelmedi"  (X KESİNLİKLE "gelmedi" demektir, asla "geldi" sayma)
- G = "gec" (geç geldi), İ veya I = "izinli", H = "hasta"
- Boş hücre = "bos"
Emin olamadığın, silik, karalanmış veya iki anlama gelebilecek hücreyi en olası değerle yaz ve o sütunun adını "supheli" listesine ekle.
Sadece verilen talebe listesindeki isimlerle eşleştir; eşleşmeyen isimleri atla. Yazım farklarını makul ölçüde eşleştir, emin değilsen atla.
Sadece verilen tarih aralığındaki günleri yaz, tarihleri YYYY-MM-DD biçiminde ver. Çizelgede olmayan günü uydurma.
YALNIZCA şu JSON'u döndür, başka hiçbir şey yazma:
{"rows":[{"studentId":"...","date":"YYYY-MM-DD","hucreler":{"Sabah":"geldi","Öğle":"gelmedi","İkindi":"gec","Akşam":"izinli","Yatsı":"bos","Ders":"geldi"},"supheli":["Öğle"]}]}`;

const READ: Record<string, CellStatus> = { geldi: "geldi", gelmedi: "yok", gec: "gec", "geç": "gec", izinli: "izinli", hasta: "hasta", bos: "yok", "boş": "yok" };
const isoRe = /^\d{4}-\d{2}-\d{2}$/;

/** Turns the AI reply into checked rows: only known students, dates in range, one row per student-day. */
export function parsePaperReply(text: string, opts: { studentIds: string[]; start: string; end: string }): PaperRow[] {
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const parsed = JSON.parse(json) as { rows?: unknown[] };
  const ids = new Set(opts.studentIds);
  const seen = new Set<string>();
  const out: PaperRow[] = [];
  for (const raw of Array.isArray(parsed.rows) ? parsed.rows : []) {
    const o = (raw ?? {}) as Record<string, unknown>;
    const studentId = String(o["studentId"] ?? "");
    const date = String(o["date"] ?? "");
    if (!ids.has(studentId) || !isoRe.test(date) || date < opts.start || date > opts.end) continue;
    const key = `${studentId}|${date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cells = (o["hucreler"] && typeof o["hucreler"] === "object" ? o["hucreler"] : {}) as Record<string, unknown>;
    const oldVakit = Array.isArray(o["vakitler"]) ? o["vakitler"].map(String) : null;
    let row: Omit<PaperRow, "studentId" | "date" | "supheli"> = emptyCells();
    for (const c of COLUMNS) {
      const v = String(cells[c] ?? "").trim().toLocaleLowerCase("tr");
      const status = READ[v] ?? (oldVakit ? (c === "Ders" ? (o["ders"] === true ? "geldi" : "yok") : oldVakit.includes(c) ? "geldi" : "yok") : "yok");
      row = setCellStatus(row, c, status);
    }
    const supheli = Array.isArray(o["supheli"]) ? COLUMNS.filter((c) => (o["supheli"] as unknown[]).map(String).includes(c)) : [];
    out.push({ studentId, date, ...row, supheli });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
