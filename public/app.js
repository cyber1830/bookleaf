// Vanilla SPA: no build step, served by the same Express process as the API.
const CATS = ['Royalty & Payments','ISBN & Metadata Issues','Printing & Quality','Distribution & Availability','Book Status & Production Updates','General Inquiry'];
const PRIS = ['Critical','High','Medium','Low'];
const STATS = ['Open','In Progress','Resolved','Closed'];

const S = { token: localStorage.getItem('token'), user: JSON.parse(localStorage.getItem('user') || 'null'), onEvent: null, filters: {} };
const $ = (s) => document.querySelector(s);
const main = () => $('#main');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n) => (n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN'));
const when = (d) => new Date(d).toLocaleString();
const badge = (t, cls = '') => `<span class="badge ${cls}">${esc(t)}</span>`;
const opts = (list, sel, blank) => (blank ? `<option value="">${blank}</option>` : '') + list.map((v) => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');

async function api(path, { method = 'GET', body } = {}) {
  const isForm = body instanceof FormData;
  const res = await fetch('/api' + path, {
    method,
    headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && S.token) return logout();
    const e = new Error(data?.error?.message || 'Request failed');
    e.details = data?.error?.details;
    throw e;
  }
  return data;
}
const errText = (e) => esc(e.message) + (e.details ? ': ' + e.details.map((d) => `${d.path} ${d.message}`).join('; ') : '');

function logout() {
  S.token = null; S.user = null; localStorage.clear(); S.es?.close();
  location.hash = '#/login'; render();
}

// ---- real-time (SSE): server pushes "ticket" events; views refetch what they show ----
let debounce;
function connectEvents() {
  S.es?.close();
  if (!S.token) return;
  S.es = new EventSource('/api/events?token=' + encodeURIComponent(S.token));
  S.es.addEventListener('ticket', (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => S.onEvent?.(JSON.parse(e.data)), 150);
  });
}

// ---- routing ----
addEventListener('hashchange', render);
async function render() {
  S.onEvent = null;
  if (!S.token) { nav(); return loginView(); }
  nav();
  const [, route, arg] = location.hash.split('/');
  try {
    if (S.user.role === 'admin') route === 'ticket' ? await adminTicket(Number(arg)) : await adminQueue();
    else route === 'new' ? await newTicket() : route === 'tickets' ? await myTickets() : await myBooks();
  } catch (e) { main().innerHTML = `<p class="err">${errText(e)}</p>`; }
}

function nav() {
  const r = location.hash.split('/')[1] || '';
  const link = (h, t, on) => `<a href="#/${h}" class="${on ? 'on' : ''}">${t}</a>`;
  $('#nav').innerHTML = !S.user ? '<b>BookLeaf Support</b>' : `<b>BookLeaf Support</b>` +
    (S.user.role === 'admin'
      ? link('queue', 'Ticket queue', r !== 'x')
      : link('books', 'My Books', r === 'books' || r === '') + link('new', 'Submit a Query', r === 'new') + link('tickets', 'My Tickets', r === 'tickets')) +
    `<span class="sp"></span><span class="mut" style="color:#fff">${esc(S.user.name)} (${S.user.role})</span><a href="#" id="out">Log out</a>`;
  $('#out')?.addEventListener('click', (e) => { e.preventDefault(); logout(); });
}

// ---- login ----
function loginView() {
  main().innerHTML = `<div class="card" style="max-width:380px;margin:40px auto"><h1>Sign in</h1>
    <form id="f"><label>Email</label><input type="email" name="email" required><label>Password</label><input type="password" name="password" required>
    <div class="row"><button>Sign in</button></div><p id="e" class="err"></p></form>
    <p class="mut">Demo: admin@bookleaf.com / admin123<br>Author: priya.sharma@email.com / author123</p></div>`;
  $('#f').onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = Object.fromEntries(new FormData(ev.target));
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', body: fd });
      Object.assign(S, { token, user });
      localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user));
      connectEvents();
      location.hash = user.role === 'admin' ? '#/queue' : '#/books';
      render();
    } catch (e) { $('#e').innerHTML = errText(e); }
  };
}

