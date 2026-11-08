import { loadFonts } from "@/lib/report-export";
import type { TakrirDay } from "@/lib/takrir";

type S = { id: string; name: string };
const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
const full = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

/** Weekly takrir summary: one column per takrir day plus verdi/vermedi totals. */
export async function makeTakrirPdf(students: S[], days: TakrirDay[], from: string, to: string, groupName: string): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }, [regular, bold]] = await Promise.all([import("jspdf"), import("jspdf-autotable"), loadFonts()]);
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: ordered.length > 5 ? "landscape" : "portrait" });
  doc.addFileToVFS("DejaVuSans.ttf", regular); doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", bold); doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");
  doc.setFont("DejaVu", "bold"); doc.setFontSize(16); doc.text(from === to ? "Günlük Takrir Raporu" : "Haftalık Takrir Raporu", 14, 18);
  doc.setFont("DejaVu", "normal"); doc.setFontSize(10); doc.setTextColor(90);
  doc.text(`${groupName} Grubu · ${full(from)} – ${full(to)} · ${ordered.length} takrir günü`, 14, 25);
  const listed = students.filter((s) => ordered.some((d) => s.id in d.results));
  let tv = 0, tn = 0;
  const body = listed.map((s, i) => {
    let v = 0, n = 0;
    const cells = ordered.map((d) => { if (!(s.id in d.results)) return "–"; if (d.results[s.id]) { v++; return "Verdi"; } n++; return "Vermedi"; });
    tv += v; tn += n;
    return [String(i + 1), s.name, ...cells, String(v), String(n)];
  });
  autoTable(doc, {
    startY: 31,
    head: [["#", "Talebe", ...ordered.map((d) => dm(d.date)), "Verdi", "Vermedi"]],
    body,
    foot: [["", "Toplam", ...ordered.map((d) => { const ids = listed.filter((s) => s.id in d.results); return `${ids.filter((s) => d.results[s.id]).length}/${ids.length}`; }), String(tv), String(tn)]],
    styles: { font: "DejaVu", fontSize: 8.5, cellPadding: 1.8 },
    headStyles: { fillColor: [34, 99, 74], fontStyle: "bold" },
    footStyles: { fillColor: [235, 240, 237], textColor: 20, fontStyle: "bold" },
    didParseCell: (c) => { if (c.section === "body" && c.cell.raw === "Vermedi") c.cell.styles.textColor = [180, 40, 40]; },
  });
  return doc.output("blob");
}
