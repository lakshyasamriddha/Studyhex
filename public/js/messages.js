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

function avatarHtml(username, photoUrl, size = 'sm') {
  const cls = size === 'sm' ? 'avatar-sm' : 'avatar-lg';
  if (photoUrl) {
    return `<div class="${cls}"><img src="${escapeHtml(photoUrl)}" alt=""></div>`;
  }
  return `<div class="${cls}">${escapeHtml(initials(username))}</div>`;
}

let currentUser = null;
let activeUsername = null;

async function loadConversations() {
  const list = document.getElementById('conversations-list');
  try {
    const { conversations } = await api.get('/messages/conversations');
    if (conversations.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding:20px 0;">
        <div class="glyph">✉</div>No conversations yet.
      </div>`;
      return;
    }
    list.innerHTML = conversations.map(c => `
      <div class="conversation-item ${c.username === activeUsername ? 'active' : ''}" data-username="${escapeHtml(c.username)}">
        ${avatarHtml(c.username, c.profile_photo_url)}
        <div class="convo-meta">
          <div class="convo-name">@${escapeHtml(c.username)}</div>
          <div class="convo-snippet">${escapeHtml(c.last_body)}</div>
        </div>
        ${c.unread_count > 0 ? `<span class="badge">${c.unread_count}</span>` : ''}
      </div>
    `).join('');
    list.querySelectorAll('.conversation-item').forEach(el => {
      el.addEventListener('click', () => openThread(el.dataset.username));
    });
  } catch (err) {
    showToast(err.message, true);
  }
}

async function openThread(username) {
  activeUsername = username;
  history.replaceState(null, '', `/messages.html?with=${encodeURIComponent(username)}`);
  document.querySelectorAll('.conversation-item').forEach(el => {
    el.classList.toggle('active', el.dataset.username === username);
  });

  const pane = document.getElementById('thread-pane');
  pane.innerHTML = '<div class="empty-state">Loading…</div>';

  try {
    const { user, messages } = await api.get(`/messages/${encodeURIComponent(username)}`);
    pane.innerHTML = `
      <div class="thread-header">
        ${avatarHtml(user.username, null)}
        <strong>@${escapeHtml(user.username)}</strong>
      </div>
      <div class="thread-messages" id="thread-messages"></div>
      <form id="thread-form" class="thread-form">
        <textarea id="thread-body" placeholder="Write a message…" required></textarea>
        <button type="submit" class="btn btn-primary">Send</button>
      </form>
      <span class="error-text" id="thread-error"></span>
    `;

    const threadEl = document.getElementById('thread-messages');
    threadEl.innerHTML = messages.map(m => `
      <div class="msg-bubble ${m.sender_id === currentUser.id ? 'mine' : 'theirs'}">
        <div>${escapeHtml(m.body)}</div>
        <div class="msg-time">${timeAgo(m.created_at)}</div>
      </div>
    `).join('');
    threadEl.scrollTop = threadEl.scrollHeight;

    document.getElementById('thread-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const bodyEl = document.getElementById('thread-body');
      const body = bodyEl.value.trim();
      if (!body) return;
      try {
        await api.post(`/messages/${encodeURIComponent(username)}`, { body });
        bodyEl.value = '';
        await openThread(username);
        await loadConversations();
      } catch (err) {
        document.getElementById('thread-error').textContent = err.message;
      }
    });

    await refreshUnreadBadge();
  } catch (err) {
    pane.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

document.getElementById('new-convo-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('new-convo-username');
  const errorEl = document.getElementById('new-convo-error');
  errorEl.textContent = '';
  const username = input.value.trim().replace(/^@/, '');
  if (!username) return;
  if (currentUser && username === currentUser.username) {
    errorEl.textContent = "You can't message yourself";
    return;
  }
  await openThread(username);
  await loadConversations();
  input.value = '';
});

(async function init() {
  const user = await requireSession();
  if (!user) return;
  currentUser = user;
  document.getElementById('user-chip-name').textContent = user.username;
  document.getElementById('user-chip').querySelector('.avatar').textContent = initials(user.username);

  await loadConversations();
  await refreshUnreadBadge();

  const params = new URLSearchParams(window.location.search);
  const withUser = params.get('with');
  if (withUser) await openThread(withUser);
})();