// ---- author: books ----
async function myBooks() {
  const { books } = await api('/books');
  if (!books.length) { main().innerHTML = '<div class="card">No books on your account yet.</div>'; return; }
  main().innerHTML = '<h1>My Books</h1>' + books.map((b) => `<div class="card">
    <div class="row" style="justify-content:space-between;margin:0"><h2 style="margin:0">${esc(b.title)}</h2>${badge(b.status)}</div>
    <div class="mut">${esc(b.genre)} · ISBN ${esc(b.isbn)} · ${b.publicationDate ? 'Published ' + esc(b.publicationDate) : 'Not yet published'}</div>
    ${b.inProduction
      ? '<p class="mut">This book is still in production, so there are no sales or royalties to show yet. We email you at every stage.</p>'
      : `<div class="stats"><div>MRP<b>${inr(b.mrp)}</b></div><div>Copies sold<b>${b.copiesSold}</b></div><div>Royalty earned<b>${inr(b.royaltyEarned)}</b></div>
         <div>Royalty paid<b>${inr(b.royaltyPaid)}</b></div><div>Royalty pending<b>${inr(b.royaltyPending)}</b></div></div>
         <p class="mut">Last payout: ${b.lastPayoutDate ? esc(b.lastPayoutDate) : 'none yet'} · Available on: ${esc(b.availableOn.join(', '))}</p>`}
  </div>`).join('');
}

// ---- author: new ticket ----
async function newTicket() {
  const { books } = await api('/books');
  main().innerHTML = `<h1>Submit a Support Query</h1><form class="card" id="f">
    <label>Which book is this about?</label><select name="bookId"><option value="">General / Account Level</option>${books.map((b) => `<option value="${b.id}">${esc(b.title)}</option>`).join('')}</select>
    <label>Subject</label><input type="text" name="subject" required minlength="3" maxlength="200">
    <label>Describe your query</label><textarea name="description" rows="6" required minlength="10" maxlength="5000"></textarea>
    <label>Attachment (optional)</label><input type="file" name="file" accept=".png,.jpg,.jpeg,.webp,.pdf,.txt"><div class="mut">PNG, JPEG, WEBP, PDF or TXT up to 5 MB.</div>
    <div class="row"><button>Submit query</button></div><p id="e" class="err"></p></form>`;
  $('#f').onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
      await api('/tickets', { method: 'POST', body: fd });
      location.hash = '#/tickets';
    } catch (e) { $('#e').innerHTML = errText(e); }
  };
}

// ---- author: my tickets (live-updating) ----
async function myTickets() {
  // Keep which tickets are expanded and any half-typed replies across live refreshes.
  const open = new Set([...document.querySelectorAll('details[open]')].map((d) => d.dataset.id));
  const typed = Object.fromEntries([...document.querySelectorAll('textarea[data-reply]')].map((t) => [t.dataset.reply, t.value]));
  const { tickets } = await api('/tickets');
  if (!tickets.length) { main().innerHTML = '<h1>My Tickets</h1><div class="card">You haven\'t raised any queries yet. Use “Submit a Query” to get started.</div>'; S.onEvent = myTickets; return; }
  main().innerHTML = '<h1>My Tickets</h1>' + tickets.map((t) => `<details class="card" data-id="${t.id}" ${open.has(String(t.id)) ? 'open' : ''}>
    <summary><div class="row" style="margin:0;justify-content:space-between"><b>#${t.id} ${esc(t.subject)}</b>${badge(t.status, 's-' + t.status)}</div>
    <div class="mut">${esc(t.bookTitle || 'General / Account Level')} · ${when(t.createdAt)} · ${t.messages.filter((m) => m.senderRole === 'admin').length} repl${t.messages.filter((m) => m.senderRole === 'admin').length === 1 ? 'y' : 'ies'} from BookLeaf</div></summary>
    <div class="msg">${esc(t.description)}</div>
    ${t.messages.map((m) => `<div class="msg ${m.senderRole}"><div class="mut">${m.senderRole === 'admin' ? 'BookLeaf Support' : 'You'} · ${when(m.createdAt)}</div>${esc(m.body)}</div>`).join('')}
    ${t.status === 'Closed' ? '<p class="mut">This ticket is closed.</p>' : `<div class="row"><textarea rows="2" data-reply="${t.id}" placeholder="Add a follow-up…">${esc(typed[t.id] || '')}</textarea><button data-send="${t.id}">Send</button></div>`}
  </details>`).join('');
  document.querySelectorAll('button[data-send]').forEach((b) => (b.onclick = async () => {
    const id = b.dataset.send, ta = document.querySelector(`textarea[data-reply="${id}"]`);
    if (!ta.value.trim()) return;
    b.disabled = true;
    try { await api(`/tickets/${id}/messages`, { method: 'POST', body: { body: ta.value } }); ta.value = ''; } catch (e) { alert(e.message); }
    myTickets();
  }));
  S.onEvent = () => myTickets();
}

