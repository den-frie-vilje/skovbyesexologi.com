# Deployment

Pull-replication pipeline: GitHub Actions builds a container
image, pushes it to GHCR, and POSTs an HMAC-signed webhook to
the NAS. The NAS pulls the image, applies compose changes, and
(optionally) purges Cloudflare edge cache.

No inbound SSH, no mesh VPN, no US-cloud control plane. The only
inbound port on the NAS is :443 — the same port the public site
already needs.

This document covers the **generalised pattern** — every site
hosted on `server.denfrievilje.dk` follows it identically. The
specific values below show the skovbyesexologi.com instantiation.

---

## The URL pattern

Every site has three hostnames:

| Role | Shape | Example |
| --- | --- | --- |
| Staging canonical origin | `$DOMAIN.stage.denfrievilje.dk` | `skovbyesexologi.com.stage.denfrievilje.dk` |
| Production canonical origin | `$DOMAIN.prod.denfrievilje.dk` | `skovbyesexologi.com.prod.denfrievilje.dk` |
| Client-facing (production) | `$DOMAIN` | `skovbyesexologi.com` |

`$DOMAIN` = the site's real, customer-owned domain (what end
users type). The staging + production origins are deterministic
from `$DOMAIN` — no per-site DNS config needed once the two
wildcards are in place (§1 below).

**Clients who want a vanity domain** CNAME their apex to
`$DOMAIN.prod.denfrievilje.dk`. They can change providers, add
Cloudflare, migrate registrars freely — nothing on your side
moves.

**Scripts only need `$DOMAIN`** to derive everything else:
webhook URLs, stack paths, compose project names, auth origins.

---

## Architecture

```
  ┌─────────┐         ┌──────────┐   push:<branch>   ┌──────────────┐
  │ Sveltia │ ──save─▶│  GitHub  │ ─────────────────▶│ GH Actions   │
  │ /admin  │         │ staging  │                   │ build image  │
  └─────────┘         │ or main  │                   │ push to GHCR │
                      └──────────┘                   │ POST webhook │
                                                     └──────┬───────┘
                                                            │  HTTPS
                                                            │  HMAC signed
                                                            ▼
  ┌────────────────────────────────────────────────────────────────┐
  │  NAS — server.denfrievilje.dk                                  │
  │                                                                │
  │   Web Station (DSM nginx, :443, Let's Encrypt)                 │
  │         │                                                      │
  │         │  vhost per (site, env) → loopback port               │
  │         ▼                                                      │
  │   Caddy per-stack :808n                                        │
  │         ├──  /hooks/*   ──▶  webhook (shared, HMAC verify)     │
  │         │                         │                            │
  │         │                         ▼                            │
  │         │                    /scripts/deploy.sh <env>          │
  │         │                         ├─ git fetch $BRANCH         │
  │         │                         ├─ docker compose pull site  │
  │         │                         ├─ docker compose            │
  │         │                         │     up -d --wait           │
  │         │                         └─ purge Cloudflare (opt)    │
  │         ├──  /auth/*    ──▶  sveltia-auth  (staging only)      │
  │         └──  /*         ──▶  site (nginx + static)             │
  └────────────────────────────────────────────────────────────────┘
```

One shared `webhook` container on the NAS receives deploys for
ALL sites. One `Caddy` front-door per (site, env) stack. One
`site` container per (site, env) serving prerendered static HTML.

---

## Repository layout

```
deploy/
├── Dockerfile                  ← site image (nginx:alpine + build/)
├── nginx.conf                  ← site-container nginx config
├── Caddyfile.staging           ← staging front-door routes
├── Caddyfile.production        ← production front-door routes
├── compose.staging.yml         ← staging stack (caddy + site + auth)
├── compose.production.yml      ← production stack (caddy + site)
├── compose.webhook.yml         ← shared HMAC webhook receiver
├── compose.local.yml           ← laptop-dev override
├── staging.env.example         ← OAuth secrets (→ NAS only)
├── webhook.env.example         ← HMAC + CF secrets (→ NAS only)
└── webhook/
    ├── Dockerfile              ← almir/webhook + docker-cli + git + curl
    ├── hooks.yaml              ← endpoint definitions + HMAC rules
    └── scripts/
        └── deploy.sh           ← unified (staging|production)
```

