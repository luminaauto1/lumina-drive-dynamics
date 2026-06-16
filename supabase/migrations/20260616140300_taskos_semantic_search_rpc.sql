-- P5: RLS-respecting semantic search over the caller's OWN tasks + entities.
-- SECURITY INVOKER => the owner-only RLS policies apply automatically; the
-- explicit user_id filter also lets the planner use the per-user indexes.
CREATE OR REPLACE FUNCTION public.taskos_semantic_search(
  query_embedding extensions.vector(384),
  match_count int DEFAULT 20
)
RETURNS TABLE (kind text, id uuid, title text, body text, due_at timestamptz, similarity double precision)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  (SELECT 'task'::text, t.id, t.title, coalesce(t.description,''), t.due_at,
          1 - (t.embedding <=> query_embedding)
     FROM public.taskos_tasks t
    WHERE t.user_id = auth.uid() AND t.embedding IS NOT NULL
      AND t.status NOT IN ('done','cancelled')
    ORDER BY t.embedding <=> query_embedding
    LIMIT match_count)
  UNION ALL
  (SELECT 'entity'::text, e.id, coalesce(e.title,''), e.body, e.due_at,
          1 - (e.embedding <=> query_embedding)
     FROM public.taskos_entities e
    WHERE e.user_id = auth.uid() AND e.embedding IS NOT NULL
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count)
$$;
REVOKE ALL ON FUNCTION public.taskos_semantic_search(extensions.vector, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.taskos_semantic_search(extensions.vector, int) TO authenticated;
