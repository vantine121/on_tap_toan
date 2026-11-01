// Application State
const state = {
  student: {
    name: localStorage.getItem('toan6_student_name') || '',
    class: localStorage.getItem('toan6_student_class') || ''
  },
  topics: [],
  currentExam: null,
  currentResult: null,
  timerInterval: null
};

// DOM Elements
const views = {
  topics: document.getElementById('view-topics'),
  mock: document.getElementById('view-mock'),
  exam: document.getElementById('view-exam'),
  result: document.getElementById('view-result'),
  stats: document.getElementById('view-stats')
};

// Navigation
function switchView(viewName) {
  Object.keys(views).forEach(k => {
    if (views[k]) views[k].classList.remove('active');
  });
  if (views[viewName]) {
    views[viewName].classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Update Nav Buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  if (viewName === 'stats') {
    loadStats();
  } else if (viewName === 'topics') {
    loadTopics();
  }
}

// Student Info Management
function initStudentInfo() {
  const nameInput = document.getElementById('student-name-input');
  const classInput = document.getElementById('student-class-input');

  if (nameInput) nameInput.value = state.student.name;
  if (classInput) classInput.value = state.student.class;

  const saveInfo = () => {
    state.student.name = nameInput.value.trim();
    state.student.class = classInput.value.trim();
    localStorage.setItem('toan6_student_name', state.student.name);
    localStorage.setItem('toan6_student_class', state.student.class);
  };

  if (nameInput) nameInput.addEventListener('change', saveInfo);
  if (classInput) classInput.addEventListener('change', saveInfo);
}

function checkStudentName() {
  const nameInput = document.getElementById('student-name-input');
  const name = nameInput ? nameInput.value.trim() : state.student.name;
  if (!name) {
    if (nameInput) {
      nameInput.focus();
      nameInput.style.borderColor = '#ef4444';
      setTimeout(() => { nameInput.style.borderColor = ''; }, 2000);
    }
    alert('👉 Em vui lòng điền Họ và tên trước khi bắt đầu làm bài nhé!');
    return false;
  }
  state.student.name = name;
  localStorage.setItem('toan6_student_name', name);
  return true;
}

// 1. TOPICS & PRACTICE
async function loadTopics() {
  const grid = document.getElementById('topics-grid');
  if (!grid) return;

  grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">Đang tải danh sách chủ đề...</div>';

  try {
    const res = await fetch('/api/topics');
    const data = await res.json();
    state.topics = data.topics || [];
    renderTopics(state.topics);

    const countBadge = document.getElementById('total-topics-count');
    if (countBadge) countBadge.textContent = `${data.summary.totalTopics} chủ đề (${data.summary.totalQuestions} câu hỏi)`;
  } catch (err) {
    console.error('Error loading topics:', err);
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #ef4444;">Không thể tải dữ liệu câu hỏi. Hãy kiểm tra máy chủ.</div>';
  }
}

function renderTopics(topics) {
  const grid = document.getElementById('topics-grid');
  if (!grid) return;

  if (topics.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #64748b;">Không tìm thấy chủ đề phù hợp</div>';
    return;
  }

  grid.innerHTML = topics.map(t => `
    <div class="topic-card">
      <div>
        <div class="topic-header">
          <span class="topic-num-badge">Bài ${t.id}</span>
          <span style="font-size: 0.8rem; color: #64748b;">Toán 6</span>
        </div>
        <h3 class="topic-title">${t.title}</h3>
        <div class="topic-meta">
          <span>📝 <strong>${t.count}</strong> câu trắc nghiệm</span>
          <span>💡 Có lời giải chi tiết</span>
        </div>
      </div>
      <div class="topic-actions">
        <button class="btn btn-primary btn-sm" onclick="openTopicModal(${t.id}, '${escapeHtml(t.title)}', ${t.count})">
          🚀 Luyện tập ngay
        </button>
      </div>
    </div>
  `).join('');
}

// Search Filter
document.getElementById('topic-search-input')?.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  const filtered = state.topics.filter(t => 
    t.title.toLowerCase().includes(query) || (`bài ${t.id}`).includes(query)
  );
  renderTopics(filtered);
});

