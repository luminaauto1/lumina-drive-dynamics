-- "Calls first" — the owner's standing daily rule: phoning people, following up,
-- and getting/giving client feedback are the first priority every day. This extends
-- the graph- & goal-aware rescore with a bounded boost for call/feedback/outreach
-- tasks so they float to the top of any priority-ordered surface (briefings, in-app
-- "what's next"), complementing the capture-time day-planner that already slots them
-- into the earliest time blocks.
--
-- Detection: an explicit 'call' tag (set at capture for call/feedback tasks) OR a
-- title that reads like outreach. The boost is additive and clamped (least(100,…)),
-- and CREATE OR REPLACE preserves ALL prior behaviour (blocks/goal/dependency signals).
CREATE OR REPLACE FUNCTION public.taskos_rescore_priorities()
RETURNS integer
LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  WITH open_tasks AS (
    SELECT id, importance, urgency, due_at, last_progress_at, status, title, tags
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
      (('call' = ANY(o.tags)) OR (o.title ~* '\m(call|calling|phone|ring|follow[- ]?up|reach out|feedback)\M')) AS is_call,
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
        -- calls-first nudge: enough to edge a call ahead of an equivalent non-call,
        -- small enough not to override real urgency/overdue/importance signals.
        + CASE WHEN ('call' = ANY(o.tags)) OR (o.title ~* '\m(call|calling|phone|ring|follow[- ]?up|reach out|feedback)\M') THEN 15 ELSE 0 END
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
           'goal_importance', s.goal_importance, 'open_deps', s.open_deps,
           'is_call', s.is_call)
    FROM scored s
   WHERE t.id = s.id AND t.priority_score IS DISTINCT FROM s.ns;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$;

-- Re-score immediately so existing call/feedback tasks reflect the new rule.
SELECT public.taskos_rescore_priorities();
