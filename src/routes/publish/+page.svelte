<!--
  Publish to production.

  A one-button "push staging → main" page for non-technical editors.
  Sveltia CMS writes her edits to the `staging` branch; GH Actions
  redeploys signe.denfrievilje.dk within ~2 min; she reviews there,
  and when ready comes to this page and clicks "Publish to
  production" to merge staging into main. GH Actions then deploys
  skovbyesexologi.com from main.

  Why not a GH Actions "workflow_dispatch" button the user clicks on
  github.com? Because she's not a GitHub user in the technical sense
  — logging into GH, finding the repo, finding the Actions tab is
  friction we can eliminate. This page keeps her entirely in the
  tools she already has open.

  Auth: we piggy-back Sveltia's OAuth session. When she's logged in
  at `/admin`, Sveltia stores a user object at
  `localStorage['sveltia-cms.user']` that includes her GitHub access
  token (field name `token`). Same-origin pages can read that — so
  `/publish` reuses it without needing its own OAuth flow.
  Confirmed by the Sveltia source:
  https://github.com/sveltia/sveltia-cms/blob/main/src/lib/services/backends/git/shared/user.js

  If the token is missing or expired, we show a "sign in at /admin
  first" message with a link — one-click recovery.

  Publishing flow: open a PR with `POST /repos/:o/:r/pulls`, then
  immediately squash-merge it with `PUT /pulls/:n/merge` (method:
  squash). Two API calls instead of one, but both branch-protection
  rules on `main` are satisfied:

    1. "Changes must be made through a pull request" — yes, we
       create one.
    2. "This branch must not contain merge commits" — squash-merge
       lands a single linear commit on main, not a merge commit.

  Was previously a direct `POST /merges` (one API call, no PR), but
  that hit the protected-branch 409 the moment branch protection
  was enabled on main. Switched 2026-05-01.

  If a PR for `staging → main` is already open (e.g. a previous
  /publish run failed mid-flight, or a developer opened a manual
  promotion PR), `POST /pulls` returns 422 — we catch that, look
  up the existing PR via `GET /pulls?head=...&base=...`, and merge
  it instead of giving up.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { env } from '$env/dynamic/public';

  /*
    Configuration pulled from the public env (so the same route
    ships on both staging and production builds without hardcoding
    the repo name). Both values MUST be set for this page to work.
  */
  const REPO = env.PUBLIC_GITHUB_REPO ?? '';
  /** Branch Sveltia writes to. Lands in staging first. */
  const HEAD_BRANCH = 'staging';
  /** Branch that production deploys from. Merge target. */
  const BASE_BRANCH = 'main';

  type Commit = {
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    date: string;
  };

  let loading = $state(true);
  let error = $state<string | null>(null);
  let needsLogin = $state(false);
  let commits = $state<Commit[]>([]);
  let publishing = $state(false);
  let publishMessage = $state<string | null>(null);

  function getToken(): string | null {
    if (!browser) return null;
    try {
      const raw = localStorage.getItem('sveltia-cms.user');
      if (!raw) return null;
      const user = JSON.parse(raw) as { token?: string } | null;
      return user?.token ?? null;
    } catch {
      return null;
    }
  }

  async function ghFetch(path: string, init: RequestInit = {}): Promise<unknown> {
    const token = getToken();
    if (!token) {
      needsLogin = true;
      throw new Error('Not signed in.');
    }
    const res = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {})
      }
    });
    if (res.status === 401 || res.status === 403) {
      needsLogin = true;
      throw new Error('Your session has expired. Sign in again at /admin.');
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json();
  }

  async function loadDiff(): Promise<void> {
    loading = true;
    error = null;
    needsLogin = false;
    commits = [];
    if (!REPO) {
      error =
        'PUBLIC_GITHUB_REPO is not configured. This page was built without a target repo — rebuild with the env var set.';
      loading = false;
      return;
    }
    try {
      type CompareResp = {
        commits: Array<{
          sha: string;
          commit: { message: string; author: { name?: string; date?: string } };
        }>;
      };
      const data = (await ghFetch(
        `/repos/${REPO}/compare/${BASE_BRANCH}...${HEAD_BRANCH}`
      )) as CompareResp;
      commits = (data.commits ?? []).map((c) => ({
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        message: c.commit.message.split('\n')[0].slice(0, 200),
        author: c.commit.author?.name ?? 'unknown',
        date: c.commit.author?.date ?? ''
      }));
    } catch (e) {
      if (!needsLogin) error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  /**
   * Owner of the repo, e.g. `den-frie-vilje` from `den-frie-vilje/foo`.
   * GitHub's "list pulls" endpoint wants `head=owner:branch`.
   */
  function repoOwner(): string {
    return REPO.split('/')[0];
  }

  /**
   * Find an open `staging → main` PR if one exists. Returns its
   * number, or null if none. Used to recover from a partial
   * previous /publish run that opened a PR but didn't merge it.
   */
  async function findExistingPr(): Promise<number | null> {
    type ListPrsResp = Array<{ number: number }>;
    const list = (await ghFetch(
      `/repos/${REPO}/pulls?state=open&head=${repoOwner()}:${HEAD_BRANCH}&base=${BASE_BRANCH}`
    )) as ListPrsResp;
    return list.length ? list[0].number : null;
  }

  async function publish(): Promise<void> {
    publishing = true;
    error = null;
    publishMessage = null;
    try {
      const count = commits.length;
      const title = `Publish staging → ${BASE_BRANCH} (${count} commit${count === 1 ? '' : 's'})`;

      // 1. Open a PR. If one already exists for this head/base
      //    pair, GitHub returns 422 with "A pull request already
      //    exists" — fall through to look it up.
      type CreatePrResp = { number: number };
      let prNumber: number;
      try {
        const pr = (await ghFetch(`/repos/${REPO}/pulls`, {
          method: 'POST',
          body: JSON.stringify({
            title,
            head: HEAD_BRANCH,
            base: BASE_BRANCH,
            body: 'Auto-created from /publish — squash-merged immediately on open.'
          })
        })) as CreatePrResp;
        prNumber = pr.number;
      } catch (e) {
        const existing = await findExistingPr();
        if (existing == null) throw e;
        prNumber = existing;
      }

      // 2. Squash-merge it. Lands a single non-merge commit on
      //    `main` so the "no merge commits" branch-protection rule
      //    stays happy. The squash commit's message preserves the
      //    individual content commit messages from staging.
      await ghFetch(`/repos/${REPO}/pulls/${prNumber}/merge`, {
        method: 'PUT',
        body: JSON.stringify({
          merge_method: 'squash',
          commit_title: title,
          commit_message: commits.map((c) => `- ${c.shortSha} ${c.message}`).join('\n')
        })
      });

      publishMessage = `${count} commit${count === 1 ? '' : 's'} merged into ${BASE_BRANCH} via PR #${prNumber}. Production deploy starting — skovbyesexologi.com should reflect the change within ~2 minutes.`;
      await loadDiff();
    } catch (e) {
      if (!needsLogin) error = (e as Error).message;
    } finally {
      publishing = false;
    }
  }

  function formatDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  onMount(loadDiff);
</script>

<svelte:head>
  <title>Publish — Skovbye Sexologi</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="publish">
  <header class="hd">
    <p class="eyebrow">Skovbye Sexologi</p>
    <h1>Publish to production</h1>
    <p class="subtitle">
      Changes saved via <a href="/admin">the admin editor</a> land first on
      <strong>staging</strong>
      (signe.denfrievilje.dk) for review. When you're ready for the changes to go
      live on <strong>skovbyesexologi.com</strong>, click the button below.
    </p>
  </header>

  {#if loading}
    <p class="status" role="status">Loading staged changes…</p>
  {:else if needsLogin}
    <section class="card">
      <h2>Sign in first</h2>
      <p>
        This page uses the same sign-in as the admin editor. Open
        <a href="/admin">/admin</a>, sign in with GitHub, then come back here.
      </p>
      <p>
        <a class="btn btn-ghost" href="/admin">Open /admin →</a>
      </p>
    </section>
  {:else if error}
    <section class="card card-error" role="alert">
      <h2>Couldn't reach GitHub</h2>
      <p class="error-text">{error}</p>
      <p>
        <button class="btn btn-ghost" type="button" onclick={loadDiff}>Try again</button>
      </p>
    </section>
  {:else if commits.length === 0}
    <section class="card card-calm">
      <h2>Nothing to publish</h2>
      <p>Production is already in sync with staging — no unpublished changes.</p>
      {#if publishMessage}
        <p class="success-text">{publishMessage}</p>
      {/if}
      <p>
        <a class="btn btn-ghost" href="/admin">← Back to admin</a>
      </p>
    </section>
  {:else}
    <section class="card">
      <h2>
        {commits.length} commit{commits.length === 1 ? '' : 's'} waiting on staging
      </h2>
      <ul class="commits">
        {#each commits as c (c.sha)}
          <li>
            <code class="sha">{c.shortSha}</code>
            <span class="msg">{c.message}</span>
            <span class="meta">{c.author} · {formatDate(c.date)}</span>
          </li>
        {/each}
      </ul>

      <button class="btn btn-primary" type="button" onclick={publish} disabled={publishing}>
        {publishing ? 'Publishing…' : `Publish ${commits.length} commit${commits.length === 1 ? '' : 's'} to production`}
      </button>

      {#if publishMessage}
        <p class="success-text" role="status">{publishMessage}</p>
      {/if}
    </section>
  {/if}

  <footer class="ft">
    <p>
      <a href="/admin">← Back to admin</a>
    </p>
  </footer>
</main>

<style>
  /*
    Intentionally NOT inside the `.app-shell` design system — this
    is a tool page for the editor, not a public-facing document.
    Minimal styling, reuses `--font-mono` / `--font-serif` /
    `--font-sans` from app.css (available site-wide) but no
    custom palette tokens since those live on the app-shell
    wrapper. Local literal colour values keep this page
    standalone if it's ever served outside the (app) layout.
  */
  .publish {
    max-width: 720px;
    margin: 0 auto;
    padding: 3rem 1.5rem 4rem;
    font-family: var(--font-sans);
    color: #1a1a1f;
    min-height: 100vh;
    background: #f7f5ef;
  }
  .hd {
    margin-bottom: 2.5rem;
  }
  .eyebrow {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #6a685e;
    margin: 0 0 1rem;
  }
  h1 {
    font-family: var(--font-serif);
    font-size: clamp(1.8rem, 4vw, 2.6rem);
    line-height: 1.1;
    margin: 0 0 1rem;
  }
  .subtitle {
    font-size: 0.95rem;
    line-height: 1.55;
    color: #3a3a42;
    max-width: 58ch;
  }
  .subtitle strong {
    font-weight: 600;
  }

  .card {
    background: #fff;
    border: 1px solid #e4e0d4;
    border-radius: 6px;
    padding: 1.5rem 1.75rem 1.75rem;
    margin-bottom: 1.5rem;
  }
  .card-error {
    border-color: #c47272;
    background: #fdf4f4;
  }
  .card-calm {
    background: #f0ede3;
  }
  .card h2 {
    font-family: var(--font-serif);
    font-size: 1.2rem;
    margin: 0 0 1rem;
    font-weight: 500;
  }

  .commits {
    list-style: none;
    padding: 0;
    margin: 0 0 1.5rem;
    display: grid;
    gap: 0.5rem;
  }
  .commits li {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    gap: 0 0.75rem;
    align-items: baseline;
    padding: 0.6rem 0;
    border-bottom: 1px solid #ece8db;
    font-size: 0.92rem;
  }
  .sha {
    grid-column: 1;
    grid-row: 1 / 3;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: #6a685e;
    align-self: start;
    padding-top: 0.15rem;
  }
  .msg {
    grid-column: 2;
    line-height: 1.35;
  }
  .meta {
    grid-column: 2;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    color: #6a685e;
    margin-top: 0.15rem;
  }

  .btn {
    display: inline-block;
    border: none;
    border-radius: 4px;
    padding: 0.7rem 1.4rem;
    font-family: var(--font-sans);
    font-size: 0.92rem;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.15s ease;
  }
  .btn-primary {
    background: #3d5e44;
    color: #f7f5ef;
  }
  .btn-primary:hover:not(:disabled),
  .btn-primary:focus-visible:not(:disabled) {
    background: #2d4733;
  }
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: progress;
  }
  .btn-ghost {
    background: transparent;
    color: #3d5e44;
    border: 1px solid #c8c2b0;
    padding: 0.55em 1.1em;
  }
  .btn-ghost:hover,
  .btn-ghost:focus-visible {
    background: #edeadc;
  }

  .status {
    color: #6a685e;
    font-size: 0.95rem;
  }
  .error-text {
    color: #a43b3b;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .success-text {
    color: #3d5e44;
    font-size: 0.95rem;
    margin-top: 1rem;
  }

  .ft {
    margin-top: 2.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e4e0d4;
    color: #6a685e;
  }
  .ft a {
    color: inherit;
  }
</style>
