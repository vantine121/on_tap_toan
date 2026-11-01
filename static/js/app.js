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

// Student Info Management (Đồng bộ giữa Topbar và Form Đề Thi)
function initStudentInfo() {
  const topName = document.getElementById('student-name-input');
  const topClass = document.getElementById('student-class-input');
  const mockName = document.getElementById('mock-student-name');
  const mockClass = document.getElementById('mock-student-class');

  if (topName) topName.value = state.student.name;
  if (topClass) topClass.value = state.student.class;
  if (mockName) mockName.value = state.student.name;
  if (mockClass) mockClass.value = state.student.class;

  const sync = (name, cls) => {
    state.student.name = name.trim();
    state.student.class = cls.trim();
    localStorage.setItem('toan6_student_name', state.student.name);
    localStorage.setItem('toan6_student_class', state.student.class);

    if (topName && topName.value !== state.student.name) topName.value = state.student.name;
    if (mockName && mockName.value !== state.student.name) mockName.value = state.student.name;
    if (topClass && topClass.value !== state.student.class) topClass.value = state.student.class;
    if (mockClass && mockClass.value !== state.student.class) mockClass.value = state.student.class;
  };

  topName?.addEventListener('input', () => sync(topName.value, topClass?.value || ''));
  topClass?.addEventListener('input', () => sync(topName?.value || '', topClass.value));
  mockName?.addEventListener('input', () => sync(mockName.value, mockClass?.value || ''));
  mockClass?.addEventListener('input', () => sync(mockName?.value || '', mockClass.value));

  // Cấu hình chọn số lượng câu hỏi trong Đề Tổng Hợp
  initMockPresets();
}

function initMockPresets() {
  const presetContainer = document.getElementById('q-count-presets');
  const customInput = document.getElementById('mock-custom-q-count');
  const timeSelect = document.getElementById('mock-time-select');

  if (!presetContainer) return;

  const presetBtns = presetContainer.querySelectorAll('.preset-btn');
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (customInput) customInput.value = '';

      // Tự động gợi ý thời gian phù hợp theo số câu
      const count = parseInt(btn.dataset.count) || 20;
      if (timeSelect) {
        if (count <= 10) timeSelect.value = '15';
        else if (count <= 15) timeSelect.value = '30';
        else if (count <= 25) timeSelect.value = '45';
        else if (count <= 35) timeSelect.value = '60';
        else timeSelect.value = '90';
      }
    });
  });

  customInput?.addEventListener('input', () => {
    if (customInput.value) {
      presetBtns.forEach(b => b.classList.remove('active'));
    }
  });
}

function getEffectiveStudentInfo() {
  const topName = document.getElementById('student-name-input')?.value?.trim();
  const mockName = document.getElementById('mock-student-name')?.value?.trim();
  const topClass = document.getElementById('student-class-input')?.value?.trim();
  const mockClass = document.getElementById('mock-student-class')?.value?.trim();

  const name = mockName || topName || state.student.name || 'Học sinh ôn tập';
  const cls = mockClass || topClass || state.student.class || '';

  state.student.name = name;
  state.student.class = cls;
  localStorage.setItem('toan6_student_name', name);
  localStorage.setItem('toan6_student_class', cls);

  return { name, cls };
}

// 1. TOPICS & PRACTICE
async function loadTopics() {
  const grid = document.getElementById('topics-grid');
  if (!grid) return;

  grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #475569;">Đang tải danh mục bài học...</div>';

  try {
    const res = await fetch('/api/topics');
    const data = await res.json();
    state.topics = data.topics || [];
    renderTopics(state.topics);

    const countBadge = document.getElementById('total-topics-count');
    if (countBadge) countBadge.textContent = `${data.summary.totalTopics} bài học (${data.summary.totalQuestions} câu hỏi trắc nghiệm)`;
  } catch (err) {
    console.error('Error loading topics:', err);
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #dc2626;">Không thể tải dữ liệu câu hỏi. Hãy kiểm tra kết nối mạng.</div>';
  }
}

