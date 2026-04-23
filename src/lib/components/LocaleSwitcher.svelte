<!--
  Conventional DA | EN toggle for the site header. Always visible
  in the sticky top bar on every content route — users don't need
  to open the burger menu to switch language.

  Renders both locale codes with a pipe separator. The CURRENT
  locale is a plain `<span>` (non-link, visually emphasised) and
  the OTHER locale is a link to the peer page. Both short 2-char
  codes so the control stays compact enough to sit beside the
  burger at narrow viewports.

  Peer URL + target locale come from each page's load() as
  `altLocale` + `altHref` — service detail pages compute this by
  stable `service.id` so switching language on a detail page
  lands on the exact twin (not a homepage fallback). See
  `src/routes/(app)/ydelser/[slug]/+page.ts` and the EN mirror.

  The anchor's `lang` + `hreflang` attributes tell user agents
  that the link's TARGET is in that language — AT will switch
  pronunciation for the two-letter code (important for "EN" read
  aloud on a Danish page, and vice versa). The `aria-label` on
  the link spells the action out in the CURRENT page's language
  for screen readers.
-->
<script lang="ts">
  import type { Locale } from '$lib/content';

  interface Props {
    /** The page's current locale — shown as the active label. */
    currentLocale: Locale;
    /** The locale of the peer page (i.e. the one the link goes to). */
    altLocale: Locale;
    /** URL of the peer page in the other locale. */
    altHref: string;
  }

  let { currentLocale, altLocale, altHref }: Props = $props();

  // Two-letter codes — convention for compact locale toggles. Using
  // `DA` (Danish) / `EN` (English) rather than the broader `da-DK`
  // / `en-US` since only one variant of each is in play.
  const currentLabel = $derived(currentLocale === 'en' ? 'EN' : 'DA');
  const altLabel = $derived(altLocale === 'en' ? 'EN' : 'DA');

  // Aria-label in the CURRENT page's language so the announcement
  // is read correctly: "Switch to English" on a DA page, "Skift til
  // dansk" on an EN page.
  const altAriaLabel = $derived(
    altLocale === 'en' ? 'Switch to English' : 'Skift til dansk'
  );
</script>

<!--
  `role="group"` + `aria-label` gives the two labels a shared
  semantic container so the control announces as a single unit.
  Without it, AT reads "DA | EN link" rather than "Language, DA,
  EN link" — the latter is the standard pattern for bilingual
  toggles.
-->
<div
  class="locale-switch"
  role="group"
  aria-label={currentLocale === 'en' ? 'Language' : 'Sprog'}
>
  <!--
    Current locale as plain text (not a link). Clicking the current
    language would be a no-op round-trip; removing it from tab
    order keeps keyboard flow tight and avoids the "I clicked the
    highlighted one and nothing happened" confusion.
    `aria-current="true"` lets AT announce it as the active choice.
  -->
  <span class="locale-current" aria-current="true">{currentLabel}</span>
  <span class="locale-sep" aria-hidden="true">|</span>
  <a
    class="locale-alt"
    href={altHref}
    lang={altLocale}
    hreflang={altLocale}
    aria-label={altAriaLabel}
  >
    {altLabel}
  </a>
</div>

<style>
  /*
    Inline-flex so the three children (current / sep / alt) sit on
    a single baseline, matching the header's mono type. Font-size
    + letter-spacing + uppercase explicitly restated rather than
    inherited because `<a>` elements don't inherit text-transform
    / letter-spacing consistently across browsers.
  */
  .locale-switch {
    display: inline-flex;
    align-items: baseline;
    gap: 0.5em;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .locale-current {
    color: var(--text);
    /* Slightly heavier weight to read as "active" without needing
       a background fill or underline that would fight with the
       header's minimal typography. */
    font-weight: 500;
  }
  .locale-sep {
    color: var(--text-muted);
    /* Faint separator — enough to be read as a divider, muted
       enough not to compete with the two labels. */
    opacity: 0.4;
  }
  .locale-alt {
    color: var(--text-muted);
    text-decoration: none;
    transition: color 0.15s;
  }
  .locale-alt:hover,
  .locale-alt:focus-visible {
    color: var(--accent);
  }
</style>