Compose files and scripts travel **in this repo** — branch-staged,
PR-reviewable, rollback-able via `git revert`. The NAS maintains
a shallow clone at `/volume1/docker/$DOMAIN/repo`; every webhook
fire does `git fetch + reset --hard` before invoking `docker
compose`.

---

## NAS filesystem layout

All sites follow this layout under `/volume1/docker`:

```
/volume1/docker/
├── webhook/                          ← shared receiver (one per NAS)
│   ├── compose.yml
│   ├── webhook.env                   ← DOMAIN, HMAC secrets, CF tokens
│   ├── webhook/                      ← image build context
│   │   ├── Dockerfile
│   │   ├── hooks.yaml
│   │   └── scripts/deploy.sh
│   └── …
├── $DOMAIN/                          ← per-site root (e.g. skovbyesexologi.com/)
│   ├── repo/                         ← shallow git clone
│   ├── staging/
│   │   └── staging.env               ← this env's OAuth secrets
│   └── production/
└── $DOMAIN_2/
    └── …
```

Adding a new site only creates `/volume1/docker/$DOMAIN_2/`
and its subdirs — no changes to the `webhook/` directory
(beyond adding a new DOMAIN + HMAC secret pair to
`webhook.env`).

---

## One-time NAS setup (do once, reuse for every site)

### 1. DNS — wildcards for stage + prod

In your DNS provider for `denfrievilje.dk`:

```
*.stage.denfrievilje.dk   A/AAAA   <NAS public IP>
*.prod.denfrievilje.dk    A/AAAA   <NAS public IP>
```

That's it. Any future site `example.com` becomes reachable at
`example.com.stage.denfrievilje.dk` and `example.com.prod.denfrievilje.dk`
without further DNS work.

**If your DNS provider supports CAA records**, also set:
```
denfrievilje.dk   CAA   0 issue "letsencrypt.org"
```
So Let's Encrypt is authorized to issue certs for any subdomain.

### 2. Synology — Container Manager + Let's Encrypt wildcard cert

On DSM:

1. **Install Container Manager.** Package Center → search
   "Container Manager" → Install.

