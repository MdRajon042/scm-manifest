// ---------------------------------------------------------
// SCM Manifest — simple static blog engine
// Data source: data/posts.json  (no database, git IS the CMS)
// Add a new entry -> add one object to posts.json -> commit -> push
// ---------------------------------------------------------

const app = document.getElementById('app');
const entryCountEl = document.getElementById('entryCount');

let POSTS = [];
let activeCategory = 'all';
let searchTerm = '';

// ---------- theme (day / night) ----------

function initTheme(){
  const saved = localStorage.getItem('scm-theme');
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const theme = saved || (prefersLight ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', theme);
  updateToggleIcon(theme);
}

function toggleTheme(){
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('scm-theme', next);
  updateToggleIcon(next);
}

function updateToggleIcon(theme){
  const btn = document.getElementById('themeToggle');
  if(!btn) return;
  btn.innerHTML = theme === 'light'
    ? '<span class="theme-toggle__icon">☀️</span><span class="theme-toggle__label">DAY</span>'
    : '<span class="theme-toggle__icon">🌙</span><span class="theme-toggle__label">NIGHT</span>';
  btn.setAttribute('aria-label', theme === 'light' ? 'Switch to night mode' : 'Switch to day mode');
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  const btn = document.getElementById('themeToggle');
  if(btn) btn.addEventListener('click', toggleTheme);
});

// ---------- stats ----------

function renderStats(posts){
  const strip = document.getElementById('statsStrip');
  if(!strip) return;
  const total = posts.length;
  const cleared = posts.filter(p => p.status === 'cleared').length;
  const inTransit = total - cleared;
  const routes = new Set(posts.map(p => p.category)).size;

  const blocks = strip.querySelectorAll('.stat-num');
  const values = [total, cleared, inTransit, routes];
  blocks.forEach((el, i) => { animateNumber(el, values[i]); });
}

// count-up animation for stat numbers — small "alive" touch
function animateNumber(el, target){
  const duration = 600;
  const start = performance.now();
  function tick(now){
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target);
    if(progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

async function loadPosts(){
  try{
    const res = await fetch('data/posts.json', { cache: 'no-store' });
    if(!res.ok) throw new Error('Failed to load posts.json');
    POSTS = await res.json();
    POSTS.sort((a,b) => new Date(b.date) - new Date(a.date));
    entryCountEl.textContent = `${POSTS.length} ${POSTS.length === 1 ? 'entry' : 'entries'} logged`;
    renderStats(POSTS);
    router();
  }catch(err){
    app.innerHTML = `<div class="empty-state">Could not load the manifest data (data/posts.json). ${escapeHtml(err.message)}</div>`;
  }
}

function getCategories(){
  const set = new Set(POSTS.map(p => p.category));
  return ['all', ...Array.from(set).sort()];
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[s]));
}

function statusClass(status){
  return status === 'cleared' ? 'status-cleared' : 'status-in-transit';
}

// ---------- routing ----------

function router(){
  const hash = window.location.hash || '#/';
  const match = hash.match(/^#\/post\/(.+)$/);
  if(match){
    const post = POSTS.find(p => p.id === decodeURIComponent(match[1]));
    if(post){ renderDetail(post); return; }
  }
  renderList();
}

window.addEventListener('hashchange', router);

// ---------- list view ----------

function renderList(){
  const categories = getCategories();

  const filtered = POSTS.filter(p => {
    const inCategory = activeCategory === 'all' || p.category === activeCategory;
    const haystack = `${p.title} ${p.summary} ${p.tags.join(' ')}`.toLowerCase();
    const inSearch = haystack.includes(searchTerm.toLowerCase());
    return inCategory && inSearch;
  });

  const chips = categories.map(cat => `
    <button class="filter-chip" data-cat="${escapeHtml(cat)}" aria-pressed="${cat === activeCategory}">
      ${cat === 'all' ? 'All routes' : escapeHtml(cat)}
    </button>
  `).join('');

  const rows = filtered.map((p, i) => {
    const isInteractive = p.type === 'interactive';
    const statusHtml = isInteractive
      ? `<span class="live-dot" aria-hidden="true"></span>LIVE MODULE`
      : `${p.status.toUpperCase()}`;
    const statusClasses = isInteractive
      ? 'status-interactive'
      : statusClass(p.status);

    return `
    <div class="manifest-row ${isInteractive ? 'manifest-row--interactive' : ''}" style="animation-delay:${Math.min(i * 35, 400)}ms" tabindex="0" role="button" data-id="${escapeHtml(p.id)}" data-external="${isInteractive ? escapeHtml(p.url || '') : ''}" aria-label="Open entry: ${escapeHtml(p.title)}">
      <div class="m-track">${escapeHtml(p.id)}</div>
      <div class="m-main">
        <p class="m-title">${escapeHtml(p.title)} ${isInteractive ? '<span class="m-flag">⚡ INTERACTIVE</span>' : ''}</p>
        <p class="m-summary">${escapeHtml(p.summary)}</p>
      </div>
      <div class="m-cat">${escapeHtml(p.category)}</div>
      <div class="m-status ${statusClasses}">${statusHtml}</div>
    </div>
  `;
  }).join('');

  app.innerHTML = `
    <div class="controls">
      <input type="text" class="search-input" id="searchInput" placeholder="search the manifest — try 'incoterms' or 'LC'..." value="${escapeHtml(searchTerm)}">
    </div>
    <div class="controls" id="chipRow">${chips}</div>
    <div class="manifest">
      ${rows || '<div class="empty-state">No entries match this filter. Widen the search.</div>'}
    </div>
  `;

  document.getElementById('searchInput').addEventListener('input', e => {
    searchTerm = e.target.value;
    renderList();
    document.getElementById('searchInput').focus();
    document.getElementById('searchInput').setSelectionRange(searchTerm.length, searchTerm.length);
  });

  document.getElementById('chipRow').addEventListener('click', e => {
    const btn = e.target.closest('.filter-chip');
    if(!btn) return;
    activeCategory = btn.dataset.cat;
    renderList();
  });

  app.querySelectorAll('.manifest-row').forEach(row => {
    const go = () => {
      const externalUrl = row.dataset.external;
      if(externalUrl){
        window.open(externalUrl, '_blank', 'noopener');
        return;
      }
      window.location.hash = `#/post/${encodeURIComponent(row.dataset.id)}`;
    };
    row.addEventListener('click', go);
    row.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); go(); } });
  });
}

// ---------- detail view ----------

function looksLikeHtml(str){
  return /^\s*</.test(str || '');
}

function renderDetail(post){
  const tags = post.tags.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('');
  const bodyHtml = looksLikeHtml(post.content)
    ? post.content
    : (window.marked ? marked.parse(post.content) : `<p>${escapeHtml(post.content)}</p>`);

  app.innerHTML = `
    <div class="waybill">
      <div class="waybill__head">
        <a href="#/" class="back-link">&larr; back to manifest</a>
        <div class="waybill__track">${escapeHtml(post.id)} · ${post.status.toUpperCase()}</div>
        <h1 class="waybill__title">${escapeHtml(post.title)}</h1>
        <div class="waybill__meta">
          <span><strong>Route:</strong> ${escapeHtml(post.category)}</span>
          <span><strong>Logged:</strong> ${escapeHtml(post.date)}</span>
        </div>
        <div class="tag-row">${tags}</div>
      </div>
      <div class="waybill__body">${bodyHtml}</div>
    </div>
  `;

  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

loadPosts();
