function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function medalClass(rank) {
  if (rank === 1) return 'top-1';
  if (rank === 2) return 'top-2';
  if (rank === 3) return 'top-3';
  return '';
}

async function loadLeaderboard(range) {
  const list = document.getElementById('leaderboard-list');
  const meCard = document.getElementById('me-card');
  try {
    const data = await api.get(`/leaderboard?range=${range}`);

    if (data.leaderboard.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="glyph">◐</div>No study sessions logged yet. Be the first on the board.</div>';
      meCard.style.display = 'none';
      return;
    }

    list.innerHTML = data.leaderboard.map(row => `
      <div class="leader-row ${row.isMe ? 'is-me' : ''}">
        <div class="rank-medal ${medalClass(row.rank)}">${row.rank}</div>
        <div class="leader-name">
          <span>${escapeHtml(row.displayName)}</span>
          <span class="username">@${escapeHtml(row.username)}</span>
        </div>
        <div class="leader-time">${formatDuration(row.totalSeconds)}</div>
      </div>
    `).join('');

    if (data.me) {
      meCard.style.display = 'block';
      document.getElementById('me-rank').textContent = `#${data.me.rank}`;
    } else {
      meCard.style.display = 'none';
    }
  } catch (err) {
    showToast(err.message, true);
  }
}

document.querySelectorAll('.range-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.range-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadLeaderboard(tab.dataset.range);
  });
});

(async function init() {
  const user = await requireSession();
  if (!user) return;
  document.getElementById('user-chip-name').textContent = user.username;
  document.getElementById('user-chip').querySelector('.avatar').textContent = initials(user.username);
  refreshUnreadBadge();
  loadLeaderboard('all');
})();
