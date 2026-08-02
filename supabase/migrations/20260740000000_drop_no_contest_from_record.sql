-- Records used to carry a "(1 NC)" suffix. It is a statistical curiosity
-- rather than something anyone weighs up when tipping, and it wrapped the
-- record onto a second line in the tale of the tape, knocking every row under
-- it out of alignment. The scraper no longer writes it; this clears the rows
-- that already have it, which would otherwise keep it until the fighter
-- happens to be re-imported for a future card.
update fighters
set record = regexp_replace(record, '\s*\(\d+\s*NC\)\s*$', '')
where record ~ '\(\d+\s*NC\)\s*$';
