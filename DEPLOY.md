# Deployment

Skovbye Sexologi ships from GitHub to a Synology NAS over a
Tailscale mesh. Two environments, one pipeline:

| Environment | Branch | Domain | NAS path |
| --- | --- | --- | --- |
| staging | `staging` | `signe.denfrievilje.dk` | `/volume1/web/signe.denfrievilje.dk/` |
| production | `main` | `skovbyesexologi.com` | `/volume1/web/skovbyesexologi.com/` |

Every save in Sveltia CMS commits to `staging` and auto-deploys.
Signe reviews at the staging URL, then clicks **Publish to
production** at `signe.denfrievilje.dk/publish` — which merges
`staging → main` via the GitHub API and fires the production
deploy. No GitHub UI, no command line.

---

## Architecture

```
┌─────────┐  Save ┌──────────┐  push:staging ┌──────────────┐  rsync+symlink ┌────────────────────────┐
│ Sveltia │ ────▶ │  GitHub  │ ─────────────▶│ GH Actions   │ ─────────────▶ │ NAS signe.denfrievilje │
│ /admin  │       │ staging  │               │ deploy-      │   via          │ .dk vhost              │
└─────────┘       │  branch  │               │ staging.yml  │   Tailscale    │                        │
                  └──────────┘               └──────────────┘                └────────────────────────┘
                        │
                        │ Signe clicks "Publish" on /publish
                        │ GitHub API merges staging → main
                        ▼
                  ┌──────────┐  push:main    ┌──────────────┐                ┌────────────────────────┐
                  │  GitHub  │ ─────────────▶│ GH Actions   │ ─────────────▶ │ NAS skovbyesexologi.com│
                  │  main    │               │ deploy-      │                │ vhost                  │
                  │  branch  │               │ production   │                │                        │
                  └──────────┘               └──────────────┘                └────────────────────────┘
```

No inbound ports on the NAS. GH Actions joins the tailnet as an
ephemeral node per run, SSHes in, drops files, leaves. If the
Tailscale OAuth credentials leak, the blast radius is one
tag-scoped ACL entry away from no access at all.

---

## One-time setup

Five things, in this order. First one is the time-consuming one;
rest are ~5 min each.

### 1. Tailscale — OAuth client + ACL

