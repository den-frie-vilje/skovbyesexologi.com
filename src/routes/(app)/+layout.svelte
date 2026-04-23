<!--
  Shared shell for the content routes (home + service detail pages).

  Lives here, inside a route group `(app)`, so the `.app-shell` wrapper +
  `<Stage>` + `<SiteHeader>` + `<ContactSection>` + `<SiteFooter>`
  mount ONCE. Client-side navigation between `/` and `/ydelser/…`
  keeps the same `<Stage>` instance, so the WebGL stage lerps
  from the old page's pose to the new page's pose instead of
  re-initialising.

  Routes outside this group — `og`, `admin`, redirects, sitemap,
  robots — bypass the shell and render against a plain background.

  Data flow:
    • Each content page's `+page.ts` returns `locale` in its
      `data`. This layout reads it via `$page.data.locale` to
      choose the DA/EN bundle for the header labels, contact
      section, footer copyright, and burger nav.
    • Each page publishes stage config (anchors + chapter palette
      + optional `konsulent-y` offset) through the `stage` store
      in `$lib/stage/store.svelte.ts`. The layout consumes it
      here and hands the current values to `<Stage>`.
-->
<script lang="ts">
  import { page } from '$app/stores';
  import {
    contentFor,
    primaryNav,
    renderFooterCopyright,
    type Locale
  } from '$lib/content';
  import ContactSection from '$lib/components/ContactSection.svelte';
  import Stage from '$lib/components/Stage.svelte';
  import SiteFooter from '$lib/components/SiteFooter.svelte';
  import SiteHeader from '$lib/components/SiteHeader.svelte';
  import { stage } from '$lib/stage/store.svelte';

  let { children } = $props();

  /*
    Read locale from the active page's data. Every content route
    under `(app)/` returns a `locale: 'da' | 'en'` in its load.
    Fallback to DA if a page ever omits it (shouldn't happen in
    the current routes but makes the layout robust).
  */
  const locale = $derived(($page.data?.locale as Locale | undefined) ?? 'da');
  const bundle = $derived(contentFor(locale));
  const site = $derived(bundle.site);
  const hero = $derived(bundle.home.hero);
  const contact = $derived(bundle.contact);
  const footerCopyright = $derived(renderFooterCopyright(site, contact));
  const homeHref = $derived(locale === 'en' ? '/en' : '/');
  const navLinks = $derived(primaryNav(locale));

  /*
    Bilingual peer URL for the language switcher. Every content
    page's load() returns `altLocale` + `altHref` pointing at the
    same page in the other language (homepage → homepage, service
    → EN/DA twin by stable `service.id`). Fallback: derive from
    the current locale so the switcher always has a target even
    if a page ever forgets to publish these.
  */
  const altLocale = $derived(
    ($page.data?.altLocale as Locale | undefined) ??
      (locale === 'en' ? 'da' : 'en')
  );
  const altHref = $derived(
    ($page.data?.altHref as string | undefined) ??
      (altLocale === 'en' ? '/en' : '/')
  );

  /*
    Chapter-II split line — used by the homepage's cool→warm surface
    gradient. The homepage updates `stage.konsulentY` live from
    scroll; service pages leave it null (fall through to the CSS
    fallback of 200vh which puts the whole page in the cool
    variant) or set it to `0` (whole page warm, for konsulent
    service pages).
  */
  const konsulentStyle = $derived(
    stage.konsulentY !== null ? `${stage.konsulentY}px` : null
  );
</script>

