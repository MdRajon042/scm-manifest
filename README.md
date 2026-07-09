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

Open `admin.html` on your deployed site (e.g.
`https://your-site.vercel.app/admin.html`). It's a full rich-text editor —
like a lightweight Google Docs:

- **Formatting toolbar** — headings, bold/italic/underline/strike, text
  color and highlight color, ordered/bullet lists, blockquote, code block,
  links
- **Insert images anywhere** — click the 🖼 icon in the toolbar, pick a
  photo, it uploads straight to the repo (`assets/images/`) and drops into
  the doc at your cursor
- **Edit any past entry** — "Manage entries" below the form lists
  everything; hit **Edit**, the doc loads back into the editor exactly as
  written, change what you want, hit **Update entry**
- **Delete entries** — same list, **Delete** button, asks for confirmation
- **Delete images** — separate "Manage images" section shows every
  uploaded image with a thumbnail and a delete button, for cleaning up
  ones you no longer use

Fill in title, category, tags, status, summary, write in the editor, hit
**Publish entry** — it commits straight to GitHub, no git commands, no
Markdown syntax to remember.

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

After setup, daily use is: open `admin.html` → write → Publish. Site
updates automatically in about a minute (Vercel redeploys on every GitHub
commit).

⚠️ Keep the token private — anyone with it can write to that one repo.
If it ever leaks, revoke it from the same GitHub token settings page.

**If you get a 401 "Bad credentials" error:** the token is wrong,
expired, or has the wrong permissions. Click "forget saved credentials"
on the admin page, generate a fresh token following the steps above, and
re-enter everything.

## How content is stored

Entries write rich formatted text as HTML directly into
`data/posts.json` (the editor produces it automatically — you never touch
HTML yourself). Older entries created before this editor existed were
written in Markdown; the site detects the format automatically and
renders both correctly, so nothing breaks.

## Manual way (editing JSON directly, optional)

If you ever prefer to edit content directly: open `data/posts.json`, copy
this block, fill it in, add it to the array, commit, push. `content` can
be plain HTML (`<p>...</p>`) or Markdown — both render correctly:

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
