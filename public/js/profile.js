let skills = [];
let photoDataUrl = null; // null = unchanged; '' = removed; data:... = new upload

const fields = ['full_name', 'bio', 'profession', 'class_name', 'job_title', 'company', 'work_hours',
  'contact_email', 'contact_phone', 'visibility'];

const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024; // 1.5MB, before base64 encoding

function renderAvatarPreview(url, name) {
  const el = document.getElementById('avatar-preview');
  if (url) {
    el.innerHTML = `<img src="${url}" alt="">`;
  } else {
    el.textContent = initials(name);
  }
}

document.getElementById('avatar-preview').addEventListener('click', () => {
  document.getElementById('photo-input').click();
});

document.getElementById('photo-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const errorEl = document.getElementById('photo-error');
  errorEl.textContent = '';
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    errorEl.textContent = 'Please choose an image file';
    e.target.value = '';
    return;
  }
  if (file.size > MAX_PHOTO_BYTES) {
    errorEl.textContent = 'Image is too large — please pick one under 1.5MB';
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    photoDataUrl = reader.result;
    renderAvatarPreview(photoDataUrl, document.getElementById('full_name').value);
  };
  reader.onerror = () => {
    errorEl.textContent = 'Could not read that file';
  };
  reader.readAsDataURL(file);
});

document.getElementById('remove-photo-btn').addEventListener('click', () => {
  photoDataUrl = '';
  document.getElementById('photo-input').value = '';
  document.getElementById('photo-error').textContent = '';
  renderAvatarPreview(null, document.getElementById('full_name').value);
});

function renderSkills() {
  const list = document.getElementById('skills-list');
  if (skills.length === 0) {
    list.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">No skills added yet.</span>';
    return;
  }
  list.innerHTML = skills.map((s, i) => `
    <span class="tag">${escapeHtml(s)} <button type="button" data-idx="${i}" aria-label="Remove ${escapeHtml(s)}">×</button></span>
  `).join('');
  list.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      skills.splice(Number(btn.dataset.idx), 1);
      renderSkills();
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById('skill-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const val = e.target.value.trim();
    if (val && !skills.includes(val)) {
      skills.push(val);
      renderSkills();
    }
    e.target.value = '';
  }
});

async function loadProfile() {
  const { profile } = await api.get('/profile/me');
  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el) el.value = profile[f] || (f === 'visibility' ? 'private' : '');
  });
  skills = profile.skills || [];
  renderSkills();
  document.getElementById('profile-heading').textContent = profile.full_name || 'Your profile';
  renderAvatarPreview(profile.profile_photo_url, profile.full_name);
}

document.getElementById('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('profile-error');
  errorEl.textContent = '';
  const payload = {};
  fields.forEach(f => { payload[f] = document.getElementById(f).value; });
  payload.skills = skills;
  if (photoDataUrl !== null) payload.profile_photo_url = photoDataUrl;

  try {
    await api.put('/profile/me', payload);
    showToast('Profile saved');
    document.getElementById('profile-heading').textContent = payload.full_name || 'Your profile';
    photoDataUrl = null; // saved — next load will reflect the server copy
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById('username-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('username-input');
  const errorEl = document.getElementById('username-error');
  errorEl.textContent = '';
  try {
    const { user } = await api.put('/auth/username', { username: input.value.trim() });
    document.getElementById('user-chip-name').textContent = user.username;
    showToast('Username updated');
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

async function loadFriends() {
  try {
    const [{ friends }, { requests }] = await Promise.all([
      api.get('/friends'),
      api.get('/friends/requests')
    ]);

    const reqSection = document.getElementById('friend-requests-section');
    const reqList = document.getElementById('friend-requests-list');
    if (requests.length > 0) {
      reqSection.style.display = '';
      reqList.innerHTML = requests.map(r => `
        <div class="friend-item">
          <span class="friend-name">@${escapeHtml(r.username)}</span>
          <button type="button" class="btn btn-primary btn-sm" data-accept="${escapeHtml(r.username)}">Accept</button>
          <button type="button" class="btn btn-secondary btn-sm" data-decline="${escapeHtml(r.username)}">Decline</button>
        </div>
      `).join('');
      reqList.querySelectorAll('[data-accept]').forEach(btn => {
        btn.addEventListener('click', async () => {
          await api.post(`/friends/accept/${encodeURIComponent(btn.dataset.accept)}`);
          showToast('Friend request accepted');
          loadFriends();
        });
      });
      reqList.querySelectorAll('[data-decline]').forEach(btn => {
        btn.addEventListener('click', async () => {
          await api.post(`/friends/decline/${encodeURIComponent(btn.dataset.decline)}`);
          loadFriends();
        });
      });
    } else {
      reqSection.style.display = 'none';
    }

    const friendsList = document.getElementById('friends-list');
    friendsList.innerHTML = friends.length === 0
      ? '<span style="color:var(--text-muted); font-size:0.85rem;">No friends added yet.</span>'
      : friends.map(f => `
        <div class="friend-item">
          <span class="friend-name">@${escapeHtml(f.username)}</span>
          <button type="button" class="btn btn-secondary btn-sm" data-remove="${escapeHtml(f.username)}">Remove</button>
        </div>
      `).join('');
    friendsList.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await api.request('DELETE', `/friends/${encodeURIComponent(btn.dataset.remove)}`);
        loadFriends();
      });
    });
  } catch (err) {
    showToast(err.message, true);
  }
}

document.getElementById('add-friend-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('friend-username-input');
  const errorEl = document.getElementById('add-friend-error');
  errorEl.textContent = '';
  const username = input.value.trim().replace(/^@/, '');
  if (!username) return;
  try {
    await api.post(`/friends/request/${encodeURIComponent(username)}`);
    showToast('Friend request sent');
    input.value = '';
    loadFriends();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

(async function init() {
  const user = await requireSession();
  if (!user) return;
  document.getElementById('user-chip-name').textContent = user.username;
  document.getElementById('user-chip').querySelector('.avatar').textContent = initials(user.username);
  document.getElementById('username-input').value = user.username;
  refreshUnreadBadge();
  await loadProfile();
  await loadFriends();
})();
