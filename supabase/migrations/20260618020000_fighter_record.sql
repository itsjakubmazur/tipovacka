-- Win-loss-draw record shown next to fighter names (e.g. "16-3-0"),
-- same as displayed on Sherdog. Filled by the scraper going forward.
alter table public.fighters add column record text;

update public.fighters set record = v.record
from (values
  ('Will Fleury', '16-3-0'),
  ('Kasim Aras', '11-5-0'),
  ('Mateusz Legierski', '13-2-0'),
  ('Gökhan Aksu', '14-6-1'),
  ('Alina Dalaslan', '5-0-0'),
  ('Djulia Ariana', '5-2-0'),
  ('Niko Samsonidse', '12-4-0'),
  ('Denis Frimpong', '8-3-0'),
  ('Niklas Stolze', '14-9-0'),
  ('Tyrone Pfeifer', '7-1-0'),
  ('Attila Korkmaz', '16-11-0'),
  ('Dawid Smielowski', '12-3-0'),
  ('Arijan Topallaj', '9-2-1'),
  ('Jan Stanovsky', '8-2-0'),
  ('Timo Feucht', '7-2-0'),
  ('Elvis Prince Grohmann', '3-1-0'),
  ('Matěj Peňáz', '10-1-0'),
  ('Alan Silva', '20-13-1'),
  ('Ahmad Halimson', '7-4-1'),
  ('Joseph Donkor', '6-2-0'),
  ('Zafar Mohsen', '14-4-0'),
  ('Richie Smullen', '15-4-1'),
  ('Davlet Karataev', '8-2-0'),
  ('Daniel Salas', '20-8-1')
) as v(name, record)
where public.fighters.name = v.name;
