UPDATE public.plans
SET features = (
  SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(features, ARRAY[]::text[]) || ARRAY['ai_assistant']))
)
WHERE name = 'Empresarial';