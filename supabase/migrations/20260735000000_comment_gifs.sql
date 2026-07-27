-- GIFs in the kecárna. A comment can now carry a gif_url instead of (or
-- alongside) text. Locked to GIPHY hosts so the field can't be used to embed
-- an arbitrary remote image in everyone's browser, and the body check is
-- relaxed so a GIF-only message (empty body) is allowed while text-only
-- messages still require 1..500 chars.
alter table public.event_comments
  add column gif_url text
  check (gif_url is null or gif_url ~ '^https://[a-z0-9.-]+\.giphy\.com/');

alter table public.event_comments drop constraint event_comments_body_check;

alter table public.event_comments
  add constraint event_comments_body_check
  check (
    char_length(body) <= 500
    and (char_length(body) >= 1 or gif_url is not null)
  );
