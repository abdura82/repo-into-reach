import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** The one shared copy everyone sees: the same four lists the phone keeps. */
const snapshotSchema = z.object({
  students: z.array(z.object({ id: z.string().max(100) }).passthrough()).max(2000),
  tutanaklar: z.array(z.object({ id: z.string().max(100) }).passthrough()).max(5000),
  attendance: z.array(z.object({ id: z.string().max(100), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).passthrough()).max(200000),
  takrirler: z.array(z.object({ id: z.string().max(100), date: z.string().max(20) }).passthrough()).max(2000),
});

export type CloudSnapshot = z.infer<typeof snapshotSchema>;

const ROW_ID = "main";

/** Reads the shared data. Open to every visitor on purpose: the owner wants all devices to see the same data. */
export const loadCloudData = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("shared_data").select("data, updated_at").eq("id", ROW_ID).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { json: JSON.stringify(data.data ?? {}), updatedAt: data.updated_at as string };
});

/** Replaces the shared data with what this device holds. */
export const saveCloudData = createServerFn({ method: "POST" })
  .inputValidator((input) => snapshotSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const savedAt = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("shared_data")
      .upsert({ id: ROW_ID, data: data as never, updated_at: savedAt }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true, savedAt };
  });
