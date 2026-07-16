function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(isoString) {
  const then = new Date(isoString.replace(' ', 'T') + 'Z');
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

let friendUsernames = [];

async function loadFriendsForSharing() {
  try {
    const { friends } = await api.get('/friends');
    friendUsernames = friends.map(f => f.username);
  } catch (err) {
    friendUsernames = [];
  }
}

function shareControlHtml(noteId) {
  if (friendUsernames.length === 0) {
    return '<span style="font-size:0.78rem; color:var(--text-muted);">Add friends on your profile to share notes.</span>';
  }
  return `
    <select data-share-select="${noteId}">
      <option value="">Share with…</option>
      ${friendUsernames.map(u => `<option value="${escapeHtml(u)}">@${escapeHtml(u)}</option>`).join('')}
    </select>
    <button type="button" class="btn btn-secondary btn-sm" data-share-btn="${noteId}">Share</button>
    <span class="error-text" data-share-error="${noteId}"></span>
  `;
}

async function loadMyNotes() {
  const list = document.getElementById('my-notes-list');
  try {
    const { notes } = await api.get('/notes');
    if (notes.length === 0) {
      list.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">No notes yet — add one above.</span>';
      return;
    }
    list.innerHTML = notes.map(n => `
      <div class="note-item">
        ${n.title ? `<div class="note-item-title">${escapeHtml(n.title)}</div>` : ''}
        <div class="note-item-meta">${timeAgo(n.created_at)}</div>
        <div class="note-item-body">${escapeHtml(n.body)}</div>
        <div class="note-item-actions">
          ${shareControlHtml(n.id)}
          <button type="button" class="btn btn-secondary btn-sm" data-delete="${n.id}">Delete</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-share-btn]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.shareBtn;
        const select = list.querySelector(`[data-share-select="${id}"]`);
        const errorEl = list.querySelector(`[data-share-error="${id}"]`);
        errorEl.textContent = '';
        if (!select.value) return;
        try {
          await api.post(`/notes/${id}/share`, { username: select.value });
          showToast(`Shared with @${select.value}`);
          select.value = '';
        } catch (err) {
          errorEl.textContent = err.message;
        }
      });
    });

    list.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api.request('DELETE', `/notes/${btn.dataset.delete}`);
          loadMyNotes();
        } catch (err) {
          showToast(err.message, true);
        }
      });
    });
  } catch (err) {
    showToast(err.message, true);
  }
}

async function loadSharedNotes() {
  const list = document.getElementById('shared-notes-list');
  try {
    const { notes } = await api.get('/notes/shared');
    if (notes.length === 0) {
      list.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">Nothing shared with you yet.</span>';
      return;
    }
    list.innerHTML = notes.map(n => `
      <div class="note-item">
        ${n.title ? `<div class="note-item-title">${escapeHtml(n.title)}</div>` : ''}
        <div class="note-item-meta">from @${escapeHtml(n.shared_by)} · ${timeAgo(n.shared_at)}</div>
        <div class="note-item-body">${escapeHtml(n.body)}</div>
      </div>
    `).join('');
  } catch (err) {
    showToast(err.message, true);
  }
}

document.getElementById('note-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('note-error');
  errorEl.textContent = '';
  const title = document.getElementById('note-title').value.trim();
  const body = document.getElementById('note-body').value.trim();
  if (!body) return;
  try {
    await api.post('/notes', { title, body });
    document.getElementById('note-title').value = '';
    document.getElementById('note-body').value = '';
    showToast('Note saved');
    loadMyNotes();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

(async function init() {
  const user = await requireSession();
  if (!user) return;
  document.getElementById('user-chip-name').textContent = user.username;
  document.getElementById('user-chip').querySelector('.avatar').textContent = initials(user.username);
  refreshUnreadBadge();

  await loadFriendsForSharing();
  await loadMyNotes();
  await loadSharedNotes();
})();
