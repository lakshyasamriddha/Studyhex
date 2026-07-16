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

const postId = new URLSearchParams(window.location.search).get('id');
let currentUser = null;

function renderReplies(replies) {
  const list = document.getElementById('replies-list');
  if (replies.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted); font-size:0.88rem;">No replies yet — be the first to help.</p>';
    return;
  }
  list.innerHTML = replies.map(r => `
    <div class="reply-item">
      <div class="reply-meta">@${escapeHtml(r.username)} · ${timeAgo(r.created_at)}</div>
      <div class="post-body">${escapeHtml(r.body)}</div>
    </div>
  `).join('');
}

async function loadPost() {
  if (!postId) {
    window.location.href = '/forum.html';
    return;
  }
  try {
    const { post, replies } = await api.get(`/forum/posts/${postId}`);
    document.title = `${post.title} — StudyReck Forum`;
    document.getElementById('post-title').textContent = post.title;
    document.getElementById('post-tag-holder').innerHTML = post.tag
      ? `<span class="tag-pill">${escapeHtml(post.tag)}</span>` : '';
    const messageLink = currentUser && post.username !== currentUser.username
      ? `<a href="/messages.html?with=${encodeURIComponent(post.username)}" style="color:var(--amber);">Message</a>`
      : '';
    document.getElementById('post-meta').innerHTML =
      `<span>@${escapeHtml(post.username)}</span><span>${timeAgo(post.created_at)}</span>${messageLink}`;
    document.getElementById('post-body-text').textContent = post.body;
    renderReplies(replies);
  } catch (err) {
    showToast(err.message, true);
  }
}

document.getElementById('reply-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('reply-error');
  errorEl.textContent = '';
  const body = document.getElementById('reply-body').value;
  try {
    await api.post(`/forum/posts/${postId}/replies`, { body });
    document.getElementById('reply-body').value = '';
    loadPost();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

(async function init() {
  const user = await requireSession();
  if (!user) return;
  currentUser = user;
  document.getElementById('user-chip-name').textContent = user.username;
  document.getElementById('user-chip').querySelector('.avatar').textContent = initials(user.username);
  refreshUnreadBadge();
  loadPost();
})();
