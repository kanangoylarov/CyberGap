/* ═══════════════════════════════════════════════════════════
   GRC Intelligence — Frontend Application
   ═══════════════════════════════════════════════════════════ */

const RISK_C  = { 'Low Risk':'#276749', 'Medium Risk':'#C05621', 'High Risk':'#9B2335' };
const RISK_BG = { 'Low Risk':'#F0FFF4', 'Medium Risk':'#FFFAF0', 'High Risk':'#FDEDED' };
const CAT_COLORS = {
  'Access Control': '#553C9A',
  'Information Security Policies': '#2B6CB0',
  'Network Security': '#285E61',
  'Incident Management': '#C05621',
  'Business Continuity': '#276749',
  'Cryptography': '#97266D',
  'Physical Security': '#4A5568',
  'HR Security': '#744210',
  'Asset Management': '#2D3748',
  'Risk Assessment': '#9B2335',
  'Data Protection': '#553C9A',
  'Monitoring & Detection': '#C05621',
  'Recovery Planning': '#276749'
};

let state = {
  token: localStorage.getItem('grc_token'),
  user: JSON.parse(localStorage.getItem('grc_user') || 'null'),
  questions: [],
  currentCategory: 0,
  answers: {},
  submitting: false
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const esc = s => {
  const div = document.createElement('div');
  div.textContent = String(s || '');
  return div.innerHTML;
};
const el  = id => document.getElementById(id);
const fmt = d  => new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
const sc  = s  => s >= 71 ? '#276749' : s >= 41 ? '#C05621' : '#9B2335';

function svgI(d, sz, col) {
  sz = sz || 16;
  col = col || 'currentColor';
  return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 24 24" fill="none" stroke="'+col+'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="'+d+'"/></svg>';
}

async function api(url, opts) {
  opts = opts || {};
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  const r = await fetch(url, { headers: headers, ...opts });
  const data = await r.json();
  if (r.status === 401 || r.status === 403) {
    handleLogout();
    throw new Error('Session expired');
  }
  return data;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function showLogin() {
  el('login-form').style.display = 'block';
  el('register-form').style.display = 'none';
}

function showRegister() {
  el('login-form').style.display = 'none';
  el('register-form').style.display = 'block';
}

async function handleLogin() {
  var email = el('login-email').value.trim();
  var password = el('login-password').value;
  var errEl = el('login-error');

  if (!email || !password) {
    errEl.textContent = 'Please fill in all fields';
    errEl.style.display = 'block';
    return;
  }

  el('login-btn').disabled = true;
  el('login-btn').textContent = 'Signing in...';

  try {
    var res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email, password: password })
    });

    if (res.success) {
      state.token = res.data.token;
      state.user = res.data.user;
      localStorage.setItem('grc_token', state.token);
      localStorage.setItem('grc_user', JSON.stringify(state.user));
      showApp();
    } else {
      errEl.textContent = res.error || 'Login failed';
      errEl.style.display = 'block';
    }
  } catch (e) {
    errEl.textContent = 'Connection error. Is the server running?';
    errEl.style.display = 'block';
  }

  el('login-btn').disabled = false;
  el('login-btn').textContent = 'Sign In';
}

async function handleRegister() {
  var firstName = el('reg-fname').value.trim();
  var lastName = el('reg-lname').value.trim();
  var email = el('reg-email').value.trim();
  var company = el('reg-company').value.trim();
  var password = el('reg-password').value;
  var errEl = el('register-error');

  if (!firstName || !lastName || !email || !company || !password) {
    errEl.textContent = 'Please fill in all fields';
    errEl.style.display = 'block';
    return;
  }

  if (password.length < 6) {
    errEl.textContent = 'Password must be at least 6 characters';
    errEl.style.display = 'block';
    return;
  }

  el('register-btn').disabled = true;
  el('register-btn').textContent = 'Creating account...';

  try {
    var res = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        firstName: firstName, lastName: lastName,
        email: email, company: company, password: password
      })
    });

    if (res.success) {
      state.token = res.data.token;
      state.user = res.data.user;
      localStorage.setItem('grc_token', state.token);
      localStorage.setItem('grc_user', JSON.stringify(state.user));
      showApp();
    } else {
      errEl.textContent = res.error || 'Registration failed';
      errEl.style.display = 'block';
    }
  } catch (e) {
    errEl.textContent = 'Connection error. Is the server running?';
    errEl.style.display = 'block';
  }

  el('register-btn').disabled = false;
  el('register-btn').textContent = 'Create Account';
}

function handleLogout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('grc_token');
  localStorage.removeItem('grc_user');
  el('app').style.display = 'none';
  el('auth-container').style.display = 'flex';
}

function showApp() {
  el('auth-container').style.display = 'none';
  el('app').style.display = 'flex';
  el('user-name').textContent = state.user.firstName + ' ' + state.user.lastName;
  el('user-company').textContent = state.user.company;
  loadDashboard();
}

