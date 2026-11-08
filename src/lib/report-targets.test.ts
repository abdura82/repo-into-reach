import { describe, expect, it } from "vitest";
import { reportTargets } from "./absence-report";
const all = ["a@x.com", "b@x.com", "c@x.com"];
describe("reportTargets", () => {
  it("daily goes only to chosen teachers", () => expect(reportTargets("daily", all, ["b@x.com"])).toEqual(["b@x.com"]));
  it("daily with no choice goes to everyone", () => expect(reportTargets("daily", all, null)).toEqual(all));
  it("weekly always goes to everyone", () => expect(reportTargets("weekly", all, ["b@x.com"])).toEqual(all));
  it("monthly always goes to everyone", () => expect(reportTargets("monthly", all, ["b@x.com"])).toEqual(all));
});