// ---- admin: queue ----
async function adminQueue() {
  const f = S.filters;
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const { tickets } = await api('/admin/tickets' + (qs ? '?' + qs : ''));
  const hours = (d) => (Date.now() - new Date(d)) / 36e5;
  main().innerHTML = `<h1>Ticket queue <span class="mut">(${tickets.length})</span></h1>
  <form class="card row" id="flt" style="margin-top:0">
    <select name="status">${opts(STATS, f.status, 'Any status')}</select><select name="category">${opts(CATS, f.category, 'Any category')}</select>
    <select name="priority">${opts(PRIS, f.priority, 'Any priority')}</select>
    <select name="assigned"><option value="">Anyone</option><option value="me" ${f.assigned === 'me' ? 'selected' : ''}>Assigned to me</option><option value="unassigned" ${f.assigned === 'unassigned' ? 'selected' : ''}>Unassigned</option></select>
    <label style="margin:0">From</label><input type="date" name="from" value="${f.from || ''}"><label style="margin:0">To</label><input type="date" name="to" value="${f.to || ''}">
    <button class="sec" type="button" id="clr">Clear</button></form>
  ${tickets.length ? `<div class="card" style="padding:0;overflow:auto"><table><tr><th>#</th><th>Priority</th><th>Subject</th><th>Author</th><th>Category</th><th>Status</th><th>Assigned</th><th>Age</th></tr>
  ${tickets.map((t) => {
    const h = hours(t.createdAt), unresolved = !['Resolved', 'Closed'].includes(t.status);
    return `<tr class="click" data-id="${t.id}"><td>${t.id}</td><td>${badge(t.priority, 'p-' + t.priority)}${t.aiStatus === 'failed' ? ' <span title="AI triage failed, heuristic used">⚠️</span>' : t.aiStatus === 'pending' ? ' <span class="mut">…</span>' : ''}</td>
    <td>${esc(t.subject)}<div class="mut">${esc(t.bookTitle || 'General')}</div></td><td>${esc(t.authorName)}</td><td>${esc(t.category)}</td><td>${badge(t.status, 's-' + t.status)}</td>
    <td>${esc(t.assignedName || '—')}</td><td class="${unresolved && h > 48 ? 'old' : ''}">${h < 48 ? Math.round(h) + 'h' : Math.round(h / 24) + 'd'}</td></tr>`;
  }).join('')}</table></div>` : '<div class="card">No tickets match these filters.</div>'}`;
  $('#flt').onchange = (e) => { S.filters = Object.fromEntries([...new FormData($('#flt'))].filter(([, v]) => v)); adminQueue(); };
  $('#clr').onclick = () => { S.filters = {}; adminQueue(); };
  document.querySelectorAll('tr.click').forEach((r) => (r.onclick = () => (location.hash = '#/ticket/' + r.dataset.id)));
  S.onEvent = () => adminQueue();
}