2. **Install Let's Encrypt wildcard certs** for the two sub-
   zones. These are what every future site's staging + prod
   origins will use — issued once, attached to each new vhost
   through the DSM GUI when you add it.

   Wildcard issuance requires **DNS-01 challenge** (not
   HTTP-01). DSM's built-in Let's Encrypt only supports
   HTTP-01, so wildcards live outside the GUI's direct
   issuance flow. Use **acme.sh** for the two wildcards ONLY;
   DSM's built-in LE keeps handling everything else (individual
   hostname certs via HTTP-01 for per-site vhosts, DSM's own
   web UI cert, File Station, etc.).

   **acme.sh does not collide with DSM's LE.** They have
   separate cert stores (`~/.acme.sh/` vs
   `/usr/syno/etc/certificate/`), issue for different domain
   shapes (wildcards vs individual hostnames), and DSM's
   Certificate UI is the *single source of truth* for
   cert↔vhost bindings either way — acme.sh's job is just to
   *populate* the DSM cert store with the two wildcards, not
   to manage bindings.

   SSH into the NAS as admin:
   ```sh
   # Install acme.sh. DSM doesn't ship cron (it has Task
   # Scheduler instead, see step (c) below), so acme.sh's
   # install check will bail unless we pass `--force`.
   curl https://get.acme.sh | sh -s email=<your-email> -- --force

   # Issue the wildcards via your DNS provider's API. Example
   # below is for Cloudflare — see the acme.sh dnsapi wiki for
   # other providers.
   export CF_Token="<CF API token with Zone:DNS:Edit on denfrievilje.dk>"
   export CF_Account_ID="<CF account ID>"
   ~/.acme.sh/acme.sh --issue --dns dns_cf \
     -d '*.stage.denfrievilje.dk' -d 'stage.denfrievilje.dk'
   ~/.acme.sh/acme.sh --issue --dns dns_cf \
     -d '*.prod.denfrievilje.dk'  -d 'prod.denfrievilje.dk'

   # One-time deploy hook: import the issued cert into DSM's
   # cert store via DSM's WebAPI. After this runs, the cert
   # appears in DSM → Control Panel → Security → Certificate
   # alongside whatever DSM already issued, and you can bind
   # it to vhosts through the usual DSM UI.
   export SYNO_Username=<DSM admin user>
   export SYNO_Password=<DSM admin password>
   ~/.acme.sh/acme.sh --deploy --deploy-hook synology_dsm \
     -d '*.stage.denfrievilje.dk'
   ~/.acme.sh/acme.sh --deploy --deploy-hook synology_dsm \
     -d '*.prod.denfrievilje.dk'
   ```

   **(c) Schedule auto-renewal via DSM Task Scheduler.** DSM
   doesn't have `cron`, so acme.sh can't install its normal
   renewal cron entry — we use DSM's Task Scheduler instead.
   DSM → Control Panel → Task Scheduler → Create →
   **Scheduled Task** → **User-defined script**:

   - **General**: Task name `acme.sh renewal`, User `root`,
     Enabled ✓
   - **Schedule**: Daily at 03:00 (or weekly — certs have 30
     days of renewal slack, daily just catches DNS or API
     failures sooner)
   - **Task Settings → Run command**:
     ```sh
     "/root/.acme.sh/acme.sh" --cron --home "/root/.acme.sh" > /var/log/acme-renewal.log 2>&1
     ```
   - **Task Settings → Notification**: "Send run details by
     email" + enter your email. Silent failure is the worst
     outcome here — TLS expiring mid-quarter is painful.

   Click OK, then hit **Run** on the task once to verify it
   executes without errors. `acme.sh --cron` is idempotent and
   a no-op if no certs need renewal, so running it ad-hoc is
   safe — it just confirms the setup works.

   In DSM → Control Panel → Security → Certificate you should
   now see two new entries (`*.stage.denfrievilje.dk` and
   `*.prod.denfrievilje.dk`) next to whatever DSM already
   managed. They're normal certs from DSM's perspective —
   bind them to vhosts in the usual way.

3. **Create the `deploy` user.** DSM → Control Panel → User &
   Group → Create. Username `deploy`. No login needed (account
   exists to own the docker directories). Group: default Users,
   no admin.

4. **Create the webhook directory + shared docker network.**
   SSH in as admin:
   ```sh
   sudo mkdir -p /volume1/docker/webhook/webhook/scripts
   sudo chown -R deploy:users /volume1/docker
   sudo docker network create skovbye-deploy
   ```

5. **Bootstrap the webhook container.** This step is done
   **once per NAS**, not once per site.

   ```sh
   # Pull the webhook compose file + image build context.
   # Easiest: copy from the first site's cloned repo, but any
   # repo with deploy/compose.webhook.yml + deploy/webhook/
   # works — they're identical across sites.
   REPO=/tmp/skovbye-bootstrap
   git clone --depth 1 \
     https://github.com/den-frie-vilje/skovbyesexologi.com.git \
     "$REPO"

   sudo cp "$REPO/deploy/compose.webhook.yml" \
           /volume1/docker/webhook/compose.yml
   sudo cp -r "$REPO/deploy/webhook/"* \
              /volume1/docker/webhook/webhook/
   sudo chown -R deploy:users /volume1/docker/webhook
   rm -rf "$REPO"
   ```

   The webhook is **bootstrapped once and updated manually** —
   it does NOT self-update via the pipeline. This avoids the
   chicken-and-egg failure mode where a broken webhook upgrade
   leaves you unable to deploy anything including a webhook
   fix.

---

## Per-site setup (repeat for every new site)

### 3. GitHub — OAuth app + repo secrets

1. **Register a GitHub OAuth App** at
   <https://github.com/settings/applications/new>:
   - Application name: `<site> CMS`
   - Homepage URL: `https://<DOMAIN>` (e.g. `https://skovbyesexologi.com`)
   - Authorization callback URL:
     `https://<DOMAIN>.stage.denfrievilje.dk/auth/callback`

   Copy the generated **Client ID** + **Client Secret**.