// ─── ROUTING ─────────────────────────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  el('page-' + name).classList.add('active');
  var nav = document.querySelector('[data-page="' + name + '"]');
  if (nav) nav.classList.add('active');

  var loaders = {
    'dashboard': loadDashboard,
    'assessment': loadAssessment,
    'report': loadReport
  };
  if (loaders[name]) loaders[name]();
}

document.querySelectorAll('.nav-item').forEach(function(n) {
  n.addEventListener('click', function(e) {
    e.preventDefault();
    showPage(n.dataset.page);
  });
});

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
async function loadDashboard() {
  var pg = el('page-dashboard');
  pg.innerHTML = '<div class="loading-overlay"><div class="spinner"></div><p class="text-muted">Loading...</p></div>';

  try {
    var stats = await api('/api/reports/stats');
    var d = stats.data;

    pg.innerHTML =
      '<div class="page-header flex-between">' +
        '<div><h1>Dashboard</h1><p>Welcome back, ' + esc(state.user.firstName) + '. Here is your GRC overview.</p></div>' +
        '<button class="btn btn-primary btn-lg" onclick="showPage(\'assessment\')">' + svgI('M12 4v16m8-8H4', 16, '#fff') + ' New Assessment</button>' +
      '</div>' +

      '<div class="stats-grid">' +
        '<div class="stat-card"><div class="stat-label">Controls Assessed</div><div class="stat-value">' + (d.totalResponses || 0) + '</div><div class="stat-sub">total questions answered</div></div>' +
        '<div class="stat-card"><div class="stat-label">Overall Score</div><div class="stat-value" style="color:' + sc(d.overallScore || 0) + '">' + (d.overallScore || 0) + '%</div><div class="stat-sub">compliance rate</div></div>' +
        '<div class="stat-card"><div class="stat-label">Gaps Found</div><div class="stat-value" style="color:#9B2335">' + (d.totalGaps || 0) + '</div><div class="stat-sub">vulnerabilities identified</div></div>' +
        '<div class="stat-card"><div class="stat-label">Risk Level</div><div class="stat-value" style="color:' + (RISK_C[d.riskLevel] || '#333') + '">' + esc(d.riskLevel || 'N/A') + '</div><div class="stat-sub">current posture</div></div>' +
      '</div>' +

      '<div class="grid-2">' +
        '<div class="card">' +
          '<div class="card-title">Compliance Overview</div>' +
          (d.totalResponses > 0
            ? '<div class="chart-wrap-sm"><canvas id="dash-chart"></canvas></div>'
            : '<div class="empty-state"><h3>No data yet</h3><p>Run your first assessment to see compliance metrics.</p></div>') +
        '</div>' +
        '<div class="card">' +
          '<div class="card-title">Quick Actions</div>' +
          '<div style="display:flex;flex-direction:column;gap:10px;padding:10px 0">' +
            '<button class="btn btn-primary" onclick="showPage(\'assessment\')">' + svgI('M12 4v16m8-8H4', 14, '#fff') + ' Start New Assessment</button>' +
            (d.totalResponses > 0 ? '<button class="btn btn-accent" onclick="showPage(\'report\')">' + svgI('M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', 14, '#fff') + ' View Full Report</button>' : '') +
          '</div>' +
          '<div style="margin-top:16px;padding:14px;background:#EBF4FF;border-radius:10px;border:1px solid #BEE3F8">' +
            '<div style="font-size:12px;font-weight:600;color:#2B6CB0;margin-bottom:4px">How it works</div>' +
            '<div style="font-size:12px;color:#2C5282;line-height:1.7">' +
              '1. Answer GRC assessment questions (ISO 27001 & NIST)<br>' +
              '2. System analyzes each gap with attack scenarios<br>' +
              '3. Get detailed vulnerability report with remediation plans' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    if (d.totalResponses > 0) {
      setTimeout(function() {
        var ctx = el('dash-chart');
        if (!ctx || typeof Chart === 'undefined') return;
        new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['Controls Met', 'Gaps Found'],
            datasets: [{
              data: [d.totalStrengths || 0, d.totalGaps || 0],
              backgroundColor: ['#276749', '#9B2335'],
              borderWidth: 0
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false, cutout: '68%',
            plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: function(c) { return ' ' + c.label + ': ' + c.raw; } } } }
          }
        });
      }, 100);
    }
  } catch (e) {
    pg.innerHTML = '<div class="empty-state"><h3>Could not load dashboard</h3><p>' + esc(e.message) + '</p></div>';
  }
}