<div class="app-shell" style:--konsulent-y={konsulentStyle}>
  <!--
    Single Stage mount for the whole content tree. Reads
    anchors + chapterMode from the store; pages publish their
    own values via `$effect` on mount / param changes. Because
    the mount persists across client-side navigation, the
    stage's internal lerp state eases the transition from the
    old page's pose to the new page's pose.
  -->
  <Stage anchors={stage.anchors} chapterMode={stage.chapterMode} />

  <SiteHeader
    name={hero.name}
    city={hero.city}
    {homeHref}
    {navLinks}
    currentLocale={locale}
    {altLocale}
    {altHref}
    burgerOpenLabel={locale === 'en' ? 'Open menu' : 'Åbn menu'}
    burgerCloseLabel={locale === 'en' ? 'Close menu' : 'Luk menu'}
    burgerMenuLabel={locale === 'en' ? 'Primary navigation' : 'Hovednavigation'}
  />

  <main>
    {@render children()}
    <ContactSection {contact} />
  </main>

  <SiteFooter text={footerCopyright} />
</div>

<style>
  /*
    Design tokens for the whole content tree. Lifted from the
    homepage's `.app-shell` block so every content route inherits the
    same palette + CTA gutters. Service pages used to duplicate
    a trimmed subset of these in their own `<ServicePage>` scope;
    that duplication is now gone.
  */
  .app-shell {
    /*
      Colour tokens. Named by ROLE, not hue — the actual values may
      drift across design iterations (e.g. `--accent` was a violet,
      is currently a sage green, could change again) without needing
      every consumer to rename along with them.

          --surface / --surface-warm — page backgrounds. The warm
            variant takes over below the chapter-II divider; see
            the `.app-shell` gradient below for how the handover
            is pinned to the `--konsulent-y` split line.

          --surface-alt — secondary surface, currently just the bio
            section's inset card.

          --text / --text-muted — primary + meta text.

          --accent — primary interactive colour: numbered list
            markers, CTA fill, read-more links, active locale,
            chapter-section numerals. The dominant "active" signal.

          --highlight — attention pop: chartreuse punctuation dot
            on CTAs, underline fills under pull-quotes and the
            `burde` word in the hero. The hover/reveal counterpart
            to --accent.

          --rule — subdued separator lines, derived from --text so
            the hairline stays tonally consistent with the text
            colour.
    */
    --surface: oklch(0.96 0.009 215);
    --surface-warm: oklch(0.94 0.03 72);
    --surface-alt: oklch(0.93 0.012 210);
    --text: oklch(0.17 0.012 240);
    --text-muted: color-mix(in oklch, var(--text) 70%, transparent);
    --highlight: oklch(0.94 0.26 120);
    --accent: oklch(0.48 0.09 152);
    --rule: color-mix(in oklch, var(--text) 18%, transparent);
    /*
      Sticky-CTA gutters. Inherited by `<StickyCta>` via custom-
      property inheritance AND used as `.chapter-wrap`
      padding-bottom so the CTA's sticky release happens at the
      same distance from the chapter divider as its viewport
      bottom gutter.
    */
    --cta-v: 1.5rem;
    --cta-h: max(1.25rem, calc((100vw - 1320px) / 2 + 1.25rem));
    --cta-h-box: 3.3rem;

    min-height: 100vh;
    /*
      Cool surface above the chapter-II divider, warm below.
      `--konsulent-y` is set from the store's `konsulentY` via
      the `style:` directive above. Unset (null) falls back to
      200vh — the whole page renders as cool surface (suits a
      terapi chapter / terapi service page). Setting 0px flips
      it to all warm (konsulent chapter or service).
    */
    background: linear-gradient(
      to bottom,
      var(--surface) 0,
      var(--surface) var(--konsulent-y, 200vh),
      var(--surface-warm) var(--konsulent-y, 200vh),
      var(--surface-warm) 100%
    );
    color: var(--text);
    font-family: var(--font-sans);
    font-weight: 300;
    position: relative;
    /*
      Stacking context for the fixed Stage canvas (z-index
      -1). Without `isolation: isolate` the canvas escapes to
      the root and paints behind everything including the body
      bg; contained, it paints above `.app-shell`'s gradient bg and
      below the flow content.
    */
    isolation: isolate;
  }
</style>
