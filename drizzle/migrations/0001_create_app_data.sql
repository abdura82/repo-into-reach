CREATE TABLE public.app_data (
  user_id uuid PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_data TO authenticated;
GRANT ALL ON public.app_data TO service_role;

ALTER TABLE public.app_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_data_owner_select ON public.app_data
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY app_data_owner_insert ON public.app_data
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY app_data_owner_update ON public.app_data
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY app_data_owner_delete ON public.app_data
  FOR DELETE TO authenticated USING (user_id = auth.uid());