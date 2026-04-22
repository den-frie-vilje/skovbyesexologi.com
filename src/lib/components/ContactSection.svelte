<!--
  Full "Skriv." contact block — the closing act of every page on
  the site (homepage and each service detail page). Lives as a
  component so the layout, palette, and a11y tuning (contrast
  bumps, touch targets, lede margin) stay consistent across routes.

  Renders a landmark `<section id="kontakt">` so in-page anchor
  links like `#kontakt` resolve the same on every page.

  Expects `.flod` design tokens (`--bone`, `--tangerine`) available
  from an ancestor. The phone link assumes a pre-formatted value
  suitable for both display and `tel:` — the formatted `contact.phone`
  is used verbatim in the visible text, while the `tel:` URI
  currently hard-codes `+4531604215` because the content doesn't
  carry a normalised dialling form.
-->
<script lang="ts">
  import type { Contact } from '$lib/content';

  interface Props {
    contact: Contact;
  }

  let { contact }: Props = $props();
</script>

<section id="kontakt" class="contact" data-stage-anchor="contact">
  <p class="section-label reveal">{contact.label}</p>
  <h2 class="reveal">
    {contact.heading}<span class="dot">.</span>
  </h2>
  <p class="contact-lede reveal">{contact.lede}</p>
  <div class="contact-grid">
    <div class="reveal">
      <p class="label">{contact.fieldLabels.email}</p>
      <a href="mailto:{contact.email}">{contact.email}</a>
    </div>
    <div class="reveal">
      <p class="label">{contact.fieldLabels.phone}</p>
      <a href="tel:+4531604215">{contact.phone}</a>
    </div>
    <div class="reveal">
      <p class="label">{contact.fieldLabels.address}</p>
      <p>{contact.address}</p>
    </div>
    <div class="reveal">
      <p class="label">{contact.fieldLabels.hours}</p>
      <p>{contact.hours}</p>
    </div>
  </div>
</section>

<style>
  .contact {
    position: relative;
    /* Muted sage — a warmer green companion to the cool bone bg up top */
    background: oklch(0.48 0.09 152);
    color: var(--bone);
    padding: clamp(5rem, 12vw, 10rem) 1.25rem;
    overflow: hidden;
    /* Sits above the fixed stage canvas so the sage is solid, not
       blended with the 3D elements behind */
    z-index: 1;
  }
  .contact > * {
    position: relative;
    z-index: 2;
  }
  .section-label {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    margin: 0 0 3rem;
    /* 90% bone on sage-green bg — 4.5:1+ per WCAG AA for this 11pt
       label. 70% (3.63:1) was failing pre-a11y sweep. */
    color: color-mix(in oklch, var(--bone) 90%, transparent);
  }
  .contact h2 {
    font-family: var(--font-serif);
    font-size: clamp(4rem, 22vw, 14rem);
    line-height: 0.88;
    letter-spacing: -0.045em;
    font-weight: 400;
    margin: 0 0 2rem;
    color: var(--bone);
  }
  .contact h2 .dot {
    color: var(--tangerine);
  }
  /*
    `.contact p` below sets mono font + `margin: 0` on every
    paragraph inside the contact block. The lede inherits both
    (intentional — the mono aesthetic ties the prose to the
    labels below) and only needs two overrides: a reading-width
    constraint and a wider bottom margin so the final sentence
    ("svære at sige højt") doesn't butt up against the "Email"
    label.
  */
  .contact .contact-lede {
    max-width: 40ch;
    margin: 0 0 4rem;
  }
  .contact-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 2rem;
    max-width: 1100px;
  }
  .contact a,
  .contact p {
    font-family: var(--font-mono);
    font-size: 0.92rem;
    line-height: 1.55;
    color: inherit;
    text-decoration: none;
    margin: 0;
  }
  .contact a {
    border-bottom: 1px solid currentColor;
    /* Touch-target minimum — the email and phone links are the
       only interactive elements here, and at the default line-box
       height they're ~21px tall on mobile, below the 44px
       guideline. Inline-flex + min-height keeps the visual
       underline aligned while enlarging the hit area. */
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }
  .contact a:hover {
    color: var(--tangerine);
    border-color: var(--tangerine);
  }
  .label {
    font-size: 0.66rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    /* 85% bone on sage — 4.5:1 on small text. Was 55% (2.85:1)
       before the a11y sweep. */
    color: color-mix(in oklch, var(--bone) 85%, transparent);
    margin: 0 0 0.35rem;
    border: none;
  }

  @media (min-width: 720px) {
    .contact {
      padding-left: 2rem;
      padding-right: 2rem;
    }
  }
  @media (min-width: 1024px) {
    .contact {
      padding-left: 3rem;
      padding-right: 3rem;
    }
  }
</style>
