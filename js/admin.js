// ---------------------------------------------------------
// Publishes a new entry straight to GitHub via the Contents API.
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

function showStatus(msg, type){
  statusMsg.textContent = msg;
  statusMsg.className = `status-msg show ${type}`;
}

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
  const nums = posts
    .map(p => {
      const m = /^SCM-(\d{4})-(\d{4})$/.exec(p.id);
      return m && Number(m[1]) === year ? Number(m[2]) : 0;
    });
  const max = nums.length ? Math.max(...nums, 0) : 0;
  return `SCM-${year}-${String(max + 1).padStart(4, '0')}`;
}

function todayISO(){
  return new Date().toISOString().slice(0, 10);
}

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
  const content = document.getElementById('content').value;

  publishBtn.disabled = true;
  publishBtn.textContent = 'Publishing...';
  statusMsg.className = 'status-msg';

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/data/posts.json`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json'
  };

  try{
    // 1. fetch current file (need sha + existing content)
    const getRes = await fetch(apiUrl, { headers });
    if(!getRes.ok){
      const body = await getRes.text();
      throw new Error(`Couldn't read posts.json (${getRes.status}). Check username/repo/token. ${body.slice(0,150)}`);
    }
    const fileData = await getRes.json();
    const currentPosts = JSON.parse(b64DecodeUnicode(fileData.content));

    // 2. build new entry
    const newEntry = {
      id: nextId(currentPosts),
      title, category, tags, status,
      date: todayISO(),
      summary,
      content
    };
    const updatedPosts = [newEntry, ...currentPosts];
    const newContentB64 = b64EncodeUnicode(JSON.stringify(updatedPosts, null, 2));

    // 3. commit updated file
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `add: ${title}`,
        content: newContentB64,
        sha: fileData.sha,
        branch: 'main'
      })
    });

    if(!putRes.ok){
      const body = await putRes.text();
      throw new Error(`Publish failed (${putRes.status}). ${body.slice(0,150)}`);
    }

    showStatus(`Published as ${newEntry.id}. Live on your site in ~1 minute.`, 'ok');
    form.reset();
    document.getElementById('status').value = 'in-transit';

  }catch(err){
    showStatus(err.message, 'err');
  }finally{
    publishBtn.disabled = false;
    publishBtn.textContent = 'Publish entry';
  }
});