On [login.tailscale.com](https://login.tailscale.com):

1. **Install Tailscale on the NAS.** DSM → Package Center →
   search "Tailscale" → Install. Sign into your `denfrievilje.ts.net`
   tailnet. Verify the machine shows up on the admin console.

2. **Tag the NAS as a deploy target.** Admin console → Machines
   → select the NAS → **Edit ACL tags** → add `tag:deploy-target`.
   If the tag doesn't exist yet, ACL config will accept it once
   step 4 is done.

3. **Rename the NAS (optional, recommended)** so MagicDNS gives
   it a stable hostname. Admin → Machines → NAS → Edit →
   `server` → Save. MagicDNS will resolve it as
   `server.denfrievilje.ts.net` from any tailnet peer.

4. **Edit the ACL policy** (admin console → Access Controls →
   Edit file). Add the `tag:ci` and `tag:deploy-target` tags,
   and an ACL rule that lets CI SSH the NAS:

   ```hujson
   {
     "tagOwners": {
       "tag:ci":             ["autogroup:admin"],
       "tag:deploy-target":  ["autogroup:admin"]
     },

     "acls": [
       // Your existing user-to-device rules first …

       // Let CI reach the NAS on SSH only.
       {
         "action": "accept",
         "src":    ["tag:ci"],
         "dst":    ["tag:deploy-target:22"]
       }
     ],

     "ssh": [
       // (existing ssh rules — don't give tag:ci SSH access here;
       //  we use key-based SSH to the NAS user, not Tailscale SSH.)
     ]
   }
   ```

   Save. Tailscale will reject the policy if the tags don't exist
   yet — the admin console guides you through creating them.

5. **Create an OAuth client** for the GH Actions runner. Admin →
   Settings → OAuth clients → **Generate OAuth client...**
   Scope: `devices:write` + `auth_keys:write` (the latter lets
   `tailscale/github-action` mint ephemeral auth keys on demand).
   Tags this client can assign: **tag:ci**. Description: e.g.
   "GH Actions — skovbyesexologi + denfrievilje".
   Copy the **Client ID** and **Client secret** — you'll paste
   them into GitHub as repo secrets in step 5.

### 2. NAS — `deploy` user + SSH

On DSM:

1. **Create the `deploy` user.** DSM → Control Panel → User &
   Group → Create. Username `deploy`. No password needed
   (we'll use key auth). Group: default Users, no admin. Deny
   all except **SSH** and **File Station** (optional).

2. **Permissions on the web docroots.** Give `deploy` read +
   write on both:
   - `/volume1/web/skovbyesexologi.com/`
   - `/volume1/web/signe.denfrievilje.dk/`

   (Create the dirs first if missing. DSM → File Station →
   web → New Folder.)

3. **Enable SSH.** DSM → Control Panel → Terminal & SNMP →
   Enable SSH service. Default port 22 is fine — not publicly
   exposed anyway, only reachable over tailnet.

4. **Generate an SSH key pair on your workstation**:
   ```sh
   ssh-keygen -t ed25519 -C "gh-actions-deploy" -f ~/.ssh/skovbye-deploy
   ```
   (No passphrase — the key lives in a GH Actions secret and
   must be auto-usable.)

5. **Install the public key on the NAS.** Easiest path:
   DSM → Control Panel → User & Group → `deploy` → Edit →
   Advanced → **SSH keys** → paste the contents of
   `~/.ssh/skovbye-deploy.pub`. If your DSM version doesn't
   expose that UI, SSH in as your admin user and append to
   `/var/services/homes/deploy/.ssh/authorized_keys` manually
   (create the `.ssh` dir with `700`, the file with `600`,
   owned by `deploy`).

6. **Verify from your workstation, over tailnet**:
   ```sh
   ssh -i ~/.ssh/skovbye-deploy deploy@server.denfrievilje.ts.net \
     'echo ok && ls /volume1/web/'
   ```
   Should print `ok` and list the web docroots.

### 3. Cloudflare Worker — Sveltia OAuth proxy

This is the auth proxy Sveltia uses to trade a GitHub OAuth
`code` for an access token server-side. It powers both
`/admin` and the `/publish` page's session (via the same
stored token).

1. **Register a GitHub OAuth App** at
   <https://github.com/settings/applications/new>:
   - Application name: `Skovbye Sexologi CMS`
   - Homepage URL: `https://skovbyesexologi.com`
   - Authorization callback URL: `https://<WORKER-SUBDOMAIN>.workers.dev/callback` *(fill in after step 2 below)*

   Copy the generated **Client ID** + **Client Secret**.

2. **Deploy the Sveltia CMS Authenticator Worker.** Use the
   one-click button at
   <https://github.com/sveltia/sveltia-cms-auth> or run
   `wrangler deploy` locally. In the Cloudflare dashboard, set
   these variables on the worker:

   - `GITHUB_CLIENT_ID` — from step 1
   - `GITHUB_CLIENT_SECRET` — from step 1 (mark as Secret)
   - `ALLOWED_DOMAINS` — `skovbyesexologi.com, signe.denfrievilje.dk, localhost`

   Copy the worker URL (looks like
   `https://skovbye-cms-auth.<username>.workers.dev`) — that's
   your `base_url` in `static/admin/config.yml`. Also go back
   to the GitHub OAuth App and replace the placeholder
   callback URL with `<WORKER-URL>/callback`.

3. **Activate the GitHub backend in `static/admin/config.yml`**:
   comment out the `test-repo` block, uncomment the `github`
   block, paste the worker URL into `base_url`. Commit +
   push. First deploy will land this config on both
   environments.

### 4. Web Station — vhosts for both domains

DSM → Web Station → Web Service Portal:

1. **Skovbyesexologi.com vhost:**
   - Hostname: `skovbyesexologi.com` (and optionally
     `www.skovbyesexologi.com` aliased/redirected)
   - Document root: `/volume1/web/skovbyesexologi.com/current`
   - Back-end: nginx (static serving)
   - HTTPS: Let's Encrypt via DSM cert manager
   - **Block the editor URLs on production.** `/admin` and
     `/publish` are editor tooling, not public pages. They ship
     in the build (same code as staging) but should be
     unreachable via the production domain so an accidental
     visit can't confuse Signe or leak the login flow to the
     public. In DSM → Web Station → this vhost → Advanced
     settings → Custom location rules, add:

     ```nginx
     location ^~ /admin { return 404; }
     location ^~ /publish { return 404; }
     ```

     `^~` prefix stops any later regex locations from matching
     these paths. All editing + publishing happens
     exclusively on `signe.denfrievilje.dk`.

2. **Signe.denfrievilje.dk vhost:**
   - Hostname: `signe.denfrievilje.dk`
   - Document root: `/volume1/web/signe.denfrievilje.dk/current`
   - Back-end: nginx
   - HTTPS: Let's Encrypt
   - **Extra response headers** (vhost → Advanced settings →
     Custom headers):

     ```
     X-Robots-Tag: noindex, nofollow
     ```

     Belt-and-braces on top of the build-time `robots.txt`
     that already Disallows everything on staging.

3. **DNS:** point the two hostnames at your NAS's public
   IPv4/IPv6. Wildcard for `*.denfrievilje.dk` probably
   already exists if the domain is hosted elsewhere on the NAS.

### 5. GitHub — environments + secrets

On <https://github.com/den-frie-vilje/skovbyesexologi.com/settings>:

1. **Environments → New environment → `staging`.** Optional:
   no required reviewers. Add these secrets (scoped to the
   environment):
   - `DEPLOY_PATH` = `/volume1/web/signe.denfrievilje.dk`

2. **Environments → New environment → `production`.** Add:
   - `DEPLOY_PATH` = `/volume1/web/skovbyesexologi.com`

3. **Repository secrets** (Settings → Secrets and variables →
   Actions → Repository secrets):
   - `TS_OAUTH_CLIENT_ID` — from step 1.5
   - `TS_OAUTH_SECRET` — from step 1.5
   - `DEPLOY_SSH_KEY` — paste the full contents of
     `~/.ssh/skovbye-deploy` (the PRIVATE key — includes the
     `-----BEGIN OPENSSH PRIVATE KEY-----` header).
   - `DEPLOY_HOST` = `server.denfrievilje.ts.net`
   - `DEPLOY_USER` = `deploy`

4. **Branch protection** (Settings → Branches):
   - `main`: require pull request before merging (yes, even
     though Signe's `/publish` page merges via API — the API
     merge still respects branch protection; requiring a PR
     means her publish goes through a structured merge commit
     instead of raw direct-to-branch push). Allow merging
     from `staging` only. Dismiss stale approvals: off.
     Required status checks: none.
   - `staging`: no protection — Sveltia needs to push freely
     here.

---

## How it runs day-to-day

### Editor's flow (Signe)

1. Visit `https://signe.denfrievilje.dk/admin`. Sign in with
   GitHub on first visit.
2. Edit content. Click Save. Sveltia commits to `staging`.
3. Wait ~2 min. Refresh `signe.denfrievilje.dk` to see changes.
4. Happy? Visit `signe.denfrievilje.dk/publish`. Review the
   list of pending commits. Click **Publish to production**.
5. Wait ~2 min. `skovbyesexologi.com` is live.

### Developer's flow (Ole)

Normal branch workflow on `main` (PRs, code review). Code
changes deploy to production on merge. Content edits coming
from Sveltia go through `staging` → `/publish` → merge to
`main` just like Signe's do.

### Rollback

GitHub UI → Actions → **Rollback** workflow → Run workflow:
- `environment`: staging or production
- `release_id`: paste the release directory timestamp (see
  below for how to list them)

List recent releases:
```sh
ssh deploy@server.denfrievilje.ts.net \
  'ls -1t /volume1/web/skovbyesexologi.com/releases | head -20'
```

---

## Troubleshooting

**The GH Actions run fails at "Connect to tailnet".** Likely the
OAuth client doesn't have `auth_keys:write`, or the ACL doesn't
grant `tag:ci` anywhere. Check both on the Tailscale admin
console.

**rsync fails with permission denied.** The `deploy` user
doesn't have write on the target path. Re-check step 2.2 (DSM
shared-folder permissions — not just POSIX perms, DSM enforces
its own ACL layer).

