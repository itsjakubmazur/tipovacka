import { EmojiGlyph } from "@/components/events/emoji-glyph";

const REACTION_EMOJI = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F525}"];

export default function EmojiCheck() {
  return (
    <div style={{ display: "flex", gap: 24, padding: 24, background: "#fff" }} id="probe">
      {REACTION_EMOJI.map((e) => (
        <EmojiGlyph key={e} native={e} size={48} />
      ))}
      <EmojiGlyph native="-not-an-emoji" size={48} />
    </div>
  );
}