2. **Generate webhook HMAC secrets** — two random strings, one
   per environment:
   ```sh
   openssl rand -hex 32   # → STAGING_WEBHOOK_SECRET
   openssl rand -hex 32   # → PRODUCTION_WEBHOOK_SECRET
   ```
   These go into the repo (as-named). The NAS stores the same
   values under domain-prefixed names — see §5.

3. **(Optional) Cloudflare cache-purge tokens.** See the
   zone-sharing gotcha in §7 below before deciding whether to
   set these up for this site.

4. **On GitHub** → the repo → Settings → Secrets and variables →
   Actions → **New repository secret**:

   | Secret | Value |
   | --- | --- |
   | `STAGING_WEBHOOK_SECRET` | from step 2 |
   | `PRODUCTION_WEBHOOK_SECRET` | from step 2 |

5. **Environments** (Settings → Environments → New):
   create `staging` and `production`. Optional: add a required
   reviewer on `production` to gate deploys behind manual
   approval.

6. **Branch protection** (Settings → Branches):
   - `main`: require PR before merging. Allow merge from
     `staging` (Signe's `/publish` button merges via API).
   - `staging`: no protection — Sveltia pushes freely here.

### 4. NAS — site directory + secrets + clone

SSH in as the admin (not `deploy` — the admin has sudo):

```sh
DOMAIN=skovbyesexologi.com   # ← change per site

# Per-site directory structure.
sudo mkdir -p /volume1/docker/"$DOMAIN"/{repo,staging,production}
sudo chown -R deploy:users /volume1/docker/"$DOMAIN"

# Shallow clone of the site's repo.
sudo -u deploy git clone --depth 1 \
  https://github.com/den-frie-vilje/skovbyesexologi.com.git \
  /volume1/docker/"$DOMAIN"/repo

# Staging env file (OAuth secrets).
sudo -u deploy cp /volume1/docker/"$DOMAIN"/repo/deploy/staging.env.example \
                  /volume1/docker/"$DOMAIN"/staging/staging.env
sudo chmod 600 /volume1/docker/"$DOMAIN"/staging/staging.env
# Edit: set DOMAIN=, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET.
sudo nano /volume1/docker/"$DOMAIN"/staging/staging.env
```

### 5. NAS — append to webhook.env + hooks.yaml (per site)

The shared `webhook.env` and `hooks.yaml` live in
`/volume1/docker/webhook/` and cover every site on the NAS.
Each site appends its own entries — never overwrites.

**First-site bootstrap** (one-time — only needed when setting
up the very first site on this NAS):
```sh
sudo -u deploy cp /volume1/docker/"$DOMAIN"/repo/deploy/webhook.env.example \
                  /volume1/docker/webhook/webhook.env
sudo chmod 600 /volume1/docker/webhook/webhook.env
```

**Every site (including the first)** — append HMAC secrets
under DOMAIN-prefixed keys. Naming convention:
`<DOMAIN_SAFE>_<ENV>_<NAME>` where `DOMAIN_SAFE` =
uppercase + dots→underscores. For `skovbyesexologi.com`:

```sh
sudo nano /volume1/docker/webhook/webhook.env
```
Add (values from §3 step 2):
```
SKOVBYESEXOLOGI_COM_STAGING_WEBHOOK_SECRET=<openssl output 1>
SKOVBYESEXOLOGI_COM_PRODUCTION_WEBHOOK_SECRET=<openssl output 2>

# Optional CF purge (see §7 for zone-sharing gotcha):
SKOVBYESEXOLOGI_COM_PRODUCTION_CF_API_TOKEN=
SKOVBYESEXOLOGI_COM_PRODUCTION_CF_ZONE_ID=
```

**Add two hook entries** to the shared hooks.yaml, one per
environment. Copy the skovbyesexologi.com block from
`deploy/webhook/hooks.yaml` as the template — each new site
follows the same shape with its own domain + HMAC var name.

```sh
sudo nano /volume1/docker/webhook/webhook/hooks.yaml
```

With `-hotreload` on the webhook command, hooks.yaml edits
are picked up live — no container restart needed.

**Security property**: the domain in each hook entry's args
is a static string, not read from the incoming request. An
attacker with a valid HMAC for one site's hook cannot pivot
to another site's deploy path.

### 6. NAS — Web Station vhosts

DSM → Web Station → Web Service Portal → **Create**:

1. **Staging vhost:**
   - Hostname: `<DOMAIN>.stage.denfrievilje.dk`
     (e.g. `skovbyesexologi.com.stage.denfrievilje.dk`)
   - Back-end: nginx
   - HTTPS: select the `*.stage.denfrievilje.dk` wildcard cert
     from §2.2
   - Advanced → Custom location:
     ```nginx
     location / {
       proxy_pass http://127.0.0.1:8080;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
     ```
   - Custom headers:
     ```
     X-Robots-Tag: noindex, nofollow
     ```

2. **Production vhost:** one DSM vhost serves every hostname
   that should route to this site — apex, www, legacy brand
   domains. All of them land in Caddy, which either serves
   (canonical) or 301-redirects (non-canonical) based on the
   Host header.

   **Hostname list** (all as SANs on one vhost):
   - `<DOMAIN>.prod.denfrievilje.dk` (canonical NAS origin)
   - `<DOMAIN>` (the client-facing apex)
   - `www.<DOMAIN>` (if used)
   - Any legacy domains that should redirect or serve here

   **TLS strategy** depends on whether the client uses a CDN:

   - **Client fronts with CF / other CDN**: CDN terminates TLS
     for the client-facing hostnames. Only add
     `<DOMAIN>.prod.denfrievilje.dk` to this vhost and bind it
     to the `*.prod.denfrievilje.dk` wildcard cert. The client
     domains arrive at the NAS with their host header intact
     (via CDN origin-pull) but TLS is already handled.

   - **No CDN, NAS terminates TLS**: add every client hostname
     to the vhost's hostname list AND as SANs on a DSM-managed
     LE cert. DSM's built-in LE issues multi-SAN certs via
     HTTP-01 — each SAN's A record must resolve to the NAS at
     issuance time. Alternatively, issue a multi-domain cert
     via acme.sh and import into DSM (same pattern as the
     wildcards in §2).

   - Back-end: nginx
   - Advanced → Custom location:
     ```nginx
     location / {
       proxy_pass http://127.0.0.1:8081;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
     ```

   Pick a unique loopback port per site (8080/8081 for site A,
   8082/8083 for site B, …). The per-site Caddy containers bind
   to their assigned port — see the `ports:` line in
   `compose.staging.yml` / `compose.production.yml`. When adding
   the second site, edit those files (or parametrize via env).

3. **Canonicalization + redirect** — each site decides which
   hostname is the "real" one. The repo's
   `deploy/Caddyfile.production` has an `@non_canonical` matcher
   block listing every hostname that should 301-redirect to the
   canonical apex. Edit that block when adding a new hostname:
   ```caddy
   @non_canonical {
       host www.skovbyesexologi.com
       host skovbyesexologi.com.prod.denfrievilje.dk
       # host legacy-brand.dk     ← new entries here
   }
   redir @non_canonical https://skovbyesexologi.com{uri} 301
   ```
   Commit → merge → webhook fires → Caddy hot-reloads with the
   new redirect. Reviewable in PR; no NAS UI work beyond step 2
   above.

4. **Ask the site owner to CNAME their apex** to
   `<DOMAIN>.prod.denfrievilje.dk`. For a CF-proxied domain:
   - `<DOMAIN>` CNAME → `<DOMAIN>.prod.denfrievilje.dk`, orange cloud on
   - CF issues the cert for `<DOMAIN>` automatically
   - NAS only needs the wildcard cert for `.prod.*`

   Repeat for any www or legacy domains (each points at the
   same `.prod.denfrievilje.dk` origin; Caddy sorts out who's
   canonical).

### 7. Cloudflare cache purge decision (per site)

Production side (`$DOMAIN`): usually a dedicated CF zone. Set
the production CF vars in `webhook.env` → purges work fine.

Staging side (`$DOMAIN.stage.denfrievilje.dk`): shares the
`denfrievilje.dk` zone with every other staging site. Free-plan
CF purge is whole-zone-only, so enabling purge here would nuke
the cache for every sibling staging site on every deploy.

Recommended staging setup: **grey-cloud the wildcard.** In
Cloudflare's DNS panel for `denfrievilje.dk`, set the
`*.stage` record to "DNS only" (grey cloud). All staging traffic
goes origin-direct, no edge cache, no purge needed. Leave
`STAGING_CF_*` blank in `webhook.env`.

### 8. First deploy

```sh
# On your laptop — push any commit to staging to exercise
# the whole pipeline.
git push origin staging
```

Watch the Actions run; then tail the webhook logs on the NAS:
```sh
sudo docker logs -f webhook-webhook-1
```

Staging works? Merge to `main` to verify the production path
the same way.

### 9. Activate the GitHub backend in Sveltia

Once the OAuth flow at `https://<DOMAIN>.stage.denfrievilje.dk/auth/*`
is reachable (after the first staging deploy lands), switch
`static/admin/config.yml`:
- Comment out the `backend: name: test-repo` block
- Uncomment the `backend: name: github …` block

Commit, push. Sveltia now authenticates against GitHub via your
self-hosted OAuth proxy and writes edits to the `staging`
branch.

---

## How it runs day-to-day

### Editor flow (Signe)

1. Visit `https://<DOMAIN>.stage.denfrievilje.dk/admin`. Sign in
   with GitHub on first visit.
2. Edit content → Save → commits to `staging`.
3. Wait ~2 min; refresh `<DOMAIN>.stage.denfrievilje.dk`.
4. Happy? Visit `.../publish` on the same domain → click
   **Publish to production** → merges `staging → main`.
5. Wait ~2 min. `<DOMAIN>` is live, CF cache purged.

### Developer flow

Normal git flow on `main` (PRs, review). Compose/deploy changes
go through PR on `main` — you can test them on `staging`
first by merging there before main.

### Local-dev the deploy stack

Debug Dockerfile / nginx / Caddyfile / compose changes without
round-tripping through the NAS:

```sh
pkgx pnpm build
docker compose \
  -f deploy/compose.staging.yml \
  -f deploy/compose.local.yml \
  up --build
# → http://localhost:8080
```

Override replaces the GHCR-pulled site image with a local build,
drops the OAuth proxy, binds to a laptop-reachable port.

### Rollback

GitHub UI → Actions → **Rollback** workflow → Run workflow.
Paste the immutable image tag from an earlier deploy summary
(e.g. `production-2026-04-23T14-02-19Z-abc12345`). The workflow
retags `<env>-latest` at the registry manifest level and POSTs
the deploy webhook — old release serving in ~15s.

List recent tags:
```sh
gh api /users/den-frie-vilje/packages/container/skovbyesexologi/versions \
  --jq '.[].metadata.container.tags[]' \
  | sort -u | head -40
```

---

## Troubleshooting

**GH Actions build fails on `docker push`.** GHCR token doesn't
have write access. Settings → Actions → General → Workflow
permissions → "Read and write permissions".

**Webhook returns 403.** HMAC mismatch between the repo's
GH Actions secret and the NAS's `webhook.env`. Re-paste from the
`openssl rand -hex 32` output — whitespace/newline issues are
the common cause.

**Webhook returns 200 but nothing happens.** Tail the webhook
logs:
```sh
sudo docker logs -f webhook-webhook-1
```
Likely `git fetch` perms (chown the repo clone to `deploy:users`)
or `docker compose pull` failure (check GHCR image visibility is
Public).

**`/admin` loops on sign-in.** OAuth callback URL mismatch. GH
OAuth App's callback must be **exactly**
`https://<DOMAIN>.stage.denfrievilje.dk/auth/callback` — check
for typos and trailing slash.

**Site stays stale after production deploy.** CF purge failed.
Check webhook logs for `warn: CF purge failed`; verify CF token
scope (Zone → Cache Purge → Purge) and zone ID.

**TLS handshake fails on a new site's client domain.** Either
the CF-proxy cert isn't provisioned yet (takes ~15 min), or the
DSM LE cert for the client domain couldn't issue (HTTP-01 needs
the A record to already point at the NAS). If the client is
CF-fronted, delete any DSM cert for their apex — CF handles it.

