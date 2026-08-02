/** The app-wide pill: glass without the blur.
 *
 * There is nothing behind a pill but the card it sits on, so a backdrop-filter
 * here buys nothing and costs a compositing layer - and with eight of them per
 * fight card, ten fights to a gala, that was most of the ~90 blurred layers the
 * event page used to carry. The look comes from the gradient and the specular
 * edge in .glass-pill instead. */
export const GLASS_PILL =
  "glass-pill rounded-full border text-neutral-700 transition-colors hover:border-neutral-400 dark:text-neutral-200 dark:hover:border-neutral-400";