// ─── ASSESSMENT ──────────────────────────────────────────────────────────────
async function loadAssessment() {
  var pg = el('page-assessment');
  pg.innerHTML = '<div class="loading-overlay"><div class="spinner"></div><p class="text-muted">Loading questions...</p></div>';

  try {
    var res = await api('/api/questions');
    var grouped = res.data;

    // Build categories array from grouped data
    var categories = [];
    for (var std in grouped) {
      for (var cat in grouped[std]) {
        categories.push({
          standard: std,
          category: cat,
          questions: grouped[std][cat]
        });
      }
    }

    state.questions = categories;
    state.currentCategory = 0;
    state.answers = {};

    renderAssessmentIntro();
  } catch (e) {
    pg.innerHTML = '<div class="empty-state"><h3>Error loading questions</h3><p>' + esc(e.message) + '</p></div>';
  }
}

function renderAssessmentIntro() {
  var totalQ = state.questions.reduce(function(a, c) { return a + c.questions.length; }, 0);
  var pg = el('page-assessment');

  var catCards = state.questions.map(function(c) {
    var color = CAT_COLORS[c.category] || '#4A5568';
    return '<div class="card card-sm" style="display:flex;gap:10px;align-items:center">' +
      '<div style="width:36px;height:36px;border-radius:9px;background:' + color + '15;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
        '<div style="width:10px;height:10px;border-radius:50%;background:' + color + '"></div>' +
      '</div>' +
      '<div><div style="font-size:12px;font-weight:500">' + esc(c.category) + '</div>' +
      '<div class="text-muted">' + c.questions.length + ' questions &middot; ' + esc(c.standard) + '</div></div>' +
    '</div>';
  }).join('');

  pg.innerHTML =
    '<div class="page-header"><h1>New Assessment</h1><p>Complete the GRC diagnostic across ' + state.questions.length + ' categories to receive your deep analysis</p></div>' +

    '<div class="card" style="max-width:720px;margin-bottom:20px;background:#EBF4FF;border-color:#BEE3F8">' +
      '<div style="display:flex;gap:12px;align-items:flex-start">' +
        svgI('M13 10V3L4 14h7v7l9-11h-7z', 20, '#2B6CB0') +
        '<div>' +
          '<div style="font-size:13px;font-weight:600;color:#2B6CB0;margin-bottom:4px">What you get from this assessment</div>' +
          '<div style="font-size:13px;color:#2C5282;line-height:1.75">' + totalQ + ' questions across ISO 27001 & NIST standards. The system will analyze every gap and produce: <strong>detailed attack scenarios</strong>, <strong>vulnerability analysis</strong>, <strong>real-world breach examples</strong>, <strong>step-by-step remediation guides</strong>, and <strong>compliance gap reports</strong>.</div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;max-width:720px;margin-bottom:24px">' + catCards + '</div>' +

    '<button class="btn btn-primary btn-lg" onclick="startAssessment()">' + svgI('M13 10V3L4 14h7v7l9-11h-7z', 18, '#fff') + ' Begin Assessment (' + totalQ + ' questions)</button>';
}

function startAssessment() {
  state.currentCategory = 0;
  state.answers = {};
  renderQuiz();
}

