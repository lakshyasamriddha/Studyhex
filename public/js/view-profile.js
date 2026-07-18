function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

(async function init() {
  const user = await requireSession();
  if (!user) return;
  document.getElementById('user-chip-name').textContent = user.username;
  document.getElementById('user-chip').querySelector('.avatar').textContent = initials(user.username);
  refreshUnreadBadge();

  const params = new URLSearchParams(window.location.search);
  const username = params.get('u');
  const card = document.getElementById('profile-card');

  if (!username) {
    card.innerHTML = `<div class="empty-state">No user specified.</div>`;
    return;
  }

  document.getElementById('message-btn').href = `/messages.html?with=${encodeURIComponent(username)}`;

  try {
    const { profile } = await api.get(`/profile/${encodeURIComponent(username)}`);
    document.getElementById('profile-heading').textContent = profile.full_name || `@${username}`;

    card.innerHTML = `
      ${profile.bio ? `<p>${escapeHtml(profile.bio)}</p>` : ''}
      <div class="field-row">
        ${profile.profession ? `<div><strong>Profession:</strong> ${escapeHtml(profile.profession)}</div>` : ''}
        ${profile.job_title ? `<div><strong>Job title:</strong> ${escapeHtml(profile.job_title)}</div>` : ''}
      </div>
      ${profile.company ? `<div><strong>Company/School:</strong> ${escapeHtml(profile.company)}</div>` : ''}
      ${profile.contact_email ? `<div><strong>Email:</strong> ${escapeHtml(profile.contact_email)}</div>` : ''}
      ${profile.skills && profile.skills.length ? `
        <div class="tag-list" style="margin-top:10px;">
          ${profile.skills.map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}
        </div>` : ''}
    `;
  } catch (err) {
    card.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
})();