// ---- admin: ticket detail ----
async function adminTicket(id) {
  main().innerHTML = `<a href="#/queue">← Back to queue</a><div class="grid" style="margin-top:10px"><section>
    <div id="head" class="card"></div><div id="thread"></div>
    <div class="card"><h3>Reply to author</h3><div id="dmsg" class="mut">Generating AI draft…</div>
    <textarea id="reply" rows="10" placeholder="Write your reply…"></textarea>
    <div class="row"><button id="send">Send reply</button><button id="sendres" class="sec">Send &amp; mark Resolved</button><button id="regen" class="sec">↻ Regenerate AI draft</button></div><p id="e" class="err"></p></div></section>
    <aside><div id="meta" class="card"></div><div class="card"><h3>Internal notes <span class="mut">(not visible to author)</span></h3><div id="notes"></div>
    <textarea id="note" rows="3"></textarea><div class="row"><button id="addnote" class="sec">Add note</button></div></div></aside></div>`;

  let touched = false;
  $('#reply').oninput = () => (touched = true);

  async function load() {
    const { ticket: t, messages, book } = await api('/admin/tickets/' + id);
    $('#head').innerHTML = `<h2>#${t.id} ${esc(t.subject)}</h2><div class="mut">${esc(t.authorName)} · ${esc(t.authorEmail)} · ${when(t.createdAt)}</div>
      <p class="msg" style="margin-top:10px">${esc(t.description)}</p>${t.attachmentName ? `<div class="mut">📎 ${t.attachmentUrl ? `<a href="#" data-download="${esc(t.attachmentUrl)}">${esc(t.attachmentName)}</a>` : esc(t.attachmentName)}</div>` : ''}
      ${book ? `<div class="mut"><b>${esc(book.title)}</b> · ${esc(book.status)} · sold ${book.copies_sold} · earned ${inr(book.royalty_earned)} · paid ${inr(book.royalty_paid)} · pending ${inr(book.royalty_pending)}</div>` : '<div class="mut">General / account-level query</div>'}`;
    $('#thread').innerHTML = messages.filter((m) => !m.internal).map((m) => `<div class="msg ${m.senderRole}"><div class="mut">${m.senderRole === 'admin' ? esc(m.senderName) : 'Author'} · ${when(m.createdAt)}</div>${esc(m.body)}</div>`).join('');
    $('#notes').innerHTML = messages.filter((m) => m.internal).map((m) => `<div class="msg note"><div class="mut">${esc(m.senderName)} · ${when(m.createdAt)}</div>${esc(m.body)}</div>`).join('') || '<p class="mut">No notes yet.</p>';
    document.querySelector('[data-download]')?.addEventListener('click', async (e) => {
      e.preventDefault();
      const a = e.currentTarget;
      const r = await fetch(a.dataset.download, { headers: { Authorization: 'Bearer ' + S.token } });
      if (!r.ok) return alert('Unable to download attachment');
      const url = URL.createObjectURL(await r.blob());
      const link = document.createElement('a'); link.href = url; link.download = a.textContent; link.click();
      URL.revokeObjectURL(url);
    });
    const src = (s) => (s === 'ai' ? 'AI' : s === 'admin' ? 'overridden by admin' : 'rule-based');
    $('#meta').innerHTML = `<label style="margin-top:0">Status</label><select id="st">${opts(STATS, t.status)}</select>
      <label>Category <span class="mut">(${src(t.categorySource)})</span></label><select id="ct">${opts(CATS, t.category)}</select>
      <label>Priority <span class="mut">(${src(t.prioritySource)})</span></label><select id="pr">${opts(PRIS, t.priority)}</select>
      ${t.aiReason ? `<p class="mut">${t.aiStatus === 'failed' ? '⚠️ AI triage failed: ' : 'AI: '}${esc(t.aiReason)}</p>` : ''}
      ${t.aiStatus !== 'done' && t.aiStatus !== 'pending' ? '<button class="sec" id="retry">Retry AI triage</button>' : ''}
      <label>Assigned to</label><div>${esc(t.assignedName || 'Unassigned')}</div>
      <div class="row">${t.assignedTo === S.user.id ? '<button class="sec" id="unassign">Unassign</button>' : '<button class="sec" id="assign">Assign to me</button>'}</div>`;
    const patch = (body, after) => async () => { await api('/admin/tickets/' + id, { method: 'PATCH', body }); await load(); after?.(); };
    $('#st').onchange = (e) => patch({ status: e.target.value })();
    $('#ct').onchange = (e) => patch({ category: e.target.value }, () => ($('#dmsg').textContent = 'Category changed — regenerate the draft to use the new policy context.'))();
    $('#pr').onchange = (e) => patch({ priority: e.target.value })();
    $('#assign')?.addEventListener('click', patch({ assignedTo: 'me' }));
    $('#unassign')?.addEventListener('click', patch({ assignedTo: null }));
    $('#retry')?.addEventListener('click', async () => { await api(`/admin/tickets/${id}/ai/retry`, { method: 'POST' }); load(); });
  }

  async function loadDraft(refresh) {
    $('#dmsg').textContent = 'Generating AI draft…';
    try {
      const d = await api(`/admin/tickets/${id}/draft?refresh=${refresh ? 1 : 0}`);
      if (!touched || refresh) { $('#reply').value = d.draft; touched = false; }
      $('#dmsg').textContent = `AI-generated draft${d.cached ? ' (cached)' : ''} — review and edit before sending.`;
    } catch (e) { $('#dmsg').textContent = '⚠️ ' + e.message; }
  }

  async function send(status) {
    const body = $('#reply').value.trim();
    if (!body) { $('#e').textContent = 'Write a reply first.'; return; }
    $('#e').textContent = '';
    try { await api(`/admin/tickets/${id}/reply`, { method: 'POST', body: { body, status } }); $('#reply').value = ''; touched = false; $('#dmsg').textContent = 'Reply sent.'; await load(); }
    catch (e) { $('#e').innerHTML = errText(e); }
  }
  $('#send').onclick = () => send();
  $('#sendres').onclick = () => send('Resolved');
  $('#regen').onclick = () => loadDraft(true);
  $('#addnote').onclick = async () => {
    const body = $('#note').value.trim(); if (!body) return;
    await api(`/admin/tickets/${id}/notes`, { method: 'POST', body: { body } }); $('#note').value = ''; load();
  };

  await load();
  S.onEvent = (ev) => ev.ticketId === id && load();
  loadDraft(false); // don't block the page on the LLM
}

connectEvents();
if (!location.hash) location.hash = S.user?.role === 'admin' ? '#/queue' : '#/books';
render();