function renderQuiz() {
  var cats = state.questions;
  var cat = cats[state.currentCategory];
  var color = CAT_COLORS[cat.category] || '#4A5568';

  var totalQ = cats.reduce(function(a, c) { return a + c.questions.length; }, 0);
  var answeredCount = Object.keys(state.answers).length;
  var pct = Math.round((answeredCount / totalQ) * 100);

  var done = cat.questions.filter(function(q) { return state.answers[q.id] !== undefined; }).length;

  var tabs = cats.map(function(c, i) {
    var allDone = c.questions.every(function(q) { return state.answers[q.id] !== undefined; });
    var cls = 'cat-tab';
    if (i === state.currentCategory) cls += ' active';
    else if (allDone) cls += ' done';
    return '<button class="' + cls + '" onclick="jumpCategory(' + i + ')">' + (allDone ? '&#10003; ' : '') + esc(c.category) + '</button>';
  }).join('');

  var questions = cat.questions.map(function(q) {
    var yesOn = state.answers[q.id] === true ? ' on' : '';
    var noOn = state.answers[q.id] === false ? ' on' : '';
    return '<div class="question-row">' +
      '<div class="q-left"><span class="q-id">' + esc(q.clauseNumber) + '</span><span class="q-text">' + esc(q.text) + '</span></div>' +
      '<div class="q-btns">' +
        '<button class="yn-btn yes' + yesOn + '" onclick="setAnswer(' + q.id + ',true)">Yes</button>' +
        '<button class="yn-btn no' + noOn + '" onclick="setAnswer(' + q.id + ',false)">No</button>' +
      '</div>' +
    '</div>';
  }).join('');

  var pg = el('page-assessment');
  pg.innerHTML =
    '<div class="page-header flex-between">' +
      '<div><h1>' + esc(cat.standard) + ' &mdash; ' + esc(cat.category) + '</h1>' +
      '<p>' + answeredCount + ' of ' + totalQ + ' questions answered (' + pct + '%)</p></div>' +
      '<button class="btn btn-outline btn-sm" onclick="renderAssessmentIntro()">Exit</button>' +
    '</div>' +

    '<div class="assessment-progress">' +
      '<div class="cat-tabs">' + tabs + '</div>' +
      '<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:' + pct + '%"></div></div>' +
    '</div>' +

    '<div class="card" style="padding:0;overflow:hidden;max-width:820px">' +
      '<div class="cat-header" style="background:' + color + '10">' +
        '<div style="width:44px;height:44px;border-radius:12px;background:' + color + '20;display:flex;align-items:center;justify-content:center">' +
          '<div style="width:14px;height:14px;border-radius:50%;background:' + color + '"></div>' +
        '</div>' +
        '<div><div style="font-size:16px;font-weight:600;color:' + color + '">' + esc(cat.category) + '</div>' +
        '<div style="font-size:12px;color:' + color + ';opacity:.7">' + cat.questions.length + ' questions &middot; ' + esc(cat.standard) + '</div></div>' +
        '<div style="margin-left:auto;text-align:right"><div style="font-size:18px;font-weight:600;color:' + color + '">' + done + '/' + cat.questions.length + '</div><div style="font-size:10px;color:' + color + ';opacity:.7">answered</div></div>' +
      '</div>' +
      '<div style="padding:0 20px">' + questions + '</div>' +
    '</div>' +

    '<div class="flex-between mt-20" style="max-width:820px">' +
      '<button class="btn btn-outline" style="visibility:' + (state.currentCategory === 0 ? 'hidden' : 'visible') + '" onclick="prevCategory()">&#8592; Back</button>' +
      '<div class="flex-center">' +
        '<span class="text-muted">' + (state.currentCategory + 1) + ' of ' + cats.length + '</span>' +
        (state.currentCategory < cats.length - 1
          ? '<button class="btn btn-primary" onclick="nextCategory()">Next &#8594;</button>'
          : '<button class="btn btn-primary btn-lg" onclick="submitAssessment()" ' + (state.submitting ? 'disabled' : '') + '>' + svgI('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', 16, '#fff') + ' Submit &amp; Generate Report</button>') +
      '</div>' +
    '</div>';
}

function setAnswer(qId, val) {
  state.answers[qId] = val;
  renderQuiz();
}

function jumpCategory(i) {
  state.currentCategory = i;
  renderQuiz();
}

function prevCategory() {
  if (state.currentCategory > 0) { state.currentCategory--; renderQuiz(); }
}

function nextCategory() {
  if (state.currentCategory < state.questions.length - 1) { state.currentCategory++; renderQuiz(); }
}

// ─── SUBMIT ASSESSMENT ───────────────────────────────────────────────────────
async function submitAssessment() {
  if (state.submitting) return;
  state.submitting = true;

  var pg = el('page-assessment');
  var steps = [
    'Saving your responses to database...',
    'Running deep security analysis...',
    'Analyzing vulnerabilities and attack vectors...',
    'Generating remediation recommendations...',
    'Building compliance gap report...',
    'Finalizing your security report...'
  ];

  pg.innerHTML =
    '<div class="loading-overlay">' +
      '<div class="spinner"></div>' +
      '<div style="text-align:center;margin-bottom:20px">' +
        '<div style="font-size:16px;font-weight:500;margin-bottom:4px">Analyzing your security posture</div>' +
        '<div class="text-muted">Processing ' + Object.keys(state.answers).length + ' responses across ' + state.questions.length + ' categories...</div>' +
        '<div class="text-muted" style="margin-top:4px">This may take 1-2 minutes. Please wait.</div>' +
      '</div>' +
      '<div class="loading-steps">' +
        steps.map(function(s, i) { return '<div class="loading-step" id="ls-' + i + '" style="animation-delay:' + (i * 0.3) + 's">' + svgI('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', 14, '#ADB5BD') + ' ' + s + '</div>'; }).join('') +
      '</div>' +
    '</div>';

  steps.forEach(function(_, i) {
    setTimeout(function() {
      var s = el('ls-' + i);
      if (s) s.style.color = '#276749';
    }, i * 2000 + 500);
  });

  // Build responses array
  var responses = [];
  for (var qId in state.answers) {
    responses.push({
      questionId: parseInt(qId),
      answer: state.answers[qId],
      comment: null
    });
  }

  try {
    var res = await api('/api/audit/submit', {
      method: 'POST',
      body: JSON.stringify({ responses: responses })
    });

    if (res.success) {
      // Poll for analysis completion
      await pollAnalysisStatus();
      state.submitting = false;
      showPage('report');
    } else {
      state.submitting = false;
      pg.innerHTML = '<div class="empty-state"><h3>Error</h3><p>' + esc(res.error) + '</p><button class="btn btn-primary" onclick="renderQuiz()">&#8592; Back</button></div>';
    }
  } catch (e) {
    state.submitting = false;
    pg.innerHTML = '<div class="empty-state"><h3>Connection error</h3><p>' + esc(e.message) + '</p><button class="btn btn-primary" onclick="renderQuiz()">&#8592; Back</button></div>';
  }
}

