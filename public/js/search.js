function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function avatarHtml(username, photoUrl) {
  if (photoUrl) {
    return `<div class="avatar-sm"><img src="${escapeHtml(photoUrl)}" alt=""></div>`;
  }
  return `<div class="avatar-sm">${escapeHtml(initials(username))}</div>`;
}

const searchInput = document.getElementById('search-input');
const resultsEl = document.getElementById('search-results');
let searchTimeout = null;

function renderResults(users) {
  if (!users.length) {
    resultsEl.innerHTML = `<div class="empty-state" style="padding:20px 0;">No users found.</div>`;
    return;
  }
  resultsEl.innerHTML = users.map(u => `
    <div class="friend-item" style="justify-content:space-between;">
      <a href="/view-profile.html?u=${encodeURIComponent(u.username)}" style="display:flex; align-items:center; gap:10px; text-decoration:none; color:inherit;">
        ${avatarHtml(u.username, u.profile_photo_url)}
        <span class="friend-name">@${escapeHtml(u.username)}</span>
      </a>
      <a class="btn btn-secondary btn-sm" href="/messages.html?with=${encodeURIComponent(u.username)}">Message</a>
    </div>
  `).join('');
}

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  const q = searchInput.value.trim();
  if (!q) {
    resultsEl.innerHTML = '';
    return;
  }
  searchTimeout = setTimeout(async () => {
    try {
      const { users } = await api.get(`/friends/search?q=${encodeURIComponent(q)}`);
      renderResults(users);
    } catch (err) {
      resultsEl.innerHTML = `<div class="error-text">${escapeHtml(err.message)}</div>`;
    }
  }, 300);
});

(async function init() {
  const user = await requireSession();
  if (!user) return;
  document.getElementById('user-chip-name').textContent = user.username;
  document.getElementById('user-chip').querySelector('.avatar').textContent = initials(user.username);
  refreshUnreadBadge();
})();