function renderTopics(topics) {
  const grid = document.getElementById('topics-grid');
  if (!grid) return;

  if (topics.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #64748b;">Không tìm thấy bài học phù hợp</div>';
    return;
  }

  grid.innerHTML = topics.map(t => `
    <div class="topic-card">
      <div>
        <div class="topic-header">
          <span class="topic-num-badge">Bài ${t.id}</span>
          <span style="font-size: 0.82rem; font-weight: 600; color: #64748b;">Toán 6</span>
        </div>
        <h3 class="topic-title">${t.title}</h3>
        <div class="topic-meta">
          <span>Ngân hàng: <strong>${t.count}</strong> câu hỏi</span>
          <span>Có lời giải chi tiết</span>
        </div>
      </div>
      <div class="topic-actions">
        <button class="btn btn-primary btn-sm" onclick="openTopicModal(${t.id}, '${escapeHtml(t.title)}', ${t.count})">
          Vào Ôn Tập
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

// Topic Modal (Ôn theo từng bài học)
let selectedTopicModal = null;
let selectedTopicCount = 10;

function openTopicModal(topicId, title, count) {
  getEffectiveStudentInfo();
  selectedTopicModal = { id: topicId, title, count };

  document.getElementById('modal-topic-title').textContent = title;
  document.getElementById('modal-topic-count').textContent = `Ngân hàng câu hỏi của bài này gồm: ${count} câu hỏi`;

  const presetContainer = document.getElementById('topic-q-count-presets');
  const customInput = document.getElementById('topic-custom-q-count');
  if (customInput) customInput.value = '';

  // Tạo các nút tùy chọn số câu linh hoạt
  const counts = [];
  if (count >= 5) counts.push(5);
  if (count >= 10) counts.push(10);
  if (count >= 15) counts.push(15);
  if (count >= 20) counts.push(20);
  if (!counts.includes(count)) counts.push(count);

  selectedTopicCount = counts[0] || count;

  if (presetContainer) {
    presetContainer.innerHTML = counts.map((c, idx) => `
      <button type="button" class="preset-btn ${idx === 0 ? 'active' : ''}" data-topic-count="${c}">
        ${c === count ? `Tất cả (${c} câu)` : `${c} câu`}
      </button>
    `).join('');

    const btns = presetContainer.querySelectorAll('.preset-btn');
    btns.forEach(b => {
      b.addEventListener('click', () => {
        btns.forEach(btn => btn.classList.remove('active'));
        b.classList.add('active');
        selectedTopicCount = parseInt(b.dataset.topicCount);
        if (customInput) customInput.value = '';
      });
    });
  }

  customInput?.addEventListener('input', () => {
    if (customInput.value) {
      presetContainer?.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      selectedTopicCount = Math.min(Math.max(parseInt(customInput.value) || 1, 1), count);
    }
  });

  document.getElementById('topic-modal').classList.add('active');
}

function closeTopicModal() {
  document.getElementById('topic-modal').classList.remove('active');
  selectedTopicModal = null;
}

async function startTopicExam() {
  if (!selectedTopicModal) return;
  const customInput = document.getElementById('topic-custom-q-count');
  let count = selectedTopicCount;
  if (customInput && customInput.value) {
    count = Math.min(Math.max(parseInt(customInput.value) || 1, 1), selectedTopicModal.count);
  }

  const topicId = selectedTopicModal.id;
  const topicTitle = selectedTopicModal.title;
  closeTopicModal();

  try {
    const res = await fetch(`/api/topic/${topicId}/questions?limit=${count}`);
    const data = await res.json();
    initExam({
      mode: 'topic',
      topicId: topicId,
      topicTitle: topicTitle,
      questions: data.questions,
      timeLimitMinutes: 0 // Ôn luyện theo bài: không đếm ngược
    });
  } catch (err) {
    alert('Có lỗi khi tải bài ôn tập: ' + err.message);
  }
}

// 2. MOCK EXAM (ĐỀ KIỂM TRA TỔNG HỢP)
async function startMockExam() {
  // Lấy thông tin học sinh
  const student = getEffectiveStudentInfo();

  // Xác định số lượng câu hỏi học sinh muốn thi
  let count = 20;
  const customInput = document.getElementById('mock-custom-q-count');
  if (customInput && customInput.value) {
    count = Math.min(Math.max(parseInt(customInput.value) || 1, 1), 100);
  } else {
    const activePreset = document.querySelector('#q-count-presets .preset-btn.active');
    if (activePreset) {
      count = parseInt(activePreset.dataset.count) || 20;
    }
  }

  // Xác định thời gian làm bài
  const timeMinutes = parseInt(document.getElementById('mock-time-select')?.value) || 0;

  try {
    const res = await fetch(`/api/exam/mock?count=${count}&time_minutes=${timeMinutes}`);
    if (!res.ok) {
      throw new Error(`Máy chủ phản hồi lỗi (${res.status})`);
    }
    const data = await res.json();

    if (!data.questions || data.questions.length === 0) {
      alert('Chưa có câu hỏi nào trong đề thi. Vui lòng thử lại!');
      return;
    }

    initExam({
      mode: 'mock',
      topicId: null,
      topicTitle: data.title || `Đề kiểm tra tổng hợp Toán 6 (${count} câu)`,
      questions: data.questions,
      timeLimitMinutes: timeMinutes
    });
  } catch (err) {
    console.error('Error starting mock exam:', err);
    alert('Không thể tạo đề kiểm tra: ' + err.message);
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

  const student = getEffectiveStudentInfo();
  document.getElementById('exam-title-text').textContent = config.topicTitle;
  document.getElementById('exam-student-badge').textContent = `Học sinh: ${student.name} ${student.cls ? '(' + student.cls + ')' : ''}`;

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
                title="Đánh dấu để xem lại sau" 
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

  const card = document.getElementById(`q-card-${idx}`);
  if (card) {
    const optItems = card.querySelectorAll('.option-item');
    ['A', 'B', 'C', 'D'].forEach((letter, i) => {
      if (optItems[i]) {
        optItems[i].classList.toggle('selected', letter === opt);
      }
    });
  }

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
        alert('Đã hết thời gian làm bài! Hệ thống tự động nộp bài.');
        submitExam(true);
        return;
      }

      if (remaining <= 300) {
        timerBox?.classList.add('timer-urgent');
      }

      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      if (timerDisplay) timerDisplay.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    } else {
      // Đếm thời gian làm bài bình thường
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
    msg += `\nCòn ${remaining} câu em chưa chọn đáp án!`;
  }
  msg += `\nEm có chắc chắn muốn nộp bài ngay bây giờ không?`;

  if (confirm(msg)) {
    submitExam();
  }
}

async function submitExam(force = false) {
  clearInterval(state.timerInterval);

  const student = getEffectiveStudentInfo();

  const payload = {
    student_name: student.name,
    student_class: student.cls,
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
      throw new Error(err.detail || 'Lỗi khi nộp bài');
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
  document.getElementById('res-student-name').textContent = 'Học sinh: ' + res.student_name + (res.student_class ? ` (${res.student_class})` : '');
  document.getElementById('res-exam-title').textContent = res.topic_title || state.currentExam.topicTitle;
  document.getElementById('res-evaluation-text').textContent = res.evaluation;

  document.getElementById('res-stat-correct').textContent = `${res.correct_count} / ${res.total_questions}`;
  document.getElementById('res-stat-accuracy').textContent = `${Math.round((res.correct_count / res.total_questions) * 100)}%`;

  const mins = Math.floor(res.time_spent / 60);
  const secs = res.time_spent % 60;
  document.getElementById('res-stat-time').textContent = `${mins} phút ${secs} giây`;

  // Render Detailed Review
  const reviewContainer = document.getElementById('result-review-list');
  reviewContainer.innerHTML = res.details.map((q, idx) => `
    <div class="question-card" style="border-left: 5px solid ${q.is_correct ? '#059669' : '#dc2626'};">
      <div class="q-header">
        <span class="q-badge" style="background: ${q.is_correct ? '#dcfce7' : '#fee2e2'}; color: ${q.is_correct ? '#166534' : '#991b1b'};">
          ${q.is_correct ? '✓ Trả lời đúng' : '✗ Trả lời sai'} - Câu ${idx + 1}
        </span>
        <span style="font-size: 0.9rem; font-weight: 600; color: ${q.is_correct ? '#059669' : '#dc2626'};">
          Đáp án em chọn: <strong>${q.student_answer || 'Chưa trả lời'}</strong> | Đáp án đúng: <strong>${q.correct_answer}</strong>
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
              ${opt === q.correct_answer ? '<span style="color:#059669; font-weight:700; margin-left:auto;">✓ Đáp án chính xác</span>' : ''}
              ${opt === q.student_answer && !q.is_correct ? '<span style="color:#dc2626; font-weight:700; margin-left:auto;">✗ Lựa chọn của em</span>' : ''}
            </div>
          `;
        }).join('')}
      </div>
      ${q.explanation ? `
        <div class="q-explanation">
          <div class="exp-title">Hướng dẫn giải chi tiết:</div>
          <div class="exp-body">${q.explanation}</div>
        </div>
      ` : ''}
    </div>
  `).join('');
}