async function pollAnalysisStatus() {
  var maxAttempts = 60;
  for (var i = 0; i < maxAttempts; i++) {
    try {
      var status = await api('/api/audit/analysis-status');
      if (status.data.isComplete) return;
    } catch (e) { /* continue polling */ }
    await new Promise(function(resolve) { setTimeout(resolve, 3000); });
  }
}

// ─── REPORT ──────────────────────────────────────────────────────────────────
async function loadReport() {
  var pg = el('page-report');
  pg.innerHTML = '<div class="loading-overlay"><div class="spinner"></div><p class="text-muted">Loading report...</p></div>';

  try {
    var reportRes = await api('/api/reports/my-report');

    if (!reportRes.data) {
      pg.innerHTML =
        '<div class="empty-state">' +
          '<h3>No Assessment Data</h3>' +
          '<p>Complete a GRC assessment first to see your report.</p>' +
          '<button class="btn btn-primary" onclick="showPage(\'assessment\')">Start Assessment</button>' +
        '</div>';
      return;
    }

    var data = reportRes.data;
    var riskC = RISK_C[data.riskLevel] || '#333';

    // Try to get executive summary
    var execData = null;
    try {
      var execRes = await api('/api/reports/executive-summary');
      if (execRes.success) execData = execRes.data;
    } catch (e) { /* continue without exec summary */ }

    renderReport(data, execData);
  } catch (e) {
    pg.innerHTML = '<div class="empty-state"><h3>Error loading report</h3><p>' + esc(e.message) + '</p></div>';
  }
}