**Container Manager → Projects tab is empty.** DSM 7.2.0/7.2.1
bug — CLI-created projects appear only after a DSM restart.
Fixed in 7.2.2+. Running containers in the Containers tab still
show up regardless.

---

## Reusing this on another site

Per-site work collapses to:
1. New GitHub OAuth App with new callback URL
2. Copy `deploy/` + workflows from this repo, change `image-name`
   input in `deploy-*.yml` to match the new site's GHCR path
3. Bootstrap §4 on the NAS with the new `$DOMAIN`
4. Add the new site's vhosts (§6) on unused loopback ports
5. Ask the site owner to CNAME to `$DOMAIN.prod.denfrievilje.dk`

Zero new users, keys, or mesh nodes per site. Wildcard DNS +
wildcard cert + shared webhook + naming convention do all the
repetitive work.

---

## Future generalisation

This deployment was built to work as a one-off for skovbye
AND to be the *seed* for a NAS-wide shared hosting pattern.
This chapter captures the roadmap so it doesn't get lost when
we inevitably set up the second site.

### Three stages

The generalisation happens in three stages, **only advance when
the current stage has proven itself**:

**Stage 1 (now): single-site, everything lives in this repo.**
The `deploy/` directory is site-specific. Workflows, compose
files, scripts are copy-paste-able but not yet extracted. This
is where we are.

