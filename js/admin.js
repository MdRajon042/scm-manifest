// ---------------------------------------------------------
// Publishes entries straight to GitHub via the Contents API.
// Rich text authored with Quill; content is stored as HTML.
// Credentials are stored only in this browser's localStorage —
// never sent anywhere except api.github.com.
// ---------------------------------------------------------

const LS_KEY = 'scmManifestGhCreds';

const ownerEl = document.getElementById('ghOwner');
const repoEl = document.getElementById('ghRepo');
const tokenEl = document.getElementById('ghToken');
const setupBox = document.getElementById('setupBox');
const setupText = document.getElementById('setupText');
const forgetLink = document.getElementById('forgetLink');
const form = document.getElementById('postForm');
const publishBtn = document.getElementById('publishBtn');
const statusMsg = document.getElementById('statusMsg');
const editBanner = document.getElementById('editBanner');
const editBannerText = document.getElementById('editBannerText');
const cancelEditLink = document.getElementById('cancelEditLink');
const formTitle = document.getElementById('formTitle');
const manageList = document.getElementById('manageList');
const imageList = document.getElementById('imageList');

let editingId = null;

// ---------- Quill rich text editor ----------

const quill = new Quill('#contentEditor', {
  theme: 'snow',
  placeholder: 'Write freely here — headings, bold, colors, images...',
  modules: {
    toolbar: {
      container: [
        [{ header: [2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ color: [] }, { background: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote', 'code-block', 'link', 'image'],
        ['clean']
      ],
      handlers: { image: handleQuillImage }
    }
  }
});

function handleQuillImage(){
  const creds = currentCreds();
  if(!creds){
    alert('Fill in GitHub username, repo, and token above first.');
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files[0];
    if(!file) return;
    try{
      const { url } = await uploadImageToRepo(file, creds);
      const range = quill.getSelection(true) || { index: quill.getLength() };
      quill.insertEmbed(range.index, 'image', url, 'user');
      quill.setSelection(range.index + 1);
    }catch(err){
      alert(err.message);
    }
  };
  input.click();
}

async function uploadImageToRepo(file, creds){
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read the image file.'));
    reader.readAsDataURL(file);
  });

  const safeName = file.name.trim().toLowerCase().replace(/[^a-z0-9.\-]+/g, '-');
  const path = `assets/images/${Date.now()}-${safeName}`;
  const apiUrl = `https://api.github.com/repos/${creds.owner}/${creds.repo}/contents/${path}`;

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${creds.token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message: `add image: ${safeName}`, content: base64, branch: 'main' })
  });

  if(!putRes.ok){
    const body = await putRes.text();
    throw new Error(`Image upload failed (${putRes.status}). ${body.slice(0,150)}`);
  }
  const data = await putRes.json();
  return { url: data.content.download_url, path };
}

// ---------- credentials ----------

function loadCreds(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch{ return null; }
}

function saveCreds(creds){
  localStorage.setItem(LS_KEY, JSON.stringify(creds));
}

function clearCreds(){
  localStorage.removeItem(LS_KEY);
  ownerEl.value = ''; repoEl.value = ''; tokenEl.value = '';
  setupBox.classList.remove('saved');
  setupText.textContent = 'One-time setup: paste your GitHub details below. Saved only in this browser.';
}

(function initCreds(){
  const creds = loadCreds();
  if(creds){
    ownerEl.value = creds.owner || '';
    repoEl.value = creds.repo || '';
    tokenEl.value = creds.token || '';
    setupBox.classList.add('saved');
    setupText.textContent = `Connected to ${creds.owner}/${creds.repo}. Details saved in this browser.`;
  }
})();

forgetLink.addEventListener('click', clearCreds);

function currentCreds(){
  const owner = ownerEl.value.trim();
  const repo = repoEl.value.trim();
  const token = tokenEl.value.trim();
  if(!owner || !repo || !token) return null;
  return { owner, repo, token };
}

function showStatus(msg, type){
  statusMsg.textContent = msg;
  statusMsg.className = `status-msg show ${type}`;
}

// ---------- base64 helpers (unicode-safe) ----------

function b64EncodeUnicode(str){
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode('0x' + p1)
  ));
}
function b64DecodeUnicode(str){
  return decodeURIComponent(atob(str).split('').map(c =>
    '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
  ).join(''));
}

function nextId(posts){
  const year = new Date().getFullYear();
  const nums = posts.map(p => {
    const m = /^SCM-(\d{4})-(\d{4})$/.exec(p.id);
    return m && Number(m[1]) === year ? Number(m[2]) : 0;
  });
  const max = nums.length ? Math.max(...nums, 0) : 0;
  return `SCM-${year}-${String(max + 1).padStart(4, '0')}`;
}

function todayISO(){
  return new Date().toISOString().slice(0, 10);
}

// ---------- posts.json read helper ----------

