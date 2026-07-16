const CIRCUMFERENCE = 326.7;
const SESSION_LENGTH = 25 * 60; // 25 min focus session

let remaining = SESSION_LENGTH;
let elapsedThisRun = 0;
let tickHandle = null;
let subjects = [];

const ringProgress = document.getElementById('ring-progress');
const timerDisplay = document.getElementById('timer-display');
const timerLabel = document.getElementById('timer-label');
const timerToggle = document.getElementById('timer-toggle');
const subjectSelect = document.getElementById('subject-select');

function renderTimer() {
  const m = Math.floor(remaining / 60).toString().padStart(2, '0');
  const s = Math.floor(remaining % 60).toString().padStart(2, '0');
  timerDisplay.textContent = `${m}:${s}`;
  const fraction = 1 - remaining / SESSION_LENGTH;
  ringProgress.setAttribute('stroke-dashoffset', String(CIRCUMFERENCE * (1 - fraction)));
}

async function logSession(seconds) {
  if (seconds < 1) return;
  const subjectId = subjectSelect.value || null;
  try {
    await api.post('/study/sessions', {
      subject_id: subjectId,
      mode: 'focus',
      seconds: Math.round(seconds),
      session_date: new Date().toISOString().slice(0, 10)
    });
    showToast(`Logged ${formatDuration(seconds)} of focus time`);
    loadSummary();
  } catch (err) {
    showToast(err.message, true);
  }
}

function startTimer() {
  timerToggle.textContent = 'Pause';
  timerLabel.textContent = 'Focusing…';
  tickHandle = setInterval(() => {
    remaining -= 1;
    elapsedThisRun += 1;
    renderTimer();
    if (remaining <= 0) {
      clearInterval(tickHandle);
      tickHandle = null;
      logSession(SESSION_LENGTH);
      remaining = SESSION_LENGTH;
      elapsedThisRun = 0;
      timerToggle.textContent = 'Start';
      timerLabel.textContent = 'Focus';
      renderTimer();
    }
  }, 1000);
}

function pauseTimer() {
  clearInterval(tickHandle);
  tickHandle = null;
  timerToggle.textContent = 'Start';
  timerLabel.textContent = 'Paused';
}

timerToggle.addEventListener('click', () => {
  if (tickHandle) {
    pauseTimer();
  } else {
    startTimer();
  }
});

document.getElementById('timer-reset').addEventListener('click', () => {
  if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
  if (elapsedThisRun > 5) logSession(elapsedThisRun); // save partial progress if meaningful
  remaining = SESSION_LENGTH;
  elapsedThisRun = 0;
  timerToggle.textContent = 'Start';
  timerLabel.textContent = 'Focus';
  renderTimer();
});

function renderSubjects() {
  subjectSelect.innerHTML = '<option value="">General study</option>' +
    subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');

  const list = document.getElementById('subjects-list');
  if (subjects.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="glyph">◐</div>Add a subject to organize your sessions.</div>';
    return;
  }
  list.innerHTML = subjects.map(s => `
    <div class="tag" style="margin-right:8px;">
      <span style="width:8px; height:8px; border-radius:50%; background:${s.color || 'var(--amber)'}; display:inline-block;"></span>
      ${escapeHtml(s.name)}
    </div>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function loadSubjects() {
  try {
    const data = await api.get('/study/subjects');
    subjects = data.subjects;
    renderSubjects();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function loadSummary() {
  try {
    const summary = await api.get('/study/sessions/summary');
    document.getElementById('stat-total').textContent = formatDuration(summary.total_seconds);
    document.getElementById('stat-days').textContent = summary.active_days;
  } catch (err) {
    showToast(err.message, true);
  }
}

const palette = ['#f0a868', '#5fb3a3', '#e0806e', '#8b90a0', '#c9c9d1'];
document.getElementById('add-subject-btn').addEventListener('click', async () => {
  const name = prompt('Subject name:');
  if (!name || !name.trim()) return;
  const color = palette[subjects.length % palette.length];
  try {
    const { subject } = await api.post('/study/subjects', { name: name.trim(), color });
    subjects.push(subject);
    renderSubjects();
  } catch (err) {
    showToast(err.message, true);
  }
});

(async function init() {
  const user = await requireSession();
  if (!user) return;
  document.getElementById('user-chip-name').textContent = user.username;
  document.getElementById('user-chip').querySelector('.avatar').textContent = initials(user.username);
  refreshUnreadBadge();
  renderTimer();
  loadSubjects();
  loadSummary();
})();
