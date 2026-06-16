-- Service-role semantic search for the Telegram bot (resolves owner from the
-- chat->user link, not a JWT). SECURITY DEFINER + explicit user_id => MUST be
-- locked to service_role only; the webhook only ever passes the resolved owner.
CREATE OR REPLACE FUNCTION public.taskos_semantic_search_svc(
  p_user uuid,
  query_embedding extensions.vector(384),
  match_count int DEFAULT 20
)
RETURNS TABLE (kind text, id uuid, title text, body text, due_at timestamptz, similarity double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  (SELECT 'task'::text, t.id, t.title, coalesce(t.description,''), t.due_at,
          1 - (t.embedding <=> query_embedding)
     FROM public.taskos_tasks t
    WHERE t.user_id = p_user AND t.embedding IS NOT NULL
      AND t.status NOT IN ('done','cancelled')
    ORDER BY t.embedding <=> query_embedding
    LIMIT match_count)
  UNION ALL
  (SELECT 'entity'::text, e.id, coalesce(e.title,''), e.body, e.due_at,
          1 - (e.embedding <=> query_embedding)
     FROM public.taskos_entities e
    WHERE e.user_id = p_user AND e.embedding IS NOT NULL
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count)
$$;
REVOKE ALL ON FUNCTION public.taskos_semantic_search_svc(uuid, extensions.vector, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taskos_semantic_search_svc(uuid, extensions.vector, int) TO service_role;