// Topic Modal
let selectedTopicModal = null;
function openTopicModal(topicId, title, count) {
  if (!checkStudentName()) return;
  selectedTopicModal = { id: topicId, title, count };

  document.getElementById('modal-topic-title').textContent = title;
  document.getElementById('modal-topic-count').textContent = `Ngân hàng có sẵn ${count} câu hỏi`;

  const countSelect = document.getElementById('modal-q-count');
  countSelect.innerHTML = `
    <option value="${Math.min(10, count)}">${Math.min(10, count)} câu hỏi</option>
    ${count >= 15 ? `<option value="${Math.min(15, count)}">${Math.min(15, count)} câu hỏi</option>` : ''}
    <option value="${count}" selected>Tất cả (${count} câu hỏi)</option>
  `;

  document.getElementById('topic-modal').classList.add('active');
}

function closeTopicModal() {
  document.getElementById('topic-modal').classList.remove('active');
  selectedTopicModal = null;
}

async function startTopicExam() {
  if (!selectedTopicModal) return;
  const count = parseInt(document.getElementById('modal-q-count').value);
  closeTopicModal();

  try {
    const res = await fetch(`/api/topic/${selectedTopicModal.id}/questions?limit=${count}`);
    const data = await res.json();
    initExam({
      mode: 'topic',
      topicId: selectedTopicModal.id,
      topicTitle: selectedTopicModal.title,
      questions: data.questions,
      timeLimitMinutes: 0 // No countdown for topic practice
    });
  } catch (err) {
    alert('Có lỗi khi tải đề ôn tập: ' + err.message);
  }
}

// 2. MOCK EXAM (THI THỬ)
async function startMockExam() {
  if (!checkStudentName()) return;

  const count = parseInt(document.getElementById('mock-q-count').value) || 20;
  const timeMinutes = parseInt(document.getElementById('mock-time-select').value) || 45;

  try {
    const res = await fetch(`/api/exam/mock?count=${count}&time_minutes=${timeMinutes}`);
    const data = await res.json();
    initExam({
      mode: 'mock',
      topicId: null,
      topicTitle: data.title,
      questions: data.questions,
      timeLimitMinutes: timeMinutes
    });
  } catch (err) {
    alert('Có lỗi khi tạo đề thi thử: ' + err.message);
  }
}

// 3. EXAM RUNNER
function initExam(config) {
  state.currentExam = {
    mode: config.mode,
    topicId: config.topicId,
    topicTitle: config.topicTitle,
    questions: config.questions,
    timeLimitSeconds: config.timeLimitMinutes * 60,
    timeSpentSeconds: 0,
    answers: {},
    bookmarked: {}
  };

  document.getElementById('exam-title-text').textContent = config.topicTitle;
  document.getElementById('exam-student-badge').textContent = `Học sinh: ${state.student.name} ${state.student.class ? '(' + state.student.class + ')' : ''}`;

  renderExamQuestions();
  renderMatrixSidebar();
  startTimer();
  switchView('exam');
}

