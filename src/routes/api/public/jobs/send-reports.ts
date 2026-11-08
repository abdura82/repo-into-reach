import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/send-reports")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const body = (await request.json().catch(() => ({}))) as { kind?: string };
        const kind = body.kind === "weekly" || body.kind === "monthly" ? body.kind : "daily";
        const { istanbulToday, isLastDayOfMonth } = await import("@/lib/absence-report");
        const today = istanbulToday();
        if (kind === "monthly" && !isLastDayOfMonth(today)) return Response.json({ skipped: "not last day" });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendReportFor } = await import("@/lib/report-mail.server");
        const { data, error } = await supabaseAdmin.from("report_subscriptions").select("sync_key, recipients, daily_recipients, students, attendance").neq("recipients", []).limit(50);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        let sent = 0;
        const failed: string[] = [];
        for (const sub of data ?? []) {
          try { await sendReportFor(sub, kind, today); sent++; } catch (e) { console.error(e); failed.push(String(e)); }
        }
        return Response.json({ sent, failed });
      },
    },
  },
});
