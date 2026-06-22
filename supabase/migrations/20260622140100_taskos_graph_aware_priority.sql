-- Graph- & goal-aware priority. Extends the existing formula with three signals
-- read from the knowledge graph: (a) +boost for tasks that BLOCK other open tasks,
-- (b) +boost for tasks linked to a high-importance goal/project, (c) -penalty for
-- tasks waiting on an open dependency. Clamp + priority_locked preserved.
CREATE OR REPLACE FUNCTION public.taskos_rescore_priorities()
RETURNS integer
LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  WITH open_tasks AS (
    SELECT id, importance, urgency, due_at, last_progress_at, status
    FROM public.taskos_tasks
    WHERE status NOT IN ('done','cancelled') AND priority_locked = false
  ),
  blocker AS (
    SELECT l.from_id AS task_id, count(*) AS blocks_n
    FROM public.taskos_links l
    JOIN public.taskos_tasks bt ON bt.id = l.to_id
    WHERE l.relation='blocks' AND l.from_kind='task' AND l.to_kind='task'
      AND bt.status NOT IN ('done','cancelled')
    GROUP BY l.from_id
  ),
  goal AS (
    SELECT l.from_id AS task_id, max(e.importance) AS goal_importance
    FROM public.taskos_links l
    JOIN public.taskos_entities e ON e.id = l.to_id
    WHERE l.from_kind='task' AND l.to_kind='entity'
      AND l.relation IN ('part_of','about','relates_to')
      AND e.kind IN ('goal','project')
    GROUP BY l.from_id
  ),
  blocked_dep AS (
    SELECT l.from_id AS task_id, count(*) AS open_deps
    FROM public.taskos_links l
    JOIN public.taskos_tasks dt ON dt.id = l.to_id
    WHERE l.relation='depends_on' AND l.from_kind='task' AND l.to_kind='task'
      AND dt.status NOT IN ('done','cancelled')
    GROUP BY l.from_id
  ),
  scored AS (
    SELECT o.id,
      least(100, greatest(0,
        o.importance * 12 + o.urgency * 8
        + CASE
            WHEN o.due_at IS NULL THEN 0
            WHEN o.due_at < now() THEN 50
            WHEN o.due_at < now() + interval '24 hours' THEN 35
            WHEN o.due_at < now() + interval '72 hours' THEN 20
            WHEN o.due_at < now() + interval '7 days'  THEN 8
            ELSE 0 END
        + least(15, greatest(0, extract(epoch FROM (now() - o.last_progress_at)) / 86400.0 * 2))
        + CASE o.status WHEN 'in_progress' THEN 6 WHEN 'blocked' THEN -8 WHEN 'waiting' THEN -6 ELSE 0 END
        + least(15, coalesce(b.blocks_n, 0) * 5)
        + least(10, coalesce(g.goal_importance, 0) * 2)
        - CASE WHEN coalesce(d.open_deps, 0) > 0 THEN 12 ELSE 0 END
      ))::double precision AS ns,
      coalesce(b.blocks_n,0) AS blocks_n,
      coalesce(g.goal_importance,0) AS goal_importance,
      coalesce(d.open_deps,0) AS open_deps
    FROM open_tasks o
    LEFT JOIN blocker b ON b.task_id = o.id
    LEFT JOIN goal g ON g.task_id = o.id
    LEFT JOIN blocked_dep d ON d.task_id = o.id
  )
  UPDATE public.taskos_tasks t
     SET priority_score = s.ns,
         priority_meta  = coalesce(t.priority_meta,'{}'::jsonb) || jsonb_build_object(
           'rescored_at', now(), 'blocks_n', s.blocks_n,
           'goal_importance', s.goal_importance, 'open_deps', s.open_deps)
    FROM scored s
   WHERE t.id = s.id AND t.priority_score IS DISTINCT FROM s.ns;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$;