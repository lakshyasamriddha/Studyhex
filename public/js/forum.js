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

let searchDebounce = null;

async function loadPosts() {
  const query = document.getElementById('search-input').value.trim();
  const tag = document.getElementById('tag-filter').value;
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  if (tag) params.set('tag', tag);

  const list = document.getElementById('posts-list');
  try {
    const data = await api.get(`/forum/posts?${params.toString()}`);
    if (data.posts.length === 0) {
      list.innerHTML = `<div class="card"><div class="empty-state"><div class="glyph">◐</div>
        ${query || tag ? 'No posts match your search.' : 'No posts yet — ask the first question or share a study guide.'}
      </div></div>`;
      return;
    }
    list.innerHTML = data.posts.map(p => `
      <a class="card forum-post-card" href="/forum-post.html?id=${p.id}">
        <h3 class="forum-post-title">${escapeHtml(p.title)}</h3>
        <div class="forum-post-meta">
          ${p.tag ? `<span class="tag-pill">${escapeHtml(p.tag)}</span>` : ''}
          <span>@${escapeHtml(p.username)}</span>
          <span>${timeAgo(p.created_at)}</span>
          <span>${p.reply_count} ${p.reply_count === 1 ? 'reply' : 'replies'}</span>
        </div>
        <p class="forum-post-snippet">${escapeHtml(p.body)}</p>
      </a>
    `).join('');
  } catch (err) {
    showToast(err.message, true);
  }
}

async function loadTags() {
  try {
    const { tags } = await api.get('/forum/tags');
    const select = document.getElementById('tag-filter');
    select.innerHTML = '<option value="">All topics</option>' +
      tags.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  } catch (err) {
    // non-critical, ignore
  }
}

document.getElementById('search-input').addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(loadPosts, 300);
});
document.getElementById('tag-filter').addEventListener('change', loadPosts);

document.getElementById('new-post-btn').addEventListener('click', () => {
  document.getElementById('new-post-card').style.display = 'block';
  document.getElementById('post-title').focus();
});
document.getElementById('cancel-post-btn').addEventListener('click', () => {
  document.getElementById('new-post-card').style.display = 'none';
  document.getElementById('new-post-form').reset();
});

document.getElementById('new-post-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('new-post-error');
  errorEl.textContent = '';
  try {
    await api.post('/forum/posts', {
      title: document.getElementById('post-title').value,
      body: document.getElementById('post-body').value,
      tag: document.getElementById('post-tag').value
    });
    document.getElementById('new-post-form').reset();
    document.getElementById('new-post-card').style.display = 'none';
    showToast('Posted');
    loadTags();
    loadPosts();
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
  loadTags();
  loadPosts();
})();