// 6. STATS & TEACHER DASHBOARD
async function loadStats() {
  const tbody = document.getElementById('submissions-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem;">Đang tải dữ liệu...</td></tr>';

  try {
    const [statsRes, subsRes] = await Promise.all([
      fetch('/api/stats'),
      fetch('/api/stats/submissions?limit=100')
    ]);

    const stats = await statsRes.json();
    const subs = await subsRes.json();

    document.getElementById('stat-total-submissions').textContent = stats.total_submissions || 0;
    document.getElementById('stat-average-score').textContent = (stats.average_score || 0.0).toFixed(1);
    document.getElementById('stat-highest-score').textContent = (stats.highest_score || 0.0).toFixed(1);

    renderSubmissionsTable(subs);
  } catch (err) {
    console.error('Error loading stats:', err);
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: #dc2626; padding: 2rem;">Lỗi tải dữ liệu thống kê.</td></tr>';
  }
}

function renderSubmissionsTable(subs) {
  const tbody = document.getElementById('submissions-tbody');
  if (!tbody) return;

  if (subs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem; color: #64748b;">Chưa có lượt nộp bài nào</td></tr>';
    return;
  }

  tbody.innerHTML = subs.map(s => `
    <tr>
      <td><strong>${escapeHtml(s.student_name)}</strong></td>
      <td>${escapeHtml(s.student_class || '-')}</td>
      <td><span class="badge ${s.mode === 'topic' ? 'badge-topic' : 'badge-mock'}">${s.mode === 'topic' ? 'Theo bài' : 'Tổng hợp'}</span></td>
      <td>${escapeHtml(s.topic_title || '-')}</td>
      <td><span class="score-pill ${getScoreClass(s.score)}">${s.score}</span></td>
      <td>${s.correct_count} / ${s.total_questions}</td>
      <td>${Math.floor(s.time_spent / 60)}p ${s.time_spent % 60}s</td>
      <td style="color: #64748b; font-size: 0.85rem;">${s.created_at}</td>
    </tr>
  `).join('');
}

function getScoreClass(score) {
  if (score >= 8.5) return 'score-high';
  if (score >= 6.5) return 'score-med';
  if (score >= 5.0) return 'score-pass';
  return 'score-low';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

// Initial Boot
document.addEventListener('DOMContentLoaded', () => {
  initStudentInfo();
  loadTopics();
});
