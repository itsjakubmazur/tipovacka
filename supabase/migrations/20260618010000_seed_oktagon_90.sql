-- Seed data: OKTAGON 90: Fleury vs. Aras (Uber Arena, Berlin, 20. 6. 2026)
-- sherdog_slug is left NULL — will be filled automatically once the
-- "import card from Sherdog" scraper (Fáze 7) runs against the real
-- Sherdog page, or manually via the admin UI (Fáze 6).

insert into public.events (number, name, event_date, location, sherdog_event_url, lock_at, auto_lock, status)
values (
  90,
  'OKTAGON 90: Fleury vs. Aras',
  '2026-06-20 18:00:00+02',
  'Uber Arena, Berlin, Germany',
  'https://www.sherdog.com/events/Oktagon-MMA-Oktagon-90-Fleury-vs-Aras-110588',
  '2026-06-20 18:00:00+02',
  true,
  'upcoming'
);

insert into public.fighters (name) values
  ('Will Fleury'), ('Kasim Aras'),
  ('Mateusz Legierski'), ('Gökhan Aksu'),
  ('Alina Dalaslan'), ('Djulia Ariana'),
  ('Niko Samsonidse'), ('Denis Frimpong'),
  ('Niklas Stolze'), ('Tyrone Pfeifer'),
  ('Attila Korkmaz'), ('Dawid Smielowski'),
  ('Arijan Topallaj'), ('Jan Stanovsky'),
  ('Timo Feucht'), ('Elvis Prince Grohmann'),
  ('Matěj Peňáz'), ('Alan Silva'),
  ('Ahmad Halimson'), ('Joseph Donkor'),
  ('Zafar Mohsen'), ('Richie Smullen'),
  ('Davlet Karataev'), ('Daniel Salas');

-- helper: one INSERT per bout, looked up by fighter name + the event we
-- just created (sherdog_event_url is unique enough as a join key here)
insert into public.fights (event_id, fighter_a_id, fighter_b_id, weight_class, is_title_fight, is_main_event, card_order, rounds, status)
select e.id, fa.id, fb.id, v.weight_class, v.is_title, v.is_main, v.card_order, v.rounds, 'scheduled'
from public.events e
join (values
  ('Will Fleury', 'Kasim Aras', 'Heavyweight', true, true, 12, 5),
  ('Mateusz Legierski', 'Gökhan Aksu', 'Lightweight', true, false, 11, 5),
  ('Alina Dalaslan', 'Djulia Ariana', 'Bantamweight', false, false, 10, 3),
  ('Niko Samsonidse', 'Denis Frimpong', 'Lightweight', false, false, 9, 3),
  ('Niklas Stolze', 'Tyrone Pfeifer', 'Welterweight', false, false, 8, 3),
  ('Attila Korkmaz', 'Dawid Smielowski', 'Lightweight', false, false, 7, 3),
  ('Arijan Topallaj', 'Jan Stanovsky', 'Lightweight', false, false, 6, 3),
  ('Timo Feucht', 'Elvis Prince Grohmann', 'Light Heavyweight', false, false, 5, 3),
  ('Matěj Peňáz', 'Alan Silva', 'Middleweight', false, false, 4, 3),
  ('Ahmad Halimson', 'Joseph Donkor', 'Lightweight', false, false, 3, 3),
  ('Zafar Mohsen', 'Richie Smullen', 'Featherweight', false, false, 2, 3),
  ('Davlet Karataev', 'Daniel Salas', 'Lightweight', false, false, 1, 3)
) as v(name_a, name_b, weight_class, is_title, is_main, card_order, rounds)
  on true
join public.fighters fa on fa.name = v.name_a
join public.fighters fb on fb.name = v.name_b
where e.sherdog_event_url = 'https://www.sherdog.com/events/Oktagon-MMA-Oktagon-90-Fleury-vs-Aras-110588';
