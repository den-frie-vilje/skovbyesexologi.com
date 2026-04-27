# Deployment

Site-specific deploy notes for skovbyesexologi.com. The CD machinery
itself (image build/sign in CI, agent on the NAS, signature verification
flow) lives in [`den-frie-vilje/nas-sites`](https://github.com/den-frie-vilje/nas-sites)
and is documented there:

- [PULL-DEPLOY-MODEL.md](https://github.com/den-frie-vilje/nas-sites/blob/main/docs/PULL-DEPLOY-MODEL.md)
  — operator manual for the agent: install, schedule, day-2 ops,
  troubleshooting, security model.
- [NAS-BOOTSTRAP.md](https://github.com/den-frie-vilje/nas-sites/blob/main/docs/NAS-BOOTSTRAP.md)
  — fresh-NAS provisioning prerequisites (DNS, certs, networks, vhosts).
- [BRANCH-PROTECTION.md](https://github.com/den-frie-vilje/nas-sites/blob/main/docs/BRANCH-PROTECTION.md)
  — required GitHub repo settings.

This file is the per-site overlay: the URL pattern this site uses, its
GitHub OAuth setup, its DSM Web Station vhost layout, the Sveltia
editor flow, and the local dev loop.

---

## URL pattern

Every site on the shared NAS exposes three hostnames:

| Role | Hostname | TLS | Purpose |
| --- | --- | --- | --- |
| Staging origin | `skovbyesexologi-com.stage.denfrievilje.dk` | `*.stage.denfrievilje.dk` wildcard | Editor preview + Sveltia OAuth callback. `X-Robots-Tag: noindex, nofollow`. |
| Production origin | `skovbyesexologi-com.prod.denfrievilje.dk` | `*.prod.denfrievilje.dk` wildcard | Internal canonical origin. CDN-fronted client-facing apex CNAMEs to this. |
| Public apex | `skovbyesexologi.com` | Issued by Cloudflare on the apex zone | What end users hit. Cloudflare-proxied (orange-cloud). |

`<DOMAIN_DASHED>` = `<DOMAIN>` with dots replaced by dashes. Keeping the
whole origin inside one DNS label means a single wildcard cert covers
every site without per-site cert issuance.

## Architecture

```
  Browser → Cloudflare (apex)
              ↓
          DSM Web Station (TLS terminate, prod or stage hostname)
              ↓
          Caddy (per-(site,env) container, on nas-deploy network)
              ↓
          site (static nginx, GHCR-pulled image)
              ↑
          sveltia-auth (staging only, GitHub OAuth proxy for /admin)
```

CI builds + cosign-signs the image. The NAS agent (every ~5 min) pulls,
verifies the signature, and `docker compose up -d --wait`s if the digest
changed. There is no inbound deploy endpoint.

## Repository layout

```
deploy/
├── Dockerfile             # multi-stage: pkgx-pinned Node + pnpm builder → rootless nginx
├── compose.staging.yml    # caddy + site + sveltia-auth (admin enabled)
├── compose.production.yml # caddy + site (admin baked-out via STRIP_EDITOR build arg)
├── compose.local.yml      # local-dev override (binds to laptop port, drops OAuth)
├── Caddyfile.staging      # /auth proxy + no-cache headers
├── Caddyfile.production   # host canonicalisation + /admin block
├── nginx.conf             # SPA fallback for the SvelteKit static output
├── staging.env.example    # OAuth client + CADDY_PORT shape
└── production.env.example # CADDY_PORT shape (no OAuth)

src/                       # SvelteKit source
static/admin/              # Sveltia CMS bundle (vendored via scripts/copy-sveltia.ts)
.github/workflows/
├── deploy-staging.yml     # thin caller of nas-sites/build-and-sign.yml
├── deploy-production.yml  # gating chain (detect-changes → verify-sigs → approve → build-and-sign)
└── og-drift-check.yml     # OG image consistency check, separate from deploys
```

---

## Bootstrap a fresh NAS for this site

This section is the once-per-NAS work. If the NAS is already serving
other den-frie-vilje sites, only steps 3–6 are per-site; 1 and 2 happen
once for the whole NAS.

### 1. DNS wildcards (once per NAS)

Add A records on the parent zone:

- `*.stage.denfrievilje.dk` → NAS public IP
- `*.prod.denfrievilje.dk`  → NAS public IP

These are wildcards because every future site joins the same two
sub-zones.

### 2. Wildcard certs in DSM cert store (once per NAS)

DSM's built-in Let's Encrypt only issues HTTP-01, which can't sign
wildcards. Issue the two `*.{stage,prod}.denfrievilje.dk` wildcards via
DNS-01 (acme.sh + Cloudflare DNS plugin is the documented path), import
into DSM's cert store, then bind to vhosts in step 6 below.

> **Cert renewal mechanism is currently unverified on the production
> NAS** — the wildcards exist in DSM's cert store but `acme.sh --list`
> on the admin user shows no managed certs. Confirm they're being
> renewed by something before they expire.

### 3. GitHub OAuth App + repo settings (per site)

#### OAuth app

[github.com/settings/applications/new](https://github.com/settings/applications/new):

- Application name: `skovbyesexologi.com CMS`
- Homepage URL: `https://skovbyesexologi.com`
- Authorization callback URL: `https://skovbyesexologi-com.stage.denfrievilje.dk/auth/callback`

Copy the generated **Client ID** and **Client Secret** — you'll paste
them into `staging.env` on the NAS in step 5.

#### Repo branch protection

GitHub → repo → Settings → Branches → main:

- Require PR before merging
- Required signed commits (per
  [nas-sites BRANCH-PROTECTION.md](https://github.com/den-frie-vilje/nas-sites/blob/main/docs/BRANCH-PROTECTION.md))
- Block force pushes, deletions, admin bypass
- Require linear history

`staging` stays unprotected — Sveltia auto-commits there on every editor
save.

#### Environments

GitHub → Settings → Environments:

- `staging` — no reviewer
- `production` — no reviewer (the reviewer rule lives on
  `production-gate`, see deploy-production.yml's gating chain comments)
- `production-gate` — reviewer ☑ (Ole), 2-day timeout

### 4. Per-site setup on the NAS

Run the interactive bootstrap from nas-sites:

```sh
sudo /volume1/docker/nas-sites/repo/tools/bootstrap-site.sh
```

Answer the prompts twice — once for each environment:

| Prompt | Staging | Production |
| --- | --- | --- |
| Domain | `skovbyesexologi.com` | `skovbyesexologi.com` |
| Environment | `staging` | `production` |
| Repo | `den-frie-vilje/skovbyesexologi.com` | `den-frie-vilje/skovbyesexologi.com` |
| Branch | `staging` | `main` |
| Compose | `deploy/compose.staging.yml` | `deploy/compose.production.yml` |

When `$EDITOR` opens `<env>.env`:

- **staging.env**: set `CADDY_PORT` (next free port, see step 6 below),
  `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `STAGE_ORIGIN`.
- **production.env**: set `CADDY_PORT`. Production has no OAuth proxy.

When `$EDITOR` opens `sites.d/<domain>.<env>.env`:

- **staging**: leave CF tokens empty (staging is grey-clouded — no CF
  cache to purge, no token needed; see §"Cloudflare cache decision"
  below).
- **production**: set `CF_API_TOKEN` (Zone:Cache Purge:Purge scope) and
  `CF_ZONE_ID` for the apex zone.

The script offers a smoke-test agent fire at the end. For the very first
deploy of a fresh site, skip it — Caddy has no upstream yet and DSM's
vhost in step 6 isn't created. Build the image once via CI, then re-fire
the agent after step 6.

### 5. DSM Web Station vhosts (per site)

#### Port allocation

Each `(site, env)` publishes Caddy on a unique loopback port. Set
`CADDY_PORT=` in each env file. Live allocation on this NAS:

| Site | Staging | Production | Notes |
| --- | --- | --- | --- |
| — | ~~8080~~ | ~~8081~~ | Jitsi Meet holds 8080 — skip the 80xx range |
| skovbyesexologi.com | 18080 | 18081 | First site, "shift up by 10000" convention |
| *(next site)* | 18082 | 18083 | |

Verify a chosen pair is unoccupied:

```sh
for port in 18080 18081; do
  sudo netstat -tln 2>/dev/null | awk -v p=":$port$" '$4 ~ p {print "TAKEN: " $0; f=1} END {if (!f) print "  free: " p}'
done
```

#### Staging vhost

DSM → Web Station → Web Service Portal → **Create**:

- Hostname: `skovbyesexologi-com.stage.denfrievilje.dk`
- Back-end: nginx
- HTTPS: bind the `*.stage.denfrievilje.dk` wildcard cert (from §2)
- Advanced → Custom location:
  ```nginx
  location / {
    proxy_pass http://127.0.0.1:18080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  ```
- Custom headers:
  ```
  X-Robots-Tag: noindex, nofollow
  ```

#### Production vhost

One DSM vhost serves every public hostname for this site (apex, www,
legacy domains). All requests land in Caddy, which serves canonical or
301-redirects based on Host.

- Hostnames (multi-SAN on the same vhost):
  - `skovbyesexologi-com.prod.denfrievilje.dk` (canonical NAS origin)
  - `skovbyesexologi.com`
  - `www.skovbyesexologi.com`
- Back-end: nginx
- HTTPS: see "TLS strategy" below
- Advanced → Custom location:
  ```nginx
  location / {
    proxy_pass http://127.0.0.1:18081;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  ```

#### TLS strategy

skovbyesexologi.com is **CF-fronted**, so:

- The apex (`skovbyesexologi.com`) and `www` are CF-proxied (orange
  cloud). Cloudflare terminates TLS for them; the cert at the NAS only
  needs to cover `skovbyesexologi-com.prod.denfrievilje.dk`.
- Bind the `*.prod.denfrievilje.dk` wildcard cert to the production
  vhost.
- Ask the site owner to CNAME `skovbyesexologi.com` →
  `skovbyesexologi-com.prod.denfrievilje.dk` (orange cloud on).

#### Caddyfile-side canonicalisation

`deploy/Caddyfile.production` has an `@non_canonical` matcher block
listing every hostname that should 301-redirect to the canonical apex.
Edit when adding a new hostname:

```caddy
@non_canonical {
    host www.skovbyesexologi.com
    host skovbyesexologi-com.prod.denfrievilje.dk
    # host legacy-brand.dk  ← new entries here
}
redir @non_canonical https://skovbyesexologi.com{uri} 301
```

Commit → merge `staging → main` → next agent fire picks up the change.

### 6. Cloudflare cache decision

**Production** (`skovbyesexologi.com`): dedicated CF zone. Set
`CF_API_TOKEN` + `CF_ZONE_ID` in
`/volume1/docker/nas-sites/sites.d/skovbyesexologi.com.production.env`
on the NAS — the agent purges cache after each deploy.

**Staging** (`*.stage.denfrievilje.dk`): shares one zone with every
other staging site on the NAS. CF's free-plan purge is whole-zone-only,
so a per-site purge would nuke siblings. Recommended setup: **grey-cloud
the wildcard** (CF DNS panel → set `*.stage` to "DNS only"). All
staging traffic goes origin-direct, no edge cache, no purge needed.
Leave CF env vars empty in `sites.d/<domain>.staging.env`.

### 7. Activate the GitHub backend in Sveltia

Once the OAuth flow at
`https://skovbyesexologi-com.stage.denfrievilje.dk/auth/*` is reachable
(after the first staging deploy lands), switch
`static/admin/config.yml`:

- Comment out the `backend: name: test-repo` block
- Uncomment the `backend: name: github …` block

Commit, push to `staging`. Sveltia now authenticates against GitHub via
the self-hosted OAuth proxy and writes edits to the `staging` branch.

---

## Day-to-day

### Editor flow (Signe)

1. Visit `https://skovbyesexologi-com.stage.denfrievilje.dk/admin`. Sign
   in with GitHub on first visit.
2. Edit content → Save → commits to `staging`.
3. Wait ~6 min; refresh the staging URL.
4. Happy? Visit `…/publish` on the same domain → click **Publish to
   production** → opens a `staging → main` PR.
5. Approve at the GitHub `production-gate` environment prompt.
6. Wait ~6 min. `skovbyesexologi.com` is live, CF cache purged.

### Developer flow

Normal git: branch off `staging`, PR into `staging`, then promote
`staging → main` when ready. Code/config changes hit the
`detect-changes → verify-signatures → approve → build-and-sign` chain
in `deploy-production.yml`. Content-only changes (paths matching
`src/content/**` + `static/img/**`) bypass the reviewer gate but still
go through CI build + cosign sign.

### Local dev with the deploy stack

```sh
pkgx pnpm build
docker compose \
  -f deploy/compose.staging.yml \
  -f deploy/compose.local.yml \
  up --build
# → http://localhost:8080
```

The override replaces the GHCR-pulled site image with a local build,
drops the OAuth proxy, and binds to a laptop-reachable port.

### Rollback

`git revert` the bad commit on `main` (or restore an earlier `staging`
content commit), open a PR, approve at the production-gate, ship. CI
builds + signs the reverted code; the agent picks it up. For an in-anger
fast rollback (site is down, can't wait for CI), edit
`deploy/compose.production.yml` to pin `image:` to a previous immutable
tag (`production-2026-04-23T14-02-19Z-abc12345`) instead of
`production-latest`, push, agent deploys within ~5 min.

---

## Troubleshooting (site-specific)

For agent-side or general CD-pipeline issues, see
[nas-sites PULL-DEPLOY-MODEL.md §Troubleshooting](https://github.com/den-frie-vilje/nas-sites/blob/main/docs/PULL-DEPLOY-MODEL.md#troubleshooting).

### `/admin` loops on sign-in

OAuth callback URL mismatch. The GitHub OAuth App's callback must be
**exactly**
`https://skovbyesexologi-com.stage.denfrievilje.dk/auth/callback` —
check for typos and trailing slashes.

### Site stays stale after a production deploy

Cloudflare purge failed. On the NAS:

```sh
sudo grep nas-sites-deploy /var/log/messages | grep -i 'CF purge'
```

Verify token scope (Zone → Cache Purge → Purge) and `CF_ZONE_ID` in
`/volume1/docker/nas-sites/sites.d/skovbyesexologi.com.production.env`.
Manual purge from your laptop:

```sh
curl -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

### Caddy on one site serves another site's content

Cross-project Docker DNS leak. Each site's compose creates its own
`internal` network so service names like `site` are scoped per-project.
If a site's compose somehow attached `site` to the shared `nas-deploy`
network instead, the staging Caddy's DNS lookup of `site:80` can resolve
to the wrong project's container.

Fix: every site's compose file's `networks:` block should have
`internal:` (no `external: true`) and the `site` service should be on
`[internal]` only — NOT on `nas-deploy`. Only `caddy` joins
`nas-deploy`, and it does so for cross-project reachability of future
shared services. Verify with:

```sh
sudo docker network inspect nas-deploy --format '{{range .Containers}}{{.Name}}{{println}}{{end}}'
# expected: only the per-site Caddy containers, never any 'site' container
```

### Admin UI shows different content than the site container's actual file has

Almost always Cloudflare caching. Check:

1. CF Dashboard → DNS for the staging zone → confirm `*.stage` is "DNS
   only" (grey cloud). If orange, flip to grey for staging.
2. Force-bypass CF to confirm:
   ```sh
   curl --resolve skovbyesexologi-com.stage.denfrievilje.dk:443:<NAS-public-IP> \
     https://skovbyesexologi-com.stage.denfrievilje.dk/admin/config.yml | head
   ```
   Right content via `--resolve` but stale via normal curl ⇒ CF caching.

### TLS handshake fails on a new client domain

Either the CF-proxy cert isn't provisioned yet (~15 min after orange-cloud), or
the DSM LE cert for the client domain couldn't issue (HTTP-01 needs the A
record to point at the NAS at issuance time). For CF-fronted client domains,
delete any DSM cert for the client apex — CF handles it.

### Container Manager → Projects tab is empty

DSM 7.2.0/7.2.1 bug; CLI-created projects appear only after a DSM
restart. Fixed in 7.2.2+. Containers in the Containers tab still show up
regardless.

---

## Reusing this site as a template

Per-site work for the next den-frie-vilje site collapses to:

1. New GitHub OAuth App with the new site's callback URL (§3 above).
2. Copy `deploy/`, `.github/workflows/`, `static/admin/`, and `src/` as
   a starting point. Change `image-name` in `deploy-staging.yml` /
   `deploy-production.yml` to match the new site's GHCR path.
3. Run `tools/bootstrap-site.sh` on the NAS (§4) for both envs.
4. Add the new site's DSM Web Station vhosts on the next free port pair
   (§5).
5. Switch Sveltia to GitHub backend (§7).

A formal site-template extraction (with `templates/sveltekit-static/`
ready to fork) is on the nas-sites roadmap.
