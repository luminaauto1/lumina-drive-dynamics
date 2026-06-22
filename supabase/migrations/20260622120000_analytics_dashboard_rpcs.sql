-- ADDITIVE analytics RPCs (port of ZTC dashboard maths). No tables/columns altered.
-- Reads finance_applications (status, created_by, created_at, status_updated_at,
-- status_history jsonb) + profiles. SAST (UTC+2). SECURITY DEFINER + admin guard.

create or replace function public.lum_is_submitted(s text)
returns boolean language sql immutable as $$ select s = 'application_submitted'; $$;

create or replace function public.lum_is_approved(s text)
returns boolean language sql immutable as $$
  select s = any (array['pre_approved','documents_received','validations_pending',
    'validations_complete','contract_sent','contract_signed','vehicle_delivered',
    'finalized','approved']);
$$;

create or replace function public.lum_is_declined(s text)
returns boolean language sql immutable as $$
  select s = any (array['declined','declined_conditional','blacklisted']);
$$;

create or replace function public.lum_working_minutes(p_from timestamptz, p_to timestamptz)
returns integer language plpgsql stable as $$
declare
  d_start date := (p_from at time zone 'Africa/Johannesburg')::date;
  d_end   date := (p_to   at time zone 'Africa/Johannesburg')::date;
  d date;
  total numeric := 0;
  day_open timestamptz; day_close timestamptz; lunch_s timestamptz; lunch_e timestamptz;
  seg_s timestamptz; seg_e timestamptz; mins numeric; lunch_overlap numeric;
begin
  if p_to <= p_from then return 0; end if;
  d := d_start;
  while d <= d_end loop
    if extract(isodow from d) < 6 then
      day_open  := (d::text || ' 08:00')::timestamp at time zone 'Africa/Johannesburg';
      day_close := (d::text || ' 17:00')::timestamp at time zone 'Africa/Johannesburg';
      lunch_s   := (d::text || ' 13:00')::timestamp at time zone 'Africa/Johannesburg';
      lunch_e   := (d::text || ' 14:00')::timestamp at time zone 'Africa/Johannesburg';
      seg_s := greatest(day_open, p_from);
      seg_e := least(day_close, p_to);
      if seg_e > seg_s then
        mins := extract(epoch from (seg_e - seg_s)) / 60.0;
        lunch_overlap := greatest(0, extract(epoch from (least(seg_e, lunch_e) - greatest(seg_s, lunch_s))) / 60.0);
        total := total + greatest(0, mins - lunch_overlap);
      end if;
    end if;
    d := d + 1;
  end loop;
  return round(total)::int;
end;
$$;

create or replace function public.lum_first_family_ts(
  p_history jsonb, p_status text, p_status_updated_at timestamptz, p_family text)
returns timestamptz language sql stable as $$
  with hist as (
    select (e->>'timestamp')::timestamptz as ts, (e->>'status') as st
    from jsonb_array_elements(coalesce(p_history, '[]'::jsonb)) e
    where (e ? 'timestamp') and (e ? 'status')
  ),
  matched as (
    select min(ts) as ts from hist
    where (p_family='submitted' and public.lum_is_submitted(st))
       or (p_family='approved'  and public.lum_is_approved(st))
       or (p_family='declined'  and public.lum_is_declined(st))
  )
  select coalesce(
    (select ts from matched where ts is not null),
    case when (
      (p_family='submitted' and public.lum_is_submitted(p_status)) or
      (p_family='approved'  and public.lum_is_approved(p_status))  or
      (p_family='declined'  and public.lum_is_declined(p_status))
    ) then p_status_updated_at else null end
  );
$$;

