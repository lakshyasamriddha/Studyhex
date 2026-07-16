// Shared fetch helper for all pages. Uses the httpOnly cookie set at
// login, so no token handling is needed client-side.

const api = {
  async request(method, path, body) {
    const res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  },
  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body) { return this.request('PUT', path, body); }
};

// Redirects to login if the session cookie is missing/invalid.
// Call this at the top of any page that requires auth.
async function requireSession() {
  try {
    const { user } = await api.get('/auth/me');
    return user;
  } catch (err) {
    window.location.href = '/index.html';
    return null;
  }
}

function showToast(message, isError = false) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

// Shows the unread-messages count on the "Messages" nav link, if present on this page.
async function refreshUnreadBadge() {
  const badge = document.getElementById('nav-unread-badge');
  if (!badge) return;
  try {
    const { count } = await api.get('/messages/unread/count');
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  } catch (err) { /* non-critical */ }
}

async function logout() {
  await api.post('/auth/logout');
  window.location.href = '/index.html';
}