function renderReport(data, execData) {
  var pg = el('page-report');
  var riskC = RISK_C[data.riskLevel] || '#333';

  // Executive Summary Banner
  var html =
    '<div class="page-header"><h1>Security Assessment Report</h1><p>' + esc(data.company) + ' &middot; Assessed by ' + esc(data.assessedBy) + ' &middot; ' + fmt(data.date) + '</p></div>' +

    '<div class="exec-summary">' +
      '<div class="es-label">' + svgI('M13 10V3L4 14h7v7l9-11h-7z', 12, 'rgba(255,255,255,.5)') + ' Executive Summary &mdash; ' + esc(data.company) + '</div>' +
      (execData && execData.boardStatement
        ? '<p style="font-size:13px;font-weight:500;color:rgba(255,255,255,.95);line-height:1.75;margin-bottom:14px;padding:12px 14px;background:rgba(255,255,255,.08);border-radius:8px;border-left:3px solid rgba(255,255,255,.3)">' + esc(execData.boardStatement) + '</p>'
        : '') +
      (execData && execData.executiveSummary
        ? '<p class="es-text">' + esc(execData.executiveSummary) + '</p>'
        : '<p class="es-text">Assessment complete. ' + data.totalGaps + ' gaps identified across ' + data.totalQuestions + ' controls.</p>') +
      '<div class="es-stats">' +
        '<div><div class="es-stat-val">' + data.overallScore + '%</div><div class="es-stat-lbl">Overall Score</div></div>' +
        '<div><div class="es-stat-val" style="color:' + riskC + '">' + esc(data.riskLevel) + '</div><div class="es-stat-lbl">Risk Level</div></div>' +
        '<div><div class="es-stat-val">' + esc(data.maturityLevel) + '</div><div class="es-stat-lbl">Maturity Level</div></div>' +
      '</div>' +
    '</div>';

  // Stats badges
  html +=
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px">' +
      '<div style="padding:10px 16px;border-radius:10px;background:#FDEDED;border:1px solid #FEB2B2;display:flex;align-items:center;gap:8px"><div style="width:10px;height:10px;border-radius:50%;background:#9B2335"></div><div><div style="font-size:18px;font-weight:700;color:#9B2335">' + data.totalGaps + '</div><div style="font-size:10px;color:#9B2335;font-weight:600">GAPS FOUND</div></div></div>' +
      '<div style="padding:10px 16px;border-radius:10px;background:#F0FFF4;border:1px solid #9AE6B4;display:flex;align-items:center;gap:8px"><div style="width:10px;height:10px;border-radius:50%;background:#276749"></div><div><div style="font-size:18px;font-weight:700;color:#276749">' + data.totalStrengths + '</div><div style="font-size:10px;color:#276749;font-weight:600">CONTROLS MET</div></div></div>' +
      '<div style="padding:10px 16px;border-radius:10px;background:#EBF4FF;border:1px solid #90CDF4;display:flex;align-items:center;gap:8px"><div style="width:10px;height:10px;border-radius:50%;background:#2B6CB0"></div><div><div style="font-size:18px;font-weight:700;color:#2B6CB0">' + data.totalQuestions + '</div><div style="font-size:10px;color:#2B6CB0;font-weight:600">TOTAL ASSESSED</div></div></div>' +
    '</div>';

  // Category scores + chart
  html += '<div class="grid-2 mb-20">';

  // Category scores list
  html += '<div class="card"><div class="card-title">Category Scores</div>';
  data.categoryScores.forEach(function(cat) {
    var color = CAT_COLORS[cat.category] || '#4A5568';
    html +=
      '<div style="margin-bottom:14px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
          '<div style="font-size:12px;font-weight:500;color:#1A202C">' + esc(cat.category) + ' <span class="text-muted">(' + esc(cat.standard) + ')</span></div>' +
          '<div style="font-size:13px;font-weight:600;color:' + sc(cat.score) + '">' + cat.score + '%</div>' +
        '</div>' +
        '<div class="score-bar"><div class="score-bar-fill" style="width:' + cat.score + '%;background:' + color + '"></div></div>' +
        '<div class="text-muted" style="margin-top:2px">' + cat.gaps + ' gaps / ' + cat.strengths + ' met</div>' +
      '</div>';
  });
  html += '</div>';

  // Radar chart
  html += '<div class="card"><div class="card-title">Compliance Radar</div><div class="chart-wrap"><canvas id="report-radar"></canvas></div></div>';
  html += '</div>';

  // Attack Scenarios (from executive summary)
  if (execData && execData.attackScenarios && execData.attackScenarios.length > 0) {
    html +=
      '<div class="report-section">' +
        '<div class="section-header"><div class="section-icon" style="background:#FDEDED">' + svgI('M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', 16, '#9B2335') + '</div><h3>Attack Scenarios &mdash; How Attackers Can Bypass Your Systems</h3></div>';

    execData.attackScenarios.forEach(function(scenario) {
      var lc = { 'High': '#FC8181', 'Medium': '#F6AD55', 'Low': '#68D391' }[scenario.likelihood] || '#CBD5E0';
      html +=
        '<div class="attack-card">' +
          '<div class="attack-title">' + svgI('M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', 14, '#FC8181') + ' ' + esc(scenario.scenario) + '</div>' +
          '<div class="attack-body">' + esc(scenario.description) + '</div>' +
          '<div class="attack-meta">' +
            '<span style="background:' + lc + '30;color:' + lc + '">' + esc(scenario.likelihood) + ' Likelihood</span>' +
            '<span style="background:#FC818130;color:#FC8181">' + esc(scenario.impact) + '</span>' +
          '</div>' +
        '</div>';
    });

    html += '</div>';
  }

  // Top Risks
  if (execData && execData.topRisks && execData.topRisks.length > 0) {
    html +=
      '<div class="report-section card">' +
        '<div class="section-header"><div class="section-icon" style="background:#FFFAF0">' + svgI('M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', 16, '#C05621') + '</div><h3>Top Risks</h3></div>' +
        '<div class="table-wrap"><table>' +
          '<thead><tr><th>Risk</th><th>Severity</th><th>Description</th><th>Business Impact</th><th>Immediate Action</th></tr></thead>' +
          '<tbody>';

    execData.topRisks.forEach(function(risk) {
      var sevC = { 'Critical': '#9B2335', 'High': '#C05621', 'Medium': '#2B6CB0' }[risk.severity] || '#718096';
      var sevBg = { 'Critical': '#FDEDED', 'High': '#FFFAF0', 'Medium': '#EBF4FF' }[risk.severity] || '#F7FAFC';
      html +=
        '<tr>' +
          '<td><strong>' + esc(risk.risk) + '</strong></td>' +
          '<td><span class="badge" style="background:' + sevBg + ';color:' + sevC + '">' + esc(risk.severity) + '</span></td>' +
          '<td style="font-size:12px">' + esc(risk.description) + '</td>' +
          '<td style="font-size:12px;color:#9B2335">' + esc(risk.businessImpact) + '</td>' +
          '<td style="font-size:12px;color:#276749">' + esc(risk.immediateAction) + '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div></div>';
  }

  // Gap Deep Analysis
  if (data.criticalGaps && data.criticalGaps.length > 0) {
    html +=
      '<div class="report-section">' +
        '<div class="section-header" style="margin-bottom:20px">' +
          '<div class="section-icon" style="background:#FDEDED">' + svgI('M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', 16, '#9B2335') + '</div>' +
          '<div><h3>Vulnerability Analysis &mdash; ' + data.criticalGaps.length + ' Gaps</h3>' +
          '<p style="font-size:12px;color:#718096;margin-top:2px">Each gap analyzed with attack vectors, impact assessment, and remediation steps</p></div>' +
        '</div>';

    data.criticalGaps.forEach(function(gap, i) {
      var scoreColor = sc(gap.aiScore || 0);
      var severity = (gap.aiScore || 0) <= 25 ? 'Critical' : (gap.aiScore || 0) <= 50 ? 'High' : 'Medium';
      var sevC = { 'Critical': '#9B2335', 'High': '#C05621', 'Medium': '#2B6CB0' }[severity];
      var sevBg = { 'Critical': '#FDEDED', 'High': '#FFFAF0', 'Medium': '#EBF4FF' }[severity];

      html +=
        '<div class="gap-card">' +
          '<div class="gap-card-header">' +
            '<div style="width:30px;height:30px;border-radius:8px;background:' + sevBg + ';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:' + sevC + ';flex-shrink:0">' + (i + 1) + '</div>' +
            '<div style="flex:1">' +
              '<div style="display:flex;align-items:center;gap:7px;margin-bottom:4px;flex-wrap:wrap">' +
                '<span class="badge" style="background:' + sevBg + ';color:' + sevC + '">' + severity + '</span>' +
                '<span style="padding:2px 8px;border-radius:99px;background:#EBF4FF;color:#2B6CB0;font-size:11px;font-weight:500">' + esc(gap.category) + '</span>' +
                '<span style="font-size:11px;font-family:monospace;color:#718096">' + esc(gap.clause) + '</span>' +
                '<span style="font-size:11px;font-weight:600;color:' + scoreColor + '">Score: ' + (gap.aiScore || 0) + '/100</span>' +
              '</div>' +
              '<div style="font-size:14px;font-weight:600;color:#1A202C">' + esc(gap.question) + '</div>' +
            '</div>' +
          '</div>' +

          '<div class="gap-card-body">' +
            // Gap Analysis
            '<div style="margin-bottom:16px;padding:14px;background:#FFF5F5;border-radius:8px;border-left:3px solid #FC8181">' +
              '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#C53030;margin-bottom:6px">Vulnerability Analysis &amp; Attack Vectors</div>' +
              '<p style="font-size:13px;color:#742A2A;line-height:1.7;margin:0;white-space:pre-line">' + esc(gap.gapAnalysis || 'Analysis pending...') + '</p>' +
            '</div>' +

            // Recommendation
            '<div class="rec-box">' +
              '<div class="rec-title">' + svgI('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', 13, '#276749') + ' Remediation Plan</div>' +
              '<p style="white-space:pre-line">' + esc(gap.recommendation || 'Recommendations pending...') + '</p>' +
            '</div>' +
          '</div>' +
        '</div>';
    });

    html += '</div>';
  }

  // Compliance Risks
  if (execData && execData.complianceRisks && execData.complianceRisks.length > 0) {
    html +=
      '<div class="report-section card">' +
        '<div class="section-header"><div class="section-icon" style="background:#F0FFF4">' + svgI('M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', 16, '#276749') + '</div><h3>Compliance Gap Matrix</h3></div>' +
        '<div class="table-wrap"><table>' +
          '<thead><tr><th>Regulation</th><th>Status</th><th>Gaps</th><th>Penalty</th><th>Deadline</th></tr></thead>' +
          '<tbody>';

    execData.complianceRisks.forEach(function(c) {
      var stC = { 'Compliant': '#276749', 'Partially Compliant': '#C05621', 'Non-Compliant': '#9B2335' }[c.status] || '#718096';
      var stBg = { 'Compliant': '#F0FFF4', 'Partially Compliant': '#FFFAF0', 'Non-Compliant': '#FDEDED' }[c.status] || '#F7FAFC';
      var gapsText = Array.isArray(c.gaps) ? c.gaps.join(', ') : (c.gaps || '');
      html +=
        '<tr>' +
          '<td><strong>' + esc(c.regulation) + '</strong></td>' +
          '<td><span class="badge" style="background:' + stBg + ';color:' + stC + '">' + esc(c.status) + '</span></td>' +
          '<td style="font-size:12px">' + esc(gapsText) + '</td>' +
          '<td style="font-size:12px;color:#9B2335">' + esc(c.penalty) + '</td>' +
          '<td style="font-size:12px">' + esc(c.deadline) + '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div></div>';
  }

  // Roadmap
  if (execData && execData.roadmap) {
    html +=
      '<div class="report-section">' +
        '<div class="section-header"><div class="section-icon" style="background:#F0FFF4">' + svgI('M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7', 16, '#276749') + '</div><h3>Implementation Roadmap</h3></div>' +
        '<div class="grid-3">';

    var phases = [
      { key: 'immediate', title: 'Immediate (This Week)', color: '#9B2335', bg: '#FDEDED' },
      { key: 'shortTerm', title: 'Short-term (1-3 Months)', color: '#C05621', bg: '#FFFAF0' },
      { key: 'longTerm', title: 'Long-term (3-12 Months)', color: '#276749', bg: '#F0FFF4' }
    ];

    phases.forEach(function(phase) {
      var items = execData.roadmap[phase.key];
      if (!items) return;
      html +=
        '<div class="card">' +
          '<div style="font-size:11px;font-weight:700;color:' + phase.color + ';text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">' +
            '<span style="padding:2px 8px;background:' + phase.bg + ';border-radius:99px">' + phase.title + '</span>' +
          '</div>';

      (Array.isArray(items) ? items : []).forEach(function(item) {
        html +=
          '<div style="display:flex;gap:7px;margin-bottom:8px">' +
            '<div style="width:5px;height:5px;border-radius:50%;background:' + phase.color + ';margin-top:6px;flex-shrink:0"></div>' +
            '<div style="font-size:12px;color:#4A5568;line-height:1.5">' + esc(item) + '</div>' +
          '</div>';
      });

      html += '</div>';
    });

    html += '</div></div>';
  }

  // Investment
  if (execData && execData.investmentEstimate) {
    html +=
      '<div class="card report-section" style="background:#EBF4FF;border-color:#90CDF4">' +
        '<div class="section-header"><div class="section-icon" style="background:#fff">' + svgI('M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', 16, '#2B6CB0') + '</div><h3>Investment Estimate</h3></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px">' +
          '<div style="padding:14px;background:rgba(255,255,255,.7);border-radius:10px;text-align:center"><div style="font-size:18px;font-weight:600;color:#2B6CB0">' + esc(execData.investmentEstimate.minimum) + '</div><div class="text-muted">Minimum Budget</div></div>' +
          '<div style="padding:14px;background:rgba(255,255,255,.7);border-radius:10px;text-align:center"><div style="font-size:18px;font-weight:600;color:#2B6CB0">' + esc(execData.investmentEstimate.maximum) + '</div><div class="text-muted">Maximum Budget</div></div>' +
        '</div>' +
        '<p style="font-size:13px;color:#2C5282;line-height:1.7">' + esc(execData.investmentEstimate.roi) + '</p>' +
      '</div>';
  }

  // Strengths
  if (data.strengths && data.strengths.length > 0) {
    html +=
      '<div class="report-section card">' +
        '<div class="section-header"><div class="section-icon" style="background:#F0FFF4">' + svgI('M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', 16, '#276749') + '</div><h3>Controls Met (' + data.strengths.length + ')</h3></div>';

    data.strengths.forEach(function(s) {
      html +=
        '<div style="display:flex;gap:10px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #F7FAFC">' +
          '<div style="width:20px;height:20px;border-radius:50%;background:#F0FFF4;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">' + svgI('M5 13l4 4L19 7', 10, '#276749') + '</div>' +
          '<div>' +
            '<div style="font-size:12px;font-weight:500;color:#1A202C">' + esc(s.question) + '</div>' +
            '<div style="font-size:11px;color:#718096">' + esc(s.standard) + ' ' + esc(s.clause) + ' &middot; ' + esc(s.category) + '</div>' +
          '</div>' +
        '</div>';
    });

    html += '</div>';
  }

  // Footer
  html +=
    '<div style="padding:16px 0;border-top:1px solid #E2E8F0;margin-top:8px">' +
      '<p style="font-size:11px;color:#A0AEC0;line-height:1.7">This report is based on self-reported responses and is intended for internal assessment purposes. It does not constitute a formal audit, legal opinion, or compliance certification. Engage qualified GRC professionals for independent validation.</p>' +
    '</div>';

  pg.innerHTML = html;

  // Render radar chart
  setTimeout(function() {
    var ctx = el('report-radar');
    if (!ctx || typeof Chart === 'undefined') return;

    new Chart(ctx, {
      type: 'radar',
      data: {
        labels: data.categoryScores.map(function(c) { return c.category; }),
        datasets: [{
          data: data.categoryScores.map(function(c) { return c.score; }),
          backgroundColor: 'rgba(13,31,53,0.07)',
          borderColor: '#0D1F35',
          borderWidth: 2,
          pointBackgroundColor: data.categoryScores.map(function(c) { return CAT_COLORS[c.category] || '#718096'; }),
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function(c) { return ' ' + c.raw + '%'; } } }
        },
        scales: {
          r: {
            min: 0, max: 100,
            ticks: { stepSize: 25, font: { size: 10 }, color: '#ADB5BD', backdropColor: 'transparent' },
            grid: { color: '#EDF2F7' },
            angleLines: { color: '#EDF2F7' },
            pointLabels: { font: { size: 10, weight: '500' }, color: '#4A5568' }
          }
        }
      }
    });
  }, 200);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
if (state.token && state.user) {
  showApp();
} else {
  el('auth-container').style.display = 'flex';
  el('app').style.display = 'none';
}
