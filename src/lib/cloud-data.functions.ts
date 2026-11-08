import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** One teacher's whole backup: the same four lists the phone keeps. */
const snapshotSchema = z.object({
  students: z.array(z.object({ id: z.string().max(100) }).passthrough()).max(2000),
  tutanaklar: z.array(z.object({ id: z.string().max(100) }).passthrough()).max(5000),
  attendance: z.array(z.object({ id: z.string().max(100), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).passthrough()).max(200000),
  takrirler: z.array(z.object({ id: z.string().max(100), date: z.string().max(20) }).passthrough()).max(2000),
});

export type CloudSnapshot = z.infer<typeof snapshotSchema>;

/** Reads this signed-in teacher's backup. RLS scopes the row to auth.uid(). */
export const loadCloudData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("app_data")
      .select("data, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    // Handed over as text: the backup is free-form JSON, and a string always survives the trip back.
    return { json: JSON.stringify(data.data ?? {}), updatedAt: data.updated_at as string };
  });

/** Replaces this signed-in teacher's backup with what the phone holds. */
export const saveCloudData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => snapshotSchema.parse(input))
  .handler(async ({ data, context }) => {
    const savedAt = new Date().toISOString();
    const { error } = await context.supabase
      .from("app_data")
      .upsert({ user_id: context.userId, data: data as never, updated_at: savedAt }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true, savedAt };
  });