**Stage 2 (after first successful deploy + second site): lift
the shared bits into `den-frie-vilje/nas-sites`.** That repo
contains:

```
nas-sites/
├── ansible/
│   ├── bootstrap-nas.yml       ← one-shot NAS provisioning
│   └── bootstrap-site.yml      ← per-site NAS bootstrap
├── shared/
│   └── webhook/                ← Dockerfile, hooks.yaml, scripts,
│                                  compose.yml — deployed to NAS
│                                  via bootstrap-nas
└── templates/
    ├── sveltekit-static/       ← the skovbye shape, parameterised
    │   ├── deploy/…
    │   └── .github/workflows/…
    ├── astro-static/           ← same shape, other generators
    └── node-api/               ← for backend-ish services
```

After extraction, this repo's `deploy/` and `.github/workflows/`
become thin: either git-submodule'd from the template, or
regenerated from it via cookiecutter on major template
updates. The shared webhook container on the NAS gets updated
by pulling `nas-sites` and re-running `bootstrap-nas.yml`.

**Stage 3 (after 3-4 sites onboarded, if it hurts): consider
Traefik-as-front-door.** See "Traefik alternative" below —
gives up DSM Web Station integration in exchange for
declarative routing + automatic cert issuance per site. NOT
a day-one decision; revisit when manual Web Station clicks
per new client domain become the bottleneck.

