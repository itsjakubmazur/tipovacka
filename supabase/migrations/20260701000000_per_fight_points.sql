-- Per-fight variant of recalculate_event_points, so results can be
-- graded fight-by-fight as they come in during a live event (instead of
-- waiting for the whole card to finish) - needed to send each tipper a
-- push notification with their result right after their fight ends.
create function public.recalculate_fight_points(p_fight_id uuid)
returns void as $$
begin
  update public.predictions pr
  set points = case
    when f.status = 'completed' then
      public.calculate_points(
        pr.predicted_winner_id, pr.predicted_method, pr.predicted_round,
        f.winner_fighter_id, f.method, f.result_round
      )
    else null
  end
  from public.fights f
  where f.id = pr.fight_id
    and f.id = p_fight_id;
end;
$$ language plpgsql security definer set search_path = public;
