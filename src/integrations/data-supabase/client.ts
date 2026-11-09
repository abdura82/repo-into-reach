import { createClient } from "@supabase/supabase-js";

/** Data-only client; app auth and all other services use the existing Lovable client. */
export const dataSupabase = createClient(
  "https://kffctbplkosetmbboxxv.supabase.co",
  "sb_publishable_5FVT9F4ha89xOqiH5nJIJg_797WnbFy",
  { auth: { persistSession: false, autoRefreshToken: false } },
);