### Gradual migration for existing client services

Existing sites on the NAS (whatever their current deploy
mechanism) migrate one at a time, **without downtime**. The
shared infrastructure is purely additive — it doesn't touch
existing vhosts or certs.

For each site to migrate:

1. **Add deploy scaffolding to the site's repo.** Copy from
   the `sveltekit-static` template (or adapt if it's a
   different generator): `deploy/` dir, workflows, GHCR image
   name, loopback port allocation (pick two free ports).
2. **Bootstrap NAS-side directories**: `/volume1/docker/$DOMAIN/`
   per §4, plus webhook.env entries per §5.
3. **Create NEW Web Station vhosts** for the site's
   `.stage.*` and `.prod.*` origins. The site's existing
   vhost (whatever hostname it lives on now) stays untouched.
   Both stacks run in parallel.
4. **Verify** the new stack by hitting
   `https://$DOMAIN.prod.denfrievilje.dk/` — should serve the
   same content as the old stack.
5. **Flip DNS**: change the client-facing domain from whatever
   record points at the old origin to a CNAME to
   `$DOMAIN.prod.denfrievilje.dk`. This is the cutover;
   traffic starts hitting the new stack.
6. **Wait 24-48h** for DNS propagation + any residual cached
   DNS, confirming traffic is fully on the new vhost.
