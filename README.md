# SCM Manifest — Learning Log

Pure HTML/CSS/JS static site. No database, no build step. Content lives in
`data/posts.json`, git is your CMS.

## Local preview

Just open `index.html`? Won't fully work — browsers block `fetch()` on local
files without a server. Run a tiny local server instead:

```bash
# Python (already on most systems)
python3 -m http.server 8000
# then open http://localhost:8000
```

or with Node:

```bash
npx serve .
```

## Deploy — GitHub + Vercel (5 minutes, free)

1. Create a new GitHub repo (e.g. `scm-manifest`), push this folder:
   ```bash
   git init
   git add .
   git commit -m "init: scm manifest site"
   git branch -M main
   git remote add origin https://github.com/<your-username>/scm-manifest.git
   git push -u origin main
   ```
2. Go to https://vercel.com → **Add New Project** → Import the GitHub repo.
3. Framework preset: choose **Other** (it's static — no build command needed).
4. Click **Deploy**. Done — you get a live `*.vercel.app` URL.
5. Every future `git push` to `main` auto-redeploys. That's your whole
   publishing workflow.

(GitHub Pages works exactly as well if you'd rather stay in one platform —
Settings → Pages → deploy from `main` branch.)

## Easiest way to add a new entry — the Publish page

Instead of touching JSON, open `admin.html` on your deployed site
(e.g. `https://your-site.vercel.app/admin.html`) and fill in a form:
title, category, tags, status, summary, and notes. Click **Publish entry**
— it commits directly to GitHub for you, no git commands, no JSON syntax.

**One-time setup (do this once):**

1. Go to GitHub → click your profile photo → **Settings** → scroll to
   **Developer settings** (bottom of left sidebar) → **Personal access
   tokens** → **Fine-grained tokens** → **Generate new token**.
2. Give it a name like `scm-manifest-publish`, set an expiration (e.g. 1
   year), under **Repository access** choose **Only select repositories**
   → pick `scm-manifest`.
3. Under **Permissions** → **Repository permissions** → set **Contents**
   to **Read and write**. Leave everything else as-is.
4. Generate, copy the token (starts with `github_pat_...`) — you won't see
   it again.
5. On the `admin.html` page, paste your GitHub username, repo name, and
   this token. It saves in that browser only (localStorage) so you only
   do this once per device.

After setup, daily use is just: open `admin.html` → fill the form → Publish.
Site updates automatically in about a minute (Vercel redeploys on every
GitHub commit).

⚠️ Keep the token private — anyone with it can write to that one repo.
If it ever leaks, revoke it from the same GitHub token settings page.

## Manual way (editing JSON directly)

If you ever prefer to edit content directly: open `data/posts.json`, copy
this block, fill it in, add it to the array, commit, push:

```json
{
  "id": "SCM-2026-0009",
  "title": "Your topic title",
  "category": "Procurement",
  "tags": ["tag-one", "tag-two"],
  "status": "cleared",
  "date": "2026-07-09",
  "summary": "One or two sentence summary — shows in the list view.",
  "content": "## Heading\n\nWrite in **Markdown** here. Use \\n for line breaks inside the JSON string.\n\n- bullet one\n- bullet two"
}
```

Notes:
- `id` — keep the `SCM-YYYY-000N` pattern, just increment N.
- `status` — use `"cleared"` (done/understood) or `"in-transit"` (still
  learning / in progress). These map to the two status colors on the site.
- `category` — reuse an existing one (Logistics, Procurement, Trade Finance,
  Operations, Risk & Resilience, Finance) or start a new one — it
  auto-appears as a filter chip.
- `content` is Markdown, rendered client-side via marked.js — headings,
  bold, tables, lists, code all work.

No rebuild needed — the JSON is fetched fresh on every page load.

## Structure

```
index.html          shell + fonts
css/style.css        design system (maritime manifest theme)
js/app.js             fetch + hash router + search/filter + markdown render
data/posts.json      <- all your content lives here
```

## Optional next steps

- Custom domain on Vercel (Settings → Domains) if you want your own URL.
- Add an "export CV-ready summary" view later that just filters `status:
  cleared` entries — trivial since it's already structured JSON.
- If it ever outgrows a single JSON file, migrate `content` fields to
  individual `.md` files and fetch those instead — no other architecture
  change needed.