async function fetchPostsFile(creds){
  const apiUrl = `https://api.github.com/repos/${creds.owner}/${creds.repo}/contents/data/posts.json`;
  const headers = {
    'Authorization': `Bearer ${creds.token}`,
    'Accept': 'application/vnd.github+json'
  };
  const res = await fetch(apiUrl, { headers });
  if(!res.ok){
    const body = await res.text();
    throw new Error(`Couldn't read posts.json (${res.status}). Check username/repo/token. ${body.slice(0,150)}`);
  }
  const fileData = await res.json();
  const posts = JSON.parse(b64DecodeUnicode(fileData.content));
  return { posts, sha: fileData.sha, apiUrl, headers };
}

// ---------- edit mode ----------

function looksLikeHtml(str){
  return /^\s*</.test(str || '');
}

function enterEditMode(post){
  editingId = post.id;
  document.getElementById('title').value = post.title;
  document.getElementById('category').value = post.category;
  document.getElementById('status').value = post.status;
  document.getElementById('tags').value = post.tags.join(', ');
  document.getElementById('summary').value = post.summary;

  quill.setText('');
  if(looksLikeHtml(post.content)){
    quill.clipboard.dangerouslyPasteHTML(post.content);
  }else if(window.marked){
    // legacy markdown entry — convert once so it displays correctly
    quill.clipboard.dangerouslyPasteHTML(marked.parse(post.content));
  }else{
    quill.setText(post.content);
  }

  formTitle.textContent = 'Edit entry';
  publishBtn.textContent = 'Update entry';
  editBanner.classList.add('show');
  editBannerText.textContent = `Editing ${post.id} — "${post.title}"`;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exitEditMode(){
  editingId = null;
  form.reset();
  quill.setText('');
  formTitle.textContent = "Log today's learning";
  publishBtn.textContent = 'Publish entry';
  editBanner.classList.remove('show');
}

async function startEdit(id){
  const creds = currentCreds();
  if(!creds) return;
  try{
    const { posts } = await fetchPostsFile(creds);
    const post = posts.find(p => p.id === id);
    if(!post){ alert('Entry not found — try refreshing the list.'); return; }
    enterEditMode(post);
  }catch(err){
    alert(err.message);
  }
}

cancelEditLink.addEventListener('click', exitEditMode);

// ---------- manage entries (list + delete) ----------

async function loadManageList(){
  const creds = currentCreds();
  if(!creds){
    manageList.innerHTML = '<div class="empty-state">Fill in GitHub username, repo, and token above first.</div>';
    return;
  }
  manageList.innerHTML = '<div class="empty-state">Loading entries...</div>';
  try{
    const { posts } = await fetchPostsFile(creds);
    if(!posts.length){
      manageList.innerHTML = '<div class="empty-state">No entries yet.</div>';
      return;
    }
    posts.sort((a,b) => new Date(b.date) - new Date(a.date));
    manageList.innerHTML = posts.map(p => `
      <div class="manage-row">
        <div class="manage-row__info">
          <p class="manage-row__title">${p.title.replace(/</g,'&lt;')}</p>
          <span class="manage-row__meta">${p.id} · ${p.category} · ${p.date}</span>
        </div>
        <div class="manage-row__actions">
          <button class="edit-btn" data-id="${p.id}">Edit</button>
          <button class="delete-btn" data-id="${p.id}">Delete</button>
        </div>
      </div>
    `).join('');

    manageList.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => startEdit(btn.dataset.id));
    });
    manageList.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteEntry(btn.dataset.id, btn));
    });
  }catch(err){
    manageList.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

async function deleteEntry(id, btn){
  const creds = currentCreds();
  if(!creds) return;
  if(!confirm(`Delete entry ${id}? This can't be undone.`)) return;

  btn.disabled = true;
  btn.textContent = 'Deleting...';

  try{
    const { posts, sha, apiUrl, headers } = await fetchPostsFile(creds);
    const updated = posts.filter(p => p.id !== id);
    const newContentB64 = b64EncodeUnicode(JSON.stringify(updated, null, 2));

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `delete: ${id}`, content: newContentB64, sha, branch: 'main' })
    });
    if(!putRes.ok){
      const body = await putRes.text();
      throw new Error(`Delete failed (${putRes.status}). ${body.slice(0,150)}`);
    }
    loadManageList();
  }catch(err){
    alert(err.message);
    btn.disabled = false;
    btn.textContent = 'Delete';
  }
}

// ---------- manage images (list + delete) ----------