function renderExamQuestions() {
  const container = document.getElementById('exam-questions-list');
  if (!container) return;

  const qs = state.currentExam.questions;
  container.innerHTML = qs.map((q, idx) => `
    <div class="question-card" id="q-card-${idx}">
      <div class="q-header">
        <span class="q-badge">Câu ${idx + 1} / ${qs.length}</span>
        <button class="q-bookmark-btn ${state.currentExam.bookmarked[q.id] ? 'bookmarked' : ''}" 
                title="Đánh dấu xem lại" 
                onclick="toggleBookmark('${q.id}', ${idx})">
          ★ Đánh dấu
        </button>
      </div>
      <div class="q-content">${q.content}</div>
      <div class="options-list">
        ${['A', 'B', 'C', 'D'].map(opt => `
          <div class="option-item ${state.currentExam.answers[q.id] === opt ? 'selected' : ''}" 
               onclick="selectAnswer('${q.id}', '${opt}', ${idx})">
            <div class="opt-radio">${opt}</div>
            <div class="opt-text">${q.options[opt] || ''}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function renderMatrixSidebar() {
  const grid = document.getElementById('exam-matrix-grid');
  if (!grid) return;

  const qs = state.currentExam.questions;
  grid.innerHTML = qs.map((q, idx) => {
    const isAnswered = !!state.currentExam.answers[q.id];
    const isBookmarked = !!state.currentExam.bookmarked[q.id];
    return `
      <button class="matrix-btn ${isAnswered ? 'answered' : ''} ${isBookmarked ? 'bookmarked' : ''}" 
              onclick="scrollToQuestion(${idx})">
        ${idx + 1}
      </button>
    `;
  }).join('');

  // Update Progress Count
  const answeredCount = Object.keys(state.currentExam.answers).length;
  document.getElementById('answered-progress-text').textContent = `Đã làm: ${answeredCount}/${qs.length} câu`;
}

function selectAnswer(qId, opt, idx) {
  state.currentExam.answers[qId] = opt;

  // Update UI for this question card
  const card = document.getElementById(`q-card-${idx}`);
  if (card) {
    const optItems = card.querySelectorAll('.option-item');
    ['A', 'B', 'C', 'D'].forEach((letter, i) => {
      if (optItems[i]) {
        optItems[i].classList.toggle('selected', letter === opt);
      }
    });
  }

  // Update Matrix
  renderMatrixSidebar();
}

function toggleBookmark(qId, idx) {
  state.currentExam.bookmarked[qId] = !state.currentExam.bookmarked[qId];
  const card = document.getElementById(`q-card-${idx}`);
  if (card) {
    const btn = card.querySelector('.q-bookmark-btn');
    if (btn) btn.classList.toggle('bookmarked', state.currentExam.bookmarked[qId]);
  }
  renderMatrixSidebar();
}

function scrollToQuestion(idx) {
  const card = document.getElementById(`q-card-${idx}`);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('active-target');
    setTimeout(() => { card.classList.remove('active-target'); }, 1200);
  }
}

// Timer
function startTimer() {
  clearInterval(state.timerInterval);
  const timerDisplay = document.getElementById('timer-display');
  const timerBox = document.getElementById('timer-box');

  const isCountdown = state.currentExam.timeLimitSeconds > 0;
  let remaining = state.currentExam.timeLimitSeconds;

  const update = () => {
    state.currentExam.timeSpentSeconds++;

    if (isCountdown) {
      remaining--;
      if (remaining <= 0) {
        clearInterval(state.timerInterval);
        alert('⏰ Đã hết thời gian làm bài! Hệ thống sẽ tự động nộp bài.');
        submitExam(true);
        return;
      }

      if (remaining <= 300) { // under 5 mins
        timerBox?.classList.add('timer-urgent');
      }

      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      if (timerDisplay) timerDisplay.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    } else {
      // Count-up
      const m = Math.floor(state.currentExam.timeSpentSeconds / 60);
      const s = state.currentExam.timeSpentSeconds % 60;
      if (timerDisplay) timerDisplay.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
  };

  update();
  state.timerInterval = setInterval(update, 1000);
}

// 4. SUBMIT EXAM
function confirmSubmit() {
  const total = state.currentExam.questions.length;
  const answered = Object.keys(state.currentExam.answers).length;
  const remaining = total - answered;

  let msg = `Em đã hoàn thành ${answered}/${total} câu hỏi.`;
  if (remaining > 0) {
    msg += `\n⚠️ Còn ${remaining} câu em chưa chọn đáp án!`;
  }
  msg += `\nEm có chắc chắn muốn nộp bài ngay bây giờ không?`;

  if (confirm(msg)) {
    submitExam();
  }
}

async function submitExam(force = false) {
  clearInterval(state.timerInterval);

  const payload = {
    student_name: state.student.name,
    student_class: state.student.class,
    mode: state.currentExam.mode,
    topic_id: state.currentExam.topicId,
    topic_title: state.currentExam.topicTitle,
    time_spent: state.currentExam.timeSpentSeconds,
    answers: state.currentExam.answers,
    question_ids: state.currentExam.questions.map(q => q.id)
  };

  try {
    const res = await fetch('/api/exam/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Lỗi nộp bài');
    }

    const result = await res.json();
    state.currentResult = result;
    renderResultScreen(result);
    switchView('result');
  } catch (err) {
    alert('Không thể nộp bài: ' + err.message);
  }
}

// 5. RESULT SCREEN
function renderResultScreen(res) {
  document.getElementById('res-score-num').textContent = res.score;
  document.getElementById('res-student-name').textContent = res.student_name + (res.student_class ? ` (${res.student_class})` : '');
  document.getElementById('res-exam-title').textContent = res.topic_title || state.currentExam.topicTitle;
  document.getElementById('res-evaluation-text').textContent = res.evaluation;

  document.getElementById('res-stat-correct').textContent = `${res.correct_count} / ${res.total_questions}`;
  document.getElementById('res-stat-accuracy').textContent = `${Math.round((res.correct_count / res.total_questions) * 100)}%`;

  const mins = Math.floor(res.time_spent / 60);
  const secs = res.time_spent % 60;
  document.getElementById('res-stat-time').textContent = `${mins}p ${secs}s`;

  // Render Detailed Review
  const reviewContainer = document.getElementById('result-review-list');
  reviewContainer.innerHTML = res.details.map((q, idx) => `
    <div class="question-card" style="border-left: 6px solid ${q.is_correct ? '#10b981' : '#ef4444'};">
      <div class="q-header">
        <span class="q-badge" style="background: ${q.is_correct ? '#dcfce7' : '#fee2e2'}; color: ${q.is_correct ? '#15803d' : '#b91c1c'};">
          ${q.is_correct ? '✓ Đúng' : '✗ Sai'} - Câu ${idx + 1}
        </span>
        <span style="font-size: 0.85rem; font-weight: 600; color: ${q.is_correct ? '#10b981' : '#ef4444'};">
          Em chọn: ${q.student_answer || 'Chưa trả lời'} | Đáp án đúng: ${q.correct_answer}
        </span>
      </div>
      <div class="q-content">${q.content}</div>
      <div class="options-list">
        ${['A', 'B', 'C', 'D'].map(opt => {
          let optClass = '';
          if (opt === q.correct_answer) optClass = 'opt-correct';
          else if (opt === q.student_answer && !q.is_correct) optClass = 'opt-wrong';

          return `
            <div class="option-item ${optClass}">
              <div class="opt-radio">${opt}</div>
              <div class="opt-text">${q.options[opt] || ''}</div>
              ${opt === q.correct_answer ? '<span style="color:#10b981; font-weight:700; margin-left:auto;">✓ Đáp án đúng</span>' : ''}
              ${opt === q.student_answer && !q.is_correct ? '<span style="color:#ef4444; font-weight:700; margin-left:auto;">✗ Lựa chọn của em</span>' : ''}
            </div>
          `;
        }).join('')}
      </div>

      ${q.explanation ? `
        <div class="explanation-box">
          <div class="explanation-title">💡 Hướng dẫn giải chi tiết:</div>
          <div class="explanation-content">${q.explanation}</div>
        </div>
      ` : ''}
    </div>
  `).join('');
}

// 6. STATISTICS & TEACHER DASHBOARD
async function loadStats() {
  const tbody = document.getElementById('stats-table-body');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Đang tải dữ liệu thống kê...</td></tr>';

  try {
    const res = await fetch('/api/stats');
    const data = await res.json();

    document.getElementById('stat-total-submissions').textContent = data.total_submissions || 0;
    document.getElementById('stat-avg-score').textContent = data.average_score || 0;
    document.getElementById('stat-highest-score').textContent = data.highest_score || 0;

    renderSubmissionsTable(data.recent || []);
  } catch (err) {
    console.error('Error loading stats:', err);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #ef4444;">Không thể tải thống kê.</td></tr>';
  }
}

function renderSubmissionsTable(subs) {
  const tbody = document.getElementById('stats-table-body');
  if (!tbody) return;

  if (subs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">Chưa có lượt học sinh nào làm bài.</td></tr>';
    return;
  }

  tbody.innerHTML = subs.map((s, idx) => {
    let badgeClass = 'badge-score-low';
    if (s.score >= 8.0) badgeClass = 'badge-score-high';
    else if (s.score >= 6.5) badgeClass = 'badge-score-med';

    const mins = Math.floor(s.time_spent / 60);
    const secs = s.time_spent % 60;

    return `
      <tr>
        <td>#${s.id}</td>
        <td><strong>${escapeHtml(s.student_name)}</strong></td>
        <td>${escapeHtml(s.student_class || '-')}</td>
        <td>${escapeHtml(s.topic_title || '-')}</td>
        <td><span class="badge-score ${badgeClass}">${s.score} / 10</span></td>
        <td>${s.correct_count}/${s.total_questions} (${mins}p ${secs}s)</td>
        <td style="font-size: 0.85rem; color: #64748b;">${s.created_at}</td>
      </tr>
    `;
  }).join('');
}

// Search Submissions
document.getElementById('stats-search-input')?.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  const rows = document.querySelectorAll('#stats-table-body tr');
  rows.forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
  });
});

// Helper
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

// Initial Boot
document.addEventListener('DOMContentLoaded', () => {
  initStudentInfo();
  loadTopics();
});
