-- Hero banner image for the event detail page, auto-fetched from
-- oktagonmma.com's own cover image when the card is imported.
alter table public.events
  add column image_url text;