async function loadImageList(){
  const creds = currentCreds();
  if(!creds){
    imageList.innerHTML = '<div class="empty-state">Fill in GitHub username, repo, and token above first.</div>';
    return;
  }
  imageList.innerHTML = '<div class="empty-state">Loading images...</div>';
  const apiUrl = `https://api.github.com/repos/${creds.owner}/${creds.repo}/contents/assets/images`;
  const headers = {
    'Authorization': `Bearer ${creds.token}`,
    'Accept': 'application/vnd.github+json'
  };
  try{
    const res = await fetch(apiUrl, { headers });
    if(res.status === 404){
      imageList.innerHTML = '<div class="empty-state">No images uploaded yet.</div>';
      return;
    }
    if(!res.ok){
      const body = await res.text();
      throw new Error(`Couldn't list images (${res.status}). ${body.slice(0,150)}`);
    }
    const files = await res.json();
    if(!files.length){
      imageList.innerHTML = '<div class="empty-state">No images uploaded yet.</div>';
      return;
    }
    imageList.innerHTML = files.map(f => `
      <div class="image-card">
        <img src="${f.download_url}" alt="${f.name}" loading="lazy">
        <div class="image-card__foot">
          <span class="image-card__name" title="${f.name}">${f.name}</span>
          <button class="delete-btn" data-path="${f.path}" data-sha="${f.sha}">Del</button>
        </div>
      </div>
    `).join('');

    imageList.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteImage(btn.dataset.path, btn.dataset.sha, btn));
    });
  }catch(err){
    imageList.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

async function deleteImage(path, sha, btn){
  const creds = currentCreds();
  if(!creds) return;
  if(!confirm(`Delete this image permanently?\n${path}\n\nNote: if it's still used in a published entry, that entry will show a broken image.`)) return;

  btn.disabled = true;
  const apiUrl = `https://api.github.com/repos/${creds.owner}/${creds.repo}/contents/${path}`;
  try{
    const res = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${creds.token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: `delete image: ${path}`, sha, branch: 'main' })
    });
    if(!res.ok){
      const body = await res.text();
      throw new Error(`Delete failed (${res.status}). ${body.slice(0,150)}`);
    }
    loadImageList();
  }catch(err){
    alert(err.message);
    btn.disabled = false;
  }
}

// ---------- refresh lists once credentials are present ----------

[ownerEl, repoEl, tokenEl].forEach(el => {
  el.addEventListener('blur', () => {
    if(currentCreds()){ loadManageList(); loadImageList(); }
  });
});
if(currentCreds()){ loadManageList(); loadImageList(); }

// ---------- publish / update form ----------

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const owner = ownerEl.value.trim();
  const repo = repoEl.value.trim();
  const token = tokenEl.value.trim();

  if(!owner || !repo || !token){
    showStatus('Fill in GitHub username, repo, and token first.', 'err');
    return;
  }

  saveCreds({ owner, repo, token });
  setupBox.classList.add('saved');
  setupText.textContent = `Connected to ${owner}/${repo}. Details saved in this browser.`;

  const title = document.getElementById('title').value.trim();
  const category = document.getElementById('category').value.trim();
  const status = document.getElementById('status').value;
  const tags = document.getElementById('tags').value.split(',').map(t => t.trim()).filter(Boolean);
  const summary = document.getElementById('summary').value.trim();
  const content = quill.root.innerHTML;

  if(quill.getText().trim().length === 0){
    showStatus('Write something in the Notes editor first.', 'err');
    return;
  }

  publishBtn.disabled = true;
  publishBtn.textContent = editingId ? 'Updating...' : 'Publishing...';
  statusMsg.className = 'status-msg';

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/data/posts.json`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json'
  };

  try{
    const getRes = await fetch(apiUrl, { headers });
    if(!getRes.ok){
      const body = await getRes.text();
      throw new Error(`Couldn't read posts.json (${getRes.status}). Check username/repo/token. ${body.slice(0,150)}`);
    }
    const fileData = await getRes.json();
    const currentPosts = JSON.parse(b64DecodeUnicode(fileData.content));

    let updatedPosts, resultId, commitMessage;

    if(editingId){
      const idx = currentPosts.findIndex(p => p.id === editingId);
      if(idx === -1) throw new Error(`Could not find ${editingId} to update — it may have been deleted.`);
      const original = currentPosts[idx];
      const updatedEntry = { ...original, title, category, tags, status, summary, content };
      updatedPosts = [...currentPosts];
      updatedPosts[idx] = updatedEntry;
      resultId = updatedEntry.id;
      commitMessage = `update: ${title}`;
    }else{
      const newEntry = {
        id: nextId(currentPosts),
        title, category, tags, status,
        date: todayISO(),
        summary,
        content
      };
      updatedPosts = [newEntry, ...currentPosts];
      resultId = newEntry.id;
      commitMessage = `add: ${title}`;
    }

    const newContentB64 = b64EncodeUnicode(JSON.stringify(updatedPosts, null, 2));

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: commitMessage, content: newContentB64, sha: fileData.sha, branch: 'main' })
    });

    if(!putRes.ok){
      const body = await putRes.text();
      throw new Error(`${editingId ? 'Update' : 'Publish'} failed (${putRes.status}). ${body.slice(0,150)}`);
    }

    const wasEditing = !!editingId;
    showStatus(`${wasEditing ? 'Updated' : 'Published as'} ${resultId}. Live on your site in ~1 minute.`, 'ok');
    exitEditMode();
    loadManageList();

  }catch(err){
    showStatus(err.message, 'err');
  }finally{
    publishBtn.disabled = false;
    publishBtn.textContent = editingId ? 'Update entry' : 'Publish entry';
  }
});