**Site 404s right after deploy.** The symlink flip didn't
succeed. SSH in, check:
```sh
ls -la /volume1/web/skovbyesexologi.com/
```
You should see `current -> releases/<timestamp>`. If `current`
points to a non-existent dir, run a Rollback workflow against a
known-good release.

**`/admin` works but `/publish` says "Not signed in".** The page
reads `localStorage['sveltia-cms.user']` for the GitHub token
Sveltia stored during `/admin` login. If Sveltia ever changes
its storage key, this page breaks — look in the browser dev
tools → Application → Local Storage for `signe.denfrievilje.dk`
and find the current key name. Update
`src/routes/publish/+page.svelte`.

**Production deploy runs but the site doesn't update.** Check
Web Station's vhost config — docroot must be
`/volume1/web/skovbyesexologi.com/current`, NOT a specific
`releases/<id>`. Web Station follows the symlink on every
request, so the flip is live instantly.

---

## Reusing this setup on another repo

The pattern (Tailscale OAuth + ephemeral runner node + rsync +
atomic symlink swap) generalises. Copy `.github/workflows/`
and this runbook into the other repo, then:

1. Adjust environment names / branch names / paths in
   `deploy-staging.yml` + `deploy-production.yml` as needed.
2. Re-use the same Tailscale OAuth client (tag it
   appropriately in the ACL — e.g. give `tag:ci` access to
   `tag:denfrievilje-docroot` for the secondary deploy target).
3. New GitHub repo: same `DEPLOY_SSH_KEY` (the NAS `deploy`
   user can serve multiple repos) + new `DEPLOY_HOST` +
   new per-environment `DEPLOY_PATH` secrets.
4. If the second repo uses Sveltia CMS too, it can use the
   same Cloudflare Worker — just add its domains to the
   worker's `ALLOWED_DOMAINS` var.

No additional Tailscale nodes, OAuth clients, or SSH keys
needed per repo. The infrastructure scales horizontally at
almost zero marginal cost.
