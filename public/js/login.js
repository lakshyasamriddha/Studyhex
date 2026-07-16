// If already signed in, skip straight to the dashboard.
(async () => {
  try {
    await api.get('/auth/me');
    window.location.href = '/dashboard.html';
  } catch (_) {
    // not signed in — stay on this page
  }
})();

const tabs = document.querySelectorAll('.auth-tab');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const isLogin = tab.dataset.tab === 'login';
    loginForm.style.display = isLogin ? 'block' : 'none';
    registerForm.style.display = isLogin ? 'none' : 'block';
  });
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';
  try {
    await api.post('/auth/login', {
      emailOrUsername: document.getElementById('login-id').value.trim(),
      password: document.getElementById('login-password').value
    });
    window.location.href = '/dashboard.html';
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('register-error');
  errorEl.textContent = '';
  try {
    await api.post('/auth/register', {
      username: document.getElementById('reg-username').value.trim(),
      email: document.getElementById('reg-email').value.trim(),
      password: document.getElementById('reg-password').value
    });
    window.location.href = '/dashboard.html';
  } catch (err) {
    errorEl.textContent = err.message;
  }
});