7. **Decommission** the old vhost and whatever deploy
   mechanism fed it. Delete the old Docker containers, old
   cron jobs, old CI workflows.

Key property: at step 5, both stacks are running and serving
correctly. If the new stack misbehaves, flip DNS back and
nothing was lost.

### What Ansible looks like

`bootstrap-nas.yml` runs once per NAS and covers §1-§2 of this
doc plus the webhook bootstrap from §4:

```yaml
# pseudo-structure — real roles TBD in nas-sites repo
- hosts: nas
  roles:
    - role: docker
    - role: acme_sh
      vars:
        wildcards:
          - '*.stage.denfrievilje.dk'
          - '*.prod.denfrievilje.dk'
        dns_provider: dns_cf
        deploy_hook: synology_dsm
    - role: shared_network
    - role: webhook_container
      vars:
        compose_src: "{{ role_path }}/../shared/webhook"
```

`bootstrap-site.yml` runs once per new site and covers §4
(per-site NAS dirs, env files, webhook.env append):

```yaml
- hosts: nas
  vars_prompt:
    - { name: domain, prompt: "Site domain", private: no }
    - { name: oauth_client_id, prompt: "GitHub OAuth client ID", private: no }
    - { name: oauth_client_secret, prompt: "GitHub OAuth client secret", private: yes }
  roles:
    - role: site_bootstrap
```

The `site_bootstrap` role creates `/volume1/docker/$DOMAIN/`,
writes `staging.env` with the right OAuth creds, clones the
repo, and appends a webhook.env block.

**Not yet built** — these are sketches to implement when we
do stage 2.

### What *doesn't* generalise

Not everything in this repo is template material:

- **Sveltia CMS presence**: static sites without a CMS don't
  need `sveltia-auth`, the `/auth/*` routing, or
  `staging.env`. The template needs a "with-cms" flag.
- **`/publish` page**: specific to this site's Sveltia setup.
  Not a template.
- **OG drift watcher workflow**: specific to sites with
  GPU-dependent preview generation. Not a template.
- **Pose-option editor widgets in admin/config.yml**: obviously
  site-specific.

The template covers the *deploy* shape. The site's own
peculiarities stay in the site's own repo.

### Traefik alternative (parked — stage 3 or later)

The current architecture keeps DSM Web Station as the :443
front-door. That's the right call today because:
- DSM needs Web Station for its own services and legacy sites
- Reclaiming :80/:443 from DSM risks breaking File Station
  web access, DSM's admin UI bindings, and non-docker hosted
  content
- Gradual migration requires coexistence, not replacement

But if the NAS ever becomes dedicated to docker-hosted sites,
Traefik becomes attractive: a single container on :80/:443
that auto-discovers routes from docker labels and handles
ACME (both DNS-01 for wildcards and HTTP-01 for individual
client domains) with zero UI work per new domain.

Rough shape when/if we get there:
- Kill Web Station's claim on :80/:443 (move DSM admin UI to
  a non-standard port, deal with File Station web separately)
- Traefik container binds :80/:443, reads cert config from
  Ansible-provisioned secrets
- Each site's `compose.production.yml` adds
  `labels: [traefik.http.routers.<name>.rule=Host(...)]`
- New client domain = PR to the site's compose labels; no
  NAS UI touch

Do NOT attempt this while existing client services run on DSM
Web Station. The migration cost is significant and the
benefit only materialises past ~5-10 hosted sites.

### Current pending tasks toward stage 2

Tracked in the todo list:
- Extract `shared/` + `templates/sveltekit-static/` to
  `den-frie-vilje/nas-sites` repo
- Write Ansible roles for NAS + site bootstrap
- Migrate skovbyesexologi from "template source" to "template
  consumer" in a second PR
- Document migration of first existing client service as a
  case study