create or replace function public.lum_analytics_kpis(p_since timestamptz, p_until timestamptz)
returns table(
  received bigint, submitted bigint, approved bigint, declined bigint,
  approval_rate int, submit_rate int, decline_rate int,
  working_minutes int, avg_minutes_per_app int,
  alltime_received bigint, alltime_approved bigint, alltime_declined bigint,
  alltime_approval_rate int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'forbidden' using errcode='42501'; end if;
  return query
  with fa as (select * from public.finance_applications),
  ev as (
    select created_at,
      public.lum_first_family_ts(status_history,status,status_updated_at,'submitted') as sub_ts,
      public.lum_first_family_ts(status_history,status,status_updated_at,'approved')  as app_ts,
      public.lum_first_family_ts(status_history,status,status_updated_at,'declined')  as dec_ts
    from fa),
  per as (
    select
      count(*) filter (where created_at >= p_since and created_at < p_until) as rcv,
      count(*) filter (where sub_ts >= p_since and sub_ts < p_until)         as sub,
      count(*) filter (where app_ts >= p_since and app_ts < p_until)         as apr,
      count(*) filter (where dec_ts >= p_since and dec_ts < p_until)         as dec
    from ev),
  alltime as (
    select count(*) as rcv,
           count(*) filter (where public.lum_is_approved(status)) as apr,
           count(*) filter (where public.lum_is_declined(status)) as dec
    from fa),
  wm as (select public.lum_working_minutes(p_since, least(p_until, now())) as m)
  select per.rcv, per.sub, per.apr, per.dec,
    case when (per.apr+per.dec)>0 then round(per.apr::numeric/(per.apr+per.dec)*100)::int else 0 end,
    case when per.rcv>0 then round(per.sub::numeric/per.rcv*100)::int else 0 end,
    case when (per.apr+per.dec)>0 then round(per.dec::numeric/(per.apr+per.dec)*100)::int else 0 end,
    wm.m,
    case when per.sub>0 then round(wm.m::numeric/per.sub)::int else null end,
    alltime.rcv, alltime.apr, alltime.dec,
    case when (alltime.apr+alltime.dec)>0 then round(alltime.apr::numeric/(alltime.apr+alltime.dec)*100)::int else 0 end
  from per, alltime, wm;
end; $$;

create or replace function public.lum_analytics_leaderboard(p_since timestamptz, p_until timestamptz)
returns table(agent_id uuid, agent_name text, period_submitted bigint, alltime_submitted bigint,
  period_approved bigint, avg_load_mins int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'forbidden' using errcode='42501'; end if;
  return query
  with fa as (
    select created_by, created_at, status, status_updated_at, status_history
    from public.finance_applications where created_by is not null),
  ev as (
    select created_by, created_at,
      public.lum_first_family_ts(status_history,status,status_updated_at,'submitted') as sub_ts,
      public.lum_first_family_ts(status_history,status,status_updated_at,'approved')  as app_ts
    from fa),
  agg as (
    select created_by as agent_id,
      count(*) filter (where sub_ts >= p_since and sub_ts < p_until) as period_submitted,
      count(*) filter (where sub_ts is not null)                    as alltime_submitted,
      count(*) filter (where app_ts >= p_since and app_ts < p_until) as period_approved,
      avg(public.lum_working_minutes(created_at, sub_ts))
        filter (where created_at >= p_since and created_at < p_until
                  and sub_ts >= p_since and sub_ts < p_until and sub_ts > created_at) as avg_load
    from ev group by created_by)
  select a.agent_id, coalesce(nullif(p.full_name,''), p.email, 'Unknown') as agent_name,
    a.period_submitted, a.alltime_submitted, a.period_approved,
    case when a.avg_load is not null then round(a.avg_load)::int else null end
  from agg a left join public.profiles p on p.user_id = a.agent_id
  where a.alltime_submitted > 0 or a.period_submitted > 0
  order by a.period_submitted desc, a.alltime_submitted desc;
end; $$;

create or replace function public.lum_analytics_daily(p_days int default 14)
returns table(day date, received bigint, approved bigint, declined bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'forbidden' using errcode='42501'; end if;
  return query
  with d as (
    select generate_series((now() at time zone 'Africa/Johannesburg')::date - (p_days-1),
      (now() at time zone 'Africa/Johannesburg')::date, interval '1 day')::date as day),
  ev as (
    select created_at,
      public.lum_first_family_ts(status_history,status,status_updated_at,'approved') as app_ts,
      public.lum_first_family_ts(status_history,status,status_updated_at,'declined') as dec_ts
    from public.finance_applications)
  select d.day,
    (select count(*) from ev where (ev.created_at at time zone 'Africa/Johannesburg')::date = d.day),
    (select count(*) from ev where (ev.app_ts     at time zone 'Africa/Johannesburg')::date = d.day),
    (select count(*) from ev where (ev.dec_ts     at time zone 'Africa/Johannesburg')::date = d.day)
  from d order by d.day;
end; $$;

create or replace function public.lum_analytics_snapshot()
returns table(total bigint, submitted bigint, approved bigint, declined bigint,
  delivered bigint, needs_feedback bigint, self_submitted bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'forbidden' using errcode='42501'; end if;
  return query select count(*),
    count(*) filter (where public.lum_is_submitted(status)),
    count(*) filter (where public.lum_is_approved(status)),
    count(*) filter (where public.lum_is_declined(status)),
    count(*) filter (where status in ('vehicle_delivered','finalized')),
    count(*) filter (where status = 'application_submitted'),
    count(*) filter (where created_by is null)
  from public.finance_applications;
end; $$;

grant execute on function public.lum_analytics_kpis(timestamptz,timestamptz) to authenticated;
grant execute on function public.lum_analytics_leaderboard(timestamptz,timestamptz) to authenticated;
grant execute on function public.lum_analytics_daily(int) to authenticated;
grant execute on function public.lum_analytics_snapshot() to authenticated;
notify pgrst, 'reload schema';
