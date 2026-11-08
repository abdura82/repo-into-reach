CREATE TABLE public.shared_data (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.shared_data TO service_role;
ALTER TABLE public.shared_data ENABLE ROW LEVEL SECURITY;
INSERT INTO public.shared_data (id, data) SELECT 'main', data FROM public.app_data ORDER BY updated_at DESC LIMIT 1;