# Deployment

> ## ⚠ Largely superseded — pending rewrite
>
> The deploy pipeline has moved from inbound HMAC webhook + self-updating
> `deploy.sh` on the NAS to a pull-only model where the NAS runs an
> operator-installed agent that cosign-verifies images before deploying.
> CI's job ends at `cosign sign` — it no longer calls the NAS.
>
> **Canonical references for the new model live in `nas-sites`:**
>
> - [Operator manual](https://github.com/den-frie-vilje/nas-sites/blob/main/docs/PULL-DEPLOY-MODEL.md)
>   — install the agent, schedule it, day-2 ops, troubleshooting, security model
> - [Migration guide](https://github.com/den-frie-vilje/nas-sites/blob/main/docs/MIGRATION-FROM-WEBHOOK.md)
>   — per-site cutover steps and rollback
> - [Synotools hardening](https://github.com/den-frie-vilje/nas-sites/blob/main/docs/SYNOTOOLS-HARDENING.md)
>   — credential-removal for the acme.sh cert hook
>
> **What in this doc is still current**: site-specific bits — the URL
> pattern (§The URL pattern), the repository layout (§Repository layout),
> the GitHub OAuth app + repo secrets setup (§3), the Caddyfile and
> compose layout, the Sveltia activation flow (§9), Signe's editor
> workflow (§Editor flow). These haven't changed.
>
> **What is now obsolete**: every section that mentions HMAC webhooks,
> `WEBHOOK_SECRET`, `hooks.yaml` editing, the `nas-webhook` container,
> the `synology_dsm` acme.sh hook with admin creds, or the `webhook.env`
> file. Specifically that's most of §5 (NAS — webhook.env / hooks.yaml),
> the rollback workflow in §Rollback, and parts of the troubleshooting
> section.
>
> A full rewrite of this doc is queued as a follow-up after the migration
> proves out on production.

Pull-only pipeline: GitHub Actions builds a container image, pushes it
to GHCR, and Sigstore-signs the resulting digest. A small NAS-side
agent polls every 5 min, cosign-verifies the image, and runs
`docker compose pull && up -d --wait` only on digest change. CI does not
call the NAS; there is no inbound deploy endpoint.

The only inbound port on the NAS is :443 — the same port the public
site already needs.

This document covers the **site-specific bits** of the pattern; the
generic deploy machinery lives in `nas-sites` (links above).

---

## The URL pattern

Every site has three hostnames:

| Role | Shape | Example |
| --- | --- | --- |
| Staging canonical origin | `$DOMAIN_DASHED.stage.denfrievilje.dk` | `skovbyesexologi-com.stage.denfrievilje.dk` |
| Production canonical origin | `$DOMAIN_DASHED.prod.denfrievilje.dk` | `skovbyesexologi-com.prod.denfrievilje.dk` |
| Client-facing (production) | `$DOMAIN` | `skovbyesexologi.com` |

`$DOMAIN` = the site's real, customer-owned domain (what end
users type). `$DOMAIN_DASHED` = `$DOMAIN` with every `.` replaced
by `-`:

```
skovbyesexologi.com     → skovbyesexologi-com
app.client.com          → app-client-com
foo-bar.dk              → foo-bar-dk
```

**Why dashes?** Let's Encrypt wildcard certs match exactly ONE
DNS label — `*.stage.denfrievilje.dk` covers
`foo.stage.denfrievilje.dk` but NOT
`foo.com.stage.denfrievilje.dk` (that's two labels under
`.stage`). Using dots would force a per-site cert (defeating
the wildcard). Dots-to-dashes collapses the raw domain into a
single DNS label, and the existing wildcard cert covers all
sites for free.

**Clients who want a vanity domain** CNAME their apex to
`$DOMAIN_DASHED.prod.denfrievilje.dk`. They can change
providers, add Cloudflare, migrate registrars freely — nothing
on your side moves.

**Scripts + config files need both `$DOMAIN` (the raw domain)
and `$DOMAIN_DASHED` (for URL construction)**. See the
`STAGE_ORIGIN=` field in `staging.env` as the typical shape.

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

   **(a) Get your Cloudflare API credentials.** acme.sh needs
   two values to complete the DNS-01 challenge against
   Cloudflare. Do this BEFORE starting the SSH session below so
   you can paste them into the shell directly.

   - **API token** with `Zone:DNS:Edit` on the specific zone
     `denfrievilje.dk`. Create at:
     <https://dash.cloudflare.com/profile/api-tokens> →
     **Create Token** → pick the **Edit zone DNS** template
     (or use "Create Custom Token" with the same permission).
     - Permissions: `Zone` · `DNS` · `Edit`
     - Zone Resources: Include · Specific zone ·
       `denfrievilje.dk`
     - (Optional but recommended) IP Address Filtering: add
       your NAS's outbound IP so the token only works from the
       NAS.
     - (Optional) TTL: leave blank for long-lived, or set an
       annual expiry if you want a rotation reminder.
     - Click **Continue to summary** → **Create Token** →
       **COPY THE TOKEN NOW** (CF shows it exactly once).
       Save it in your password manager immediately.

   - **Account ID**. CF dashboard → click the zone
     (`denfrievilje.dk`) → scroll the right sidebar to the
     **API** section → the "Account ID" value shown there.
     (Also visible at <https://dash.cloudflare.com> as part
     of the URL once you've clicked into an account.)

   **Principle**: create a separate narrow-scoped token per
   purpose. The CF cache-purge tokens used later by the deploy
   webhook (§5 of per-site setup) should NOT reuse this
   DNS-Edit token — issue new ones with `Zone:Cache Purge`
   permission only, scoped to the purge target zone.

   **(b) Install acme.sh + issue the wildcards.** SSH into the
   NAS as admin:
   ```sh
   # Install acme.sh. DSM doesn't ship cron (it has Task
   # Scheduler instead, see step (c) below), so acme.sh's
   # install check will bail unless we pass `--force`.
   curl https://get.acme.sh | sh -s email=<your-email> -- --force

   # Pin the default CA to Let's Encrypt. Since v3.0.0, acme.sh
   # defaults to ZeroSSL, which requires EAB (External Account
   # Binding) credentials we don't have — leaving fresh orders
   # stuck in `processing` forever. Do this BEFORE --issue.
   ~/.acme.sh/acme.sh --set-default-ca --server letsencrypt

   # Paste the CF values from step (a).
   export CF_Token="<the token you just created>"
   export CF_Account_ID="<CF account ID from the right sidebar>"

   # Issue the wildcards via Cloudflare DNS-01.
   # For other DNS providers: https://github.com/acmesh-official/acme.sh/wiki/dnsapi
   ~/.acme.sh/acme.sh --issue --dns dns_cf \
     -d '*.stage.denfrievilje.dk' -d 'stage.denfrievilje.dk'
   ~/.acme.sh/acme.sh --issue --dns dns_cf \
     -d '*.prod.denfrievilje.dk'  -d 'prod.denfrievilje.dk'

   # One-time deploy hook: import the issued cert into DSM's
   # cert store via DSM's WebAPI. After this runs, the cert
   # appears in DSM → Control Panel → Security → Certificate
   # alongside whatever DSM already issued, and you can bind
   # it to vhosts through the usual DSM UI.
   #
   # ⚠️  CRITICAL: set SYNO_Certificate (unique description per
   #     wildcard) + SYNO_Create=1 on every deploy. Without
   #     these, the hook REPLACES DSM's default-cert slot —
   #     clobbering whatever cert is already there (likely
   #     DSM's own admin UI cert or your prior default). The
   #     two deploys below would also overwrite each other
   #     into the same default slot.
   export SYNO_Username=<DSM admin user>
   export SYNO_Password=<DSM admin password>

   # ONLY if your DSM is on non-default ports or HTTPS, also set
   # these — otherwise skip, defaults are Hostname=localhost,
   # Port=5000, Scheme=http.
   # export SYNO_Hostname=localhost
   # export SYNO_Port=<your DSM port>
   # export SYNO_Scheme=https       # if you moved to HTTPS-only
   # export SYNO_INSECURE=1         # if DSM serves a self-signed cert

   # Give each wildcard its own slot in DSM's cert store.
   # SYNO_Create=1 makes a NEW slot when the description
   # doesn't match an existing cert. Without these, the hook
   # overwrites the "default" slot on every call.
   export SYNO_Create=1

   export SYNO_Certificate='*.stage.denfrievilje.dk'
   ~/.acme.sh/acme.sh --deploy --deploy-hook synology_dsm \
     -d '*.stage.denfrievilje.dk'

   export SYNO_Certificate='*.prod.denfrievilje.dk'
   ~/.acme.sh/acme.sh --deploy --deploy-hook synology_dsm \
     -d '*.prod.denfrievilje.dk'
   ```

   After both succeed, DSM → Control Panel → Security →
   Certificate should show two new entries
   (`*.stage.denfrievilje.dk` and `*.prod.denfrievilje.dk`)
   with distinct descriptions, alongside whatever DSM already
   managed. Each future renewal updates the entry whose
   description matches its cert — no more collisions.

   The deploy hook caches these values as `SAVED_SYNO_*`
   entries in `~/.acme.sh/<domain>_ecc/<domain>.conf` on first
   run. Subsequent runs (including Task Scheduler's renewal
   cron) read from there — env vars are ONLY consulted on the
   first deploy per domain.

   **If the DSM account has 2FA enabled**, the first deploy
   will prompt interactively:
   ```
   Enter device name or leave empty for default (CertRenewal):
   Enter OTP code for user 'admin':
   ```
   Enter a descriptive name (e.g. `acme-renewal`) and the
   current OTP code. On success, acme.sh captures a
   `SYNO_Device_ID` from DSM and saves it to the conf file
   as `SAVED_SYNO_Device_ID=...`. DSM then treats the renewal
   script as a trusted device, so the Task Scheduler cron
   runs non-interactively from then on.

   Verify the device-ID capture worked:
   ```sh
   grep -i SYNO_Device ~/.acme.sh/\*.stage.denfrievilje.dk_ecc/\*.stage.denfrievilje.dk.conf
   ```
   (`-i` because acme.sh's newer versions write `SAVED_SYNO_DEVICE_ID`
   in all-caps; older versions used `SAVED_SYNO_Device_ID`.)
   If `SAVED_SYNO_Device_ID=...` is missing, renewals will
   fail interactively — redo the deploy with
   `SYNO_Device_Name=acme-renewal` exported.

   Also check DSM → Control Panel → User & Group → your
   admin user → 2-Factor Authentication → Trusted Devices:
   trust must NOT be set to expire, or renewals will start
   prompting for OTP again when the trust window elapses.

   If the first run used wrong values (e.g. you forgot to
   export `SYNO_Port` for a non-default DSM port), re-exporting
   won't help — edit the cached values directly:
   ```sh
   # Clear stale SAVED_SYNO_* lines so env vars take over on
   # the next run, then retry the deploy with correct exports.
   # The -i flag on grep + case-insensitive `SAVED_SYNO_` match
   # handles both older mixed-case (SAVED_SYNO_Port) and
   # newer all-caps (SAVED_SYNO_PORT) acme.sh variants.
   sed -Ei '/^SAVED_SYNO_/Id' ~/.acme.sh/\*.stage.denfrievilje.dk_ecc/\*.stage.denfrievilje.dk.conf
   sed -Ei '/^SAVED_SYNO_/Id' ~/.acme.sh/\*.prod.denfrievilje.dk_ecc/\*.prod.denfrievilje.dk.conf
   ```
   (Backslashes escape the literal `*` in the directory names.
   The trailing `I` after `/d` makes the match case-insensitive.)

   acme.sh stores `CF_Token` + `CF_Account_ID` into
   `~/.acme.sh/account.conf` (mode 600, root-only) on first
   use, so subsequent renewals don't need them re-exported.

   **(c) Schedule auto-renewal via DSM Task Scheduler.** DSM
   doesn't have `cron`, so acme.sh can't install its normal
   renewal cron entry — we use DSM's Task Scheduler instead.
   DSM → Control Panel → Task Scheduler → Create →
   **Scheduled Task** → **User-defined script**:

   - **General**:
     - Task name: `acme.sh renewal`
     - **User**: the SAME user that ran
       `curl https://get.acme.sh | sh` above. acme.sh's
       install put its files under that user's `$HOME/.acme.sh/`,
       and the deploy-hook config (including 2FA Device_ID)
       lives there too. Running the renewal as a different
       user would miss all of it.
     - Typical choices:
       - Installed as admin (e.g. `admin`): run as that user.
         Home is usually `/home/<user>` or
         `/var/services/homes/<user>` (DSM symlinks between
         the two).
       - Installed as root: run as `root`, home is `/root`.
     - Enabled ✓
   - **Schedule**: Daily at 03:00 (or weekly — certs have 30
     days of renewal slack, daily just catches DNS or API
     failures sooner)
   - **Task Settings → Run command**. DSM Task Scheduler runs
     user-defined scripts via `/bin/sh -c` without a login
     shell, so `$HOME` is NOT expanded — use literal absolute
     paths. Find the real home first by SSHing in as the
     install user and running `echo "$HOME"`. On DSM 7.x this
     is usually `/var/services/homes/<user>`; the historical
     `/home/<user>` is sometimes a symlink, sometimes absent.

     Concrete example for `admin` on DSM 7.x:
     ```sh
     "/var/services/homes/admin/.acme.sh/acme.sh" --cron --home "/var/services/homes/admin/.acme.sh" > "/var/services/homes/admin/acme-renewal.log" 2>&1
     ```

     **Cleaner alternative** — put the command in a small shell
     script under the user's home, then call the script from
     Task Scheduler. The script runs in an environment where
     `$HOME` IS set, so path references inside survive if the
     user ever moves:
     ```sh
     # SSH in as admin, once:
     cat > ~/acme-renew.sh <<'EOF'
     #!/bin/sh
     exec "$HOME/.acme.sh/acme.sh" --cron --home "$HOME/.acme.sh" \
       > "$HOME/acme-renewal.log" 2>&1
     EOF
     chmod +x ~/acme-renew.sh
     ```
     Then Task Scheduler Run command is just the absolute path
     to the script:
     ```sh
     /var/services/homes/admin/acme-renew.sh
     ```

     Either way, log goes to the user's home (not `/var/log/`
     which non-root users generally can't write to).
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
   sudo docker network create nas-deploy
   ```

   **If you're using DSM ACLs on the docker shared folder**,
   the `chown` is redundant — DSM's ACL layer runs in parallel
   with POSIX perms, and if your ACL grants the right access
   to the `deploy` user (or whoever will operate this),
   ownership doesn't matter for function.

   What to verify instead: ACL inheritance is enabled on the
   parent folder so files the containers create later inherit
   the permissions. Control Panel → Shared Folder → edit the
   docker folder → Permissions → check that deploy/admin
   entries have **"Apply to this folder, sub-folders, and
   files"** ticked. Or via SSH:
   ```sh
   sudo synoacltool -get /volume1/docker
   # look for `inherit` flags on the allow entries
   ```

5. **Bootstrap the webhook container.** Done once per NAS.

   The webhook image is built in CI
   (`.github/workflows/webhook-image.yml`) and pushed to
   `ghcr.io/den-frie-vilje/nas-webhook:latest` —
   the NAS never builds it locally. This sidesteps Synology's
   kernel missing seccomp support, which breaks any `RUN`
   step during an in-place docker build on DSM.

   After the webhook-image workflow's first successful run,
   visit
   <https://github.com/orgs/den-frie-vilje/packages/container/package/nas-webhook>
   → Package settings → **Change visibility** → **Public**,
   so the NAS can pull without authentication.

   On the NAS:
   ```sh
   REPO=/tmp/skovbye-bootstrap
   git clone --depth 1 \
     https://github.com/den-frie-vilje/skovbyesexologi.com.git \
     "$REPO"

   sudo cp "$REPO/deploy/compose.webhook.yml" \
           /volume1/docker/webhook/compose.yml
   sudo cp "$REPO/deploy/webhook/hooks.yaml" \
           /volume1/docker/webhook/webhook/hooks.yaml
   sudo cp -r "$REPO/deploy/webhook/scripts/"* \
              /volume1/docker/webhook/webhook/scripts/
   sudo cp "$REPO/deploy/webhook.env.example" \
           /volume1/docker/webhook/webhook.env
   sudo chmod 600 /volume1/docker/webhook/webhook.env
   rm -rf "$REPO"

   cd /volume1/docker/webhook
   sudo docker compose up -d
   sudo docker logs -f webhook-webhook-1
   ```

   No `--build` — the image comes from GHCR. Future updates:
   `docker compose pull && up -d` on the NAS whenever the
   webhook-image workflow ships a new version.

   The webhook is **bootstrapped once and updated manually** —
   the image pull is still manual, not auto-triggered by a
   per-site deploy pipeline. This avoids the chicken-and-egg
   failure mode where a broken webhook upgrade leaves you
   unable to deploy anything including a webhook fix.

---

## Per-site setup (repeat for every new site)

### 3. GitHub — OAuth app + repo secrets

1. **Register a GitHub OAuth App** at
   <https://github.com/settings/applications/new>:
   - Application name: `<site> CMS`
   - Homepage URL: `https://<DOMAIN>` (e.g. `https://skovbyesexologi.com`)
   - Authorization callback URL:
     `https://<DOMAIN_DASHED>.stage.denfrievilje.dk/auth/callback`

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
   set these up for this site. If you do:

   - **API token** with `Zone:Cache Purge:Purge` on the target
     zone ONLY. Create at
     <https://dash.cloudflare.com/profile/api-tokens> →
     **Create Token** → Create Custom Token.
     - Permissions: `Zone` · `Cache Purge` · `Purge`
     - Zone Resources: Include · Specific zone · `<zone>`
     - Do NOT reuse the DNS-Edit token from §2 of the
       one-time NAS setup — a cache-purge leak should not
       give DNS-write access, and vice versa.
     - Copy the token once; CF won't show it again.
   - **Zone ID** from the zone overview page in the CF
     dashboard (right sidebar → "API" section).

   Feed both into `webhook.env` on the NAS under the
   DOMAIN-prefixed names (§5 below).

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
are picked up live — no container restart needed **for the
hooks file**.

⚠️  **But webhook.env changes require `down` + `up -d`, not
`restart`.** Environment variables are baked into a
container at creation time. `docker compose restart` restarts
the process inside the *same* container (same env); only
recreating the container picks up new `env_file` values:

```sh
cd /volume1/docker/webhook
sudo docker compose down
sudo docker compose up -d

# Verify the values actually landed inside the container:
sudo docker exec nas-webhook-webhook-1 env | grep WEBHOOK_SECRET
# Should show non-empty values. If empty, the env_file edit
# didn't take — check for CRLF / duplicates / quoting.
```

Applies to any compose service whose env you edit later —
webhook, sveltia-auth, anything. `restart` is only the right
move for "process inside is stuck, kick it" scenarios; env
changes always need a recreation.

**Security property**: the domain in each hook entry's args
is a static string, not read from the incoming request. An
attacker with a valid HMAC for one site's hook cannot pivot
to another site's deploy path.

### 6. NAS — Web Station vhosts

**Port allocation.** Each (site, env) publishes its Caddy
container to a unique loopback port. DSM's vhost reverse-
proxies the public hostname to that port. `CADDY_PORT=` in
each env file is the allocation — bump for every new site.

Current live allocation on this NAS (keep this table up to
date as sites come online):

| Site | Staging port | Production port | Notes |
| --- | --- | --- | --- |
| — | ~~8080~~ | ~~8081~~ | Jitsi Meet on this NAS holds 8080 — skip the 80xx range |
| skovbyesexologi.com | 18080 | 18081 | first site, using the "shift up by 10000" convention |
| *(next site)* | 18082 | 18083 | |
| *(site after that)* | 18084 | 18085 | |

Pick the next free pair for each new site, set
`CADDY_PORT=<staging>` in `staging.env` and
`CADDY_PORT=<production>` in `production.env`. Verify
the pair is unoccupied first:

```sh
for port in <staging> <production>; do
  sudo netstat -tln 2>/dev/null | awk -v p=":$port$" '$4 ~ p {print "TAKEN: " $0; f=1} END {if (!f) print "  free: " p}'
done
```

The compose files default to `CADDY_PORT=8080` / `8081`
(`${CADDY_PORT:-8080}`) for the unconfigured case — but on
this NAS those collide, so explicit `CADDY_PORT=` in each
env file is mandatory.

**GUI option note.** Web Station v4 (DSM 7.2+) added a
"Container Manager → container → Enable web portal via Web
Station" checkbox that writes a reverse-proxy vhost
automatically. It's a GUI shortcut for Container-Manager-
GUI-owned stacks; for compose-on-SSH containers (which is
us) the checkbox is unreliable across container recreations.
Under the hood it's `proxy_pass http://127.0.0.1:<hostport>`
— identical to what we configure manually via Login Portal /
Web Service Portal. We use the manual path because it
survives `docker compose up -d` recreation.

DSM → Web Station → Web Service Portal → **Create**:

1. **Staging vhost:**
   - Hostname: `<DOMAIN_DASHED>.stage.denfrievilje.dk`
     (e.g. `skovbyesexologi-com.stage.denfrievilje.dk`)
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
   - `<DOMAIN_DASHED>.prod.denfrievilje.dk` (canonical NAS origin)
   - `<DOMAIN>` (the client-facing apex)
   - `www.<DOMAIN>` (if used)
   - Any legacy domains that should redirect or serve here

   **TLS strategy** depends on whether the client uses a CDN:

   - **Client fronts with CF / other CDN**: CDN terminates TLS
     for the client-facing hostnames. Only add
     `<DOMAIN_DASHED>.prod.denfrievilje.dk` to this vhost and bind it
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

   (The `8081` here — and `8080` in the staging vhost above —
   are the default ports if `CADDY_PORT` is unset in the env
   file. If you've allocated non-default ports via
   `CADDY_PORT=` in `staging.env` / `production.env`, match
   those here.)

3. **Canonicalization + redirect** — each site decides which
   hostname is the "real" one. The repo's
   `deploy/Caddyfile.production` has an `@non_canonical` matcher
   block listing every hostname that should 301-redirect to the
   canonical apex. Edit that block when adding a new hostname:
   ```caddy
   @non_canonical {
       host www.skovbyesexologi.com
       host skovbyesexologi-com.prod.denfrievilje.dk
       # host legacy-brand.dk     ← new entries here
   }
   redir @non_canonical https://skovbyesexologi.com{uri} 301
   ```
   Commit → merge → webhook fires → Caddy hot-reloads with the
   new redirect. Reviewable in PR; no NAS UI work beyond step 2
   above.

4. **Ask the site owner to CNAME their apex** to
   `<DOMAIN_DASHED>.prod.denfrievilje.dk`. For a CF-proxied domain:
   - `<DOMAIN>` CNAME → `<DOMAIN_DASHED>.prod.denfrievilje.dk`, orange cloud on
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

### 8. First deploy (chicken-and-egg bootstrap)

The automated pipeline flow is:
```
push → CI builds image → CI POSTs webhook →
NAS webhook runs deploy.sh → docker compose pulls + up
```

**For the VERY FIRST deploy of a new site**, step 4 can't
succeed yet because Caddy-for-this-site isn't running, so
DSM's vhost has no upstream to reach on `127.0.0.1:<PORT>`
and the webhook POST fails with 502. The image push DOES
succeed though, so we can start everything by hand, once:

```sh
# On the NAS, as admin. DOMAIN = site's canonical domain.
DOMAIN=skovbyesexologi.com
PROJECT="${DOMAIN//./-}-staging"    # skovbyesexologi-com-staging

cd "/volume1/docker/$DOMAIN/staging"

sudo docker compose \
  -p "$PROJECT" \
  -f "/volume1/docker/$DOMAIN/repo/deploy/compose.staging.yml" \
  --env-file ./staging.env \
  up -d --wait
```

After `--wait` returns, verify from your laptop:
```sh
curl -sI https://<DOMAIN_DASHED>.stage.denfrievilje.dk/
# expected: HTTP/2 200
```

Then re-fire the deploy workflow — this time the webhook
succeeds because Caddy is now listening and /hooks/* routes
correctly:
```sh
gh workflow run "Deploy to staging" \
  --ref staging \
  --repo <org>/<repo>
```

All subsequent `git push origin staging` events flow through
the full automated pipeline with no manual step.

Repeat the same one-time bring-up pattern for the production
stack when you're ready for the first production deploy:
```sh
PROJECT="${DOMAIN//./-}-production"
cd "/volume1/docker/$DOMAIN/production"
sudo docker compose \
  -p "$PROJECT" \
  -f "/volume1/docker/$DOMAIN/repo/deploy/compose.production.yml" \
  --env-file ./production.env \
  up -d --wait
```

Watch the webhook logs while deploys fire:
```sh
sudo docker logs -f webhook-webhook-1
```

### 9. Activate the GitHub backend in Sveltia

Once the OAuth flow at `https://<DOMAIN_DASHED>.stage.denfrievilje.dk/auth/*`
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

1. Visit `https://<DOMAIN_DASHED>.stage.denfrievilje.dk/admin`. Sign in
   with GitHub on first visit.
2. Edit content → Save → commits to `staging`.
3. Wait ~2 min; refresh `<DOMAIN_DASHED>.stage.denfrievilje.dk`.
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

**Webhook returns 500 "Error occurred while evaluating hook
rules."** The HMAC secret env var is missing or empty inside
the container. Check:
```sh
sudo docker exec nas-webhook-webhook-1 env | grep WEBHOOK_SECRET
```
If you see `VAR=` with no value, the env_file didn't land.
Most common causes:
- You edited `webhook.env` but used `docker compose restart`
  — that doesn't reload env. Use `down` + `up -d`.
- CRLF line endings from a Windows-style paste: `sed -i 's/\r$//'
  /volume1/docker/webhook/webhook.env`, then down+up.
- Duplicate var definitions (empty line from the template
  overriding a later populated one, or vice versa): `grep -c
  VARNAME` — should be 1.

**`/admin` loops on sign-in.** OAuth callback URL mismatch. GH
OAuth App's callback must be **exactly**
`https://<DOMAIN_DASHED>.stage.denfrievilje.dk/auth/callback` — check
for typos and trailing slash.

**Site stays stale after production deploy.** CF purge failed.
Check webhook logs for `warn: CF purge failed`; verify CF token
scope (Zone → Cache Purge → Purge) and zone ID.

**Caddy on one site serves another site's content.** Symptom:
`docker exec … grep backend /admin/config.yml` on the staging
site container shows current content, but `curl` via Caddy
(or the public URL) shows a DIFFERENT site's content. Root
cause: cross-project Docker DNS. If another compose project
on the NAS has a `site` service and is still attached to the
shared `skovbye-deploy` network (per the pre-`d8e97cd`
single-network layout), the staging Caddy's DNS lookup of
`site:80` can resolve to the OTHER project's site container.

Fix: `docker compose down && up -d` on EVERY site-hosting
stack once after the network-isolation change, not just the
one you're actively changing. Until all sites are on the
per-project `internal` network, the old one still serves its
`site` on the shared network.

**Admin UI shows different content than the site container's
actual file has.** Symptom: `docker exec … grep backend
/admin/config.yml` shows the correct value, but the browser (and
`curl` against the public URL) shows an older one. Almost
always CF caching, even if you think the subdomain isn't
orange-clouded. Check in order:

1. CF Dashboard → DNS for the zone → confirm the relevant
   record (e.g. `*.stage` wildcard) is **DNS only** (grey
   cloud). If orange, either flip to grey for staging, or
   `purge_everything` on the zone once.
2. Force-bypass CF to confirm:
   ```sh
   curl --resolve <hostname>:443:<NAS-public-IP> \
     https://<hostname>/admin/config.yml | head
   ```
   If this returns the right content but a normal curl
   doesn't, CF is definitively caching.
3. Staging deploys with the 4a7bbca no-cache Caddy headers
   should already prevent CF from caching anything — but that
   kicks in only from the next Caddy-restart onward.

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

### Naming cleanup during extraction

Because this infra was bootstrapped inside a single site's
repo, several shared identifiers have accidentally inherited
the site's name:

| Thing | Current (site-scoped) | Client-neutral target |
| --- | --- | --- |
| Webhook image | `ghcr.io/den-frie-vilje/skovbyesexologi-webhook:latest` | `ghcr.io/den-frie-vilje/nas-webhook:latest` |
| Webhook compose project | `skovbyesexologi-webhook` | `nas-webhook` |
| Shared docker network | `skovbye-deploy` | `nas-deploy` |
| HMAC secret prefix convention | `SKOVBYESEXOLOGI_COM_…` | unchanged — site-scoped is correct for secrets |

None of this is urgent — it's all cosmetic/taxonomic. But
when extracting to `nas-sites`, rename in one atomic pass so
new sites onboarded against the repo don't inherit the
historical names. Migration on the NAS side:

1. Build new image at target name via a workflow in `nas-sites`
2. Flip `/volume1/docker/webhook/compose.yml` to the new
   image + new `name:` + new external network reference
3. Create the renamed docker network, join the webhook to it
4. `docker compose down && docker compose up -d`
5. Per-site compose files all switch their `networks:` entry
   to the new name in the same pass (otherwise they lose
   reachability to the webhook)
6. Retire the old image from GHCR when nothing references it

Best done at the same moment as the Ansible-ification, so
all the per-host state gets built from templates with the
new names rather than sed'd in place.

### synotools hardening (parked — stage 2 optional)

DSM ships a family of `syno*` CLI tools that could reduce
moving parts vs the current bootstrap. Research summary below;
none are urgent (everything works without them) but each is
worth picking up during stage-2 Ansible extraction.

#### `synowebapi` — biggest win: remove acme.sh admin creds

DSM has `/usr/syno/bin/synowebapi` — a root-only CLI that
invokes WebAPI methods via the internal dispatcher, **without
HTTP auth**. No username/password/OTP/DeviceID needed. Current
acme.sh hook (`synology_dsm`) stores all four in
`~/.acme.sh/<domain>_ecc/<domain>.conf`; a custom hook using
synowebapi would store none of them.

Sketch of a replacement hook:
```sh
# ~/.acme.sh/deploy/synology_dsm_local.sh
synology_dsm_local_deploy() {
  local _desc="${SYNO_Certificate:-$1}"
  local _id
  _id=$(sudo synowebapi --exec api=SYNO.Core.Certificate method=list \
    | jq -r ".data.certificates[] | select(.desc == \"$_desc\") | .id" \
    | head -1)
  sudo synowebapi --exec api=SYNO.Core.Certificate.CRT method=import version=1 \
    id="$_id" desc="$_desc" \
    key_tmp="$2" cert_tmp="$3" inter_cert_tmp="$5" \
    as_default=false
  sudo synow3tool --gen-all
  sudo synosystemctl restart nginx
}
```

Blockers:
- synowebapi requires root; acme.sh installed under `admin`
  needs either a passwordless-sudo entry for synowebapi or
  re-install acme.sh as root
- synowebapi parameter names are undocumented and shift
  across DSM minor versions (observed 7.1→7.2). Upstream
  acme.sh has an open community request for a
  `synology_dsm_local` hook but nothing merged
- We own the hook; breakages on DSM upgrades are on us

Worth doing when moving to the nas-sites common repo —
eliminates the biggest remaining credential-in-file concern.

#### `synoshare` + `synoacltool` — automate shared-folder setup

Replace the "create the docker shared folder via DSM GUI +
add ACL entries via GUI" with scriptable commands. `synoshare
--add <name> "<desc>" /volume1/<name> "" "" "" 0 0` plus
`synoacltool -add /path "user:deploy:allow:rwxpdDaARWc--:fd--"`
covers it. Ace syntax is fiddly; script once, reuse.

#### `synowebapi` for DSM firewall

No clean `synofirewall` exists. Configure the
"restrict :5000/:5001 to LAN + 127.0.0.1" rule once via GUI,
then export `/usr/syno/etc/firewall.conf` as an opaque blob
in the Ansible role and restore via
`synowebapi api=SYNO.Core.Security.Firewall.Rules method=set`.

#### `synoschedtask` + `synowebapi` for Task Scheduler

The acme.sh renewal Task Scheduler entry can be created
programmatically via `synowebapi api=SYNO.Core.TaskScheduler
method=create` rather than through the GUI. Useful for the
bootstrap-nas Ansible playbook.

#### `synow3tool --gen-all` — regenerate Web Station configs

Call this after any cert change so Web Station picks up the
new binding without a full nginx restart. Used internally by
DSM's Certificate UI; available to scripts.

#### Tools that don't help

- **`synocertadm`** — doesn't exist as a standalone. Cert ops
  go through synowebapi.
- **`synocrontab`** — doesn't exist. DSM wipes `/etc/crontab`
  edits on reboot/upgrade. Task Scheduler is the only stable
  path.
- **`synoservice`** — renamed `synosystemctl` in DSM 7.x.

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
