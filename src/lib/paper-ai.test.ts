import { describe, expect, it } from "vitest";
import { PAPER_INSTRUCTIONS, parsePaperReply } from "./paper-ai";
import { cellStatus } from "./stats";

const opts = { studentIds: ["s1", "s2"], start: "2026-11-01", end: "2026-11-30" };
const reply = (rows: unknown[]) => `Sonuç: ${JSON.stringify({ rows })}`;

describe("paper photo reading", () => {
  it("tells the AI that X means did not come", () => {
    expect(PAPER_INSTRUCTIONS).toMatch(/X[^\n]*= "gelmedi"/);
    expect(PAPER_INSTRUCTIONS).not.toMatch(/\(✓, X, \+/);
  });

  it("keeps gelmedi as absent and geldi as present", () => {
    const [r] = parsePaperReply(reply([{ studentId: "s1", date: "2026-11-02", hucreler: { Sabah: "geldi", "Öğle": "gelmedi", "İkindi": "gec", "Akşam": "izinli", "Yatsı": "hasta", Ders: "bos" } }]), opts);
    expect(cellStatus(r, "Sabah")).toBe("geldi");
    expect(cellStatus(r, "Öğle")).toBe("yok");
    expect(cellStatus(r, "İkindi")).toBe("gec");
    expect(cellStatus(r, "Akşam")).toBe("izinli");
    expect(cellStatus(r, "Yatsı")).toBe("hasta");
    expect(cellStatus(r, "Ders")).toBe("yok");
  });

  it("never turns an unreadable value into geldi", () => {
    const [r] = parsePaperReply(reply([{ studentId: "s1", date: "2026-11-02", hucreler: { Sabah: "?", "Öğle": "" } }]), opts);
    expect(cellStatus(r, "Sabah")).toBe("yok");
    expect(cellStatus(r, "Öğle")).toBe("yok");
  });

  it("keeps the cells the AI was unsure about for checking", () => {
    const [r] = parsePaperReply(reply([{ studentId: "s1", date: "2026-11-02", hucreler: { Sabah: "geldi" }, supheli: ["Sabah", "Uydurma"] }]), opts);
    expect(r!.supheli).toEqual(["Sabah"]);
  });

  it("skips unknown students, out-of-range days and repeated rows", () => {
    const rows = parsePaperReply(reply([
      { studentId: "x9", date: "2026-11-02", hucreler: {} },
      { studentId: "s1", date: "2026-12-01", hucreler: {} },
      { studentId: "s2", date: "2026-11-03", hucreler: { Sabah: "geldi" } },
      { studentId: "s2", date: "2026-11-03", hucreler: { Sabah: "gelmedi" } },
    ]), opts);
    expect(rows).toHaveLength(1);
    expect(cellStatus(rows[0], "Sabah")).toBe("geldi");
  });
});
