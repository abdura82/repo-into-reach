import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const keySchema = z.string().regex(/^[a-z0-9]{24,64}$/);

/** Saves this device's students/attendance and teacher emails so reports can be sent automatically. */
export const syncReportData = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      key: keySchema,
      recipients: z.array(z.string().email().max(200)).max(50),
      dailyRecipients: z.array(z.string().email().max(200)).max(50).nullable().optional(),
      students: z.array(z.object({ id: z.string().max(100), name: z.string().max(200) }).passthrough()).max(1000),
      attendance: z.array(z.object({ studentId: z.string().max(100), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).passthrough()).max(200000),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const students = data.students.map((s) => ({ id: s.id, name: s.name, sinif: "ihzari" as const }));
    const { error } = await supabaseAdmin.from("report_subscriptions").upsert({
      sync_key: data.key, recipients: data.recipients, daily_recipients: data.dailyRecipients ?? null, students, attendance: data.attendance as never, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Sends a report right now to the saved teachers (test button). */
export const sendReportNow = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ key: keySchema, kind: z.enum(["daily", "weekly", "monthly"]) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub, error } = await supabaseAdmin.from("report_subscriptions").select("recipients, daily_recipients, students, attendance").eq("sync_key", data.key).maybeSingle();
    if (error) throw new Error(error.message);
    if (!sub || !sub.recipients.length) throw new Error("Önce hoca e-postalarını kaydedin.");
    const { sendReportFor } = await import("./report-mail.server");
    await sendReportFor(sub, data.kind);
    const { reportTargets } = await import("./absence-report");
    return { ok: true, count: reportTargets(data.kind, sub.recipients, sub.daily_recipients).length };
  });
