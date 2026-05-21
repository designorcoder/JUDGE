// ---------------------------------------------------------
// APP STATE & CONSTANTS
// ---------------------------------------------------------
let currentUser = null;
let currentChart = null;

const API_BASE = '/api';

// ---------------------------------------------------------
// TOAST NOTIFICATIONS HELPER
// ---------------------------------------------------------
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `glass-panel px-4 py-3 rounded-xl shadow-lg border text-sm flex items-center gap-3 animate-fade-in transition-all duration-300`;
  
  if (type === 'success') {
    toast.classList.add('border-emerald-500/20', 'bg-emerald-950/45', 'text-emerald-200');
    toast.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5 text-emerald-400 shrink-0"></i><span>${message}</span>`;
  } else if (type === 'error') {
    toast.classList.add('border-red-500/20', 'bg-red-950/45', 'text-red-200');
    toast.innerHTML = `<i data-lucide="x-circle" class="w-5 h-5 text-red-400 shrink-0"></i><span>${message}</span>`;
  } else {
    toast.classList.add('border-blue-500/20', 'bg-blue-950/45', 'text-blue-200');
    toast.innerHTML = `<i data-lucide="info" class="w-5 h-5 text-blue-400 shrink-0"></i><span>${message}</span>`;
  }

  container.appendChild(toast);
  lucide.createIcons();

  // Remove toast after 3 seconds
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// ---------------------------------------------------------
// API FETCH WRAPPER
// ---------------------------------------------------------
async function fetchApi(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      // Token expired or invalid
      logout();
      throw new Error('Sessiya muddati tugadi, qaytadan kiring.');
    }
    throw new Error(data.error || 'Server xatoligi yuz berdi');
  }

  return data;
}

// ---------------------------------------------------------
// AUTHENTICATION & LOGIN LOGIC
// ---------------------------------------------------------
async function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    showLoginView();
    return;
  }

  try {
    const data = await fetchApi('/auth/me');
    currentUser = data.user;
    setupSidebar();
    handleRouting();
  } catch (err) {
    console.error(err);
    logout();
  }
}

function showLoginView() {
  document.getElementById('loading-screen').classList.add('hidden');
  document.getElementById('main-layout').classList.add('hidden');
  document.getElementById('login-view').classList.remove('hidden');
  window.location.hash = '#login';
}

function setupSidebar() {
  if (!currentUser) return;

  // Set avatar initials and display name
  const initials = `${currentUser.first_name[0] || ''}${currentUser.last_name[0] || ''}`.toUpperCase();
  document.getElementById('user-avatar-initials').innerText = initials || 'U';
  document.getElementById('user-display-name').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
  document.getElementById('user-display-role').innerText = currentUser.role === 'ADMIN' ? 'Administrator' : 'Hakam';

  // Toggle navigation menus
  if (currentUser.role === 'ADMIN') {
    document.getElementById('admin-nav').classList.remove('hidden');
    document.getElementById('judge-nav').classList.add('hidden');
  } else {
    document.getElementById('admin-nav').classList.add('hidden');
    document.getElementById('judge-nav').classList.remove('hidden');
  }

  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('main-layout').classList.remove('hidden');
  document.getElementById('loading-screen').classList.add('hidden');
}

function logout() {
  localStorage.removeItem('token');
  currentUser = null;
  showLoginView();
}

// Login form handler
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const usernameVal = document.getElementById('username').value;
  const passwordVal = document.getElementById('password').value;
  const errorAlert = document.getElementById('login-error');
  const errorText = document.getElementById('login-error-text');

  errorAlert.classList.add('hidden');

  try {
    const data = await fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: usernameVal, password: passwordVal })
    });

    localStorage.setItem('token', data.token);
    currentUser = data.user;
    setupSidebar();
    
    // Redirect to correct dashboard
    if (currentUser.role === 'ADMIN') {
      window.location.hash = '#admin-dashboard';
    } else {
      window.location.hash = '#judge-dashboard';
    }
    
    showToast('Tizimga muvaffaqiyatli kirildi!', 'success');
  } catch (err) {
    errorAlert.classList.remove('hidden');
    errorText.innerText = err.message;
    showToast(err.message, 'error');
  }
});

document.getElementById('logout-button').addEventListener('click', (e) => {
  e.preventDefault();
  logout();
  showToast('Tizimdan chiqildi.', 'info');
});

// ---------------------------------------------------------
// ROUTER & VIEW MANAGEMENT
// ---------------------------------------------------------
function showView(viewId, titleText) {
  const views = [
    'admin-dashboard-view',
    'admin-classes-view',
    'admin-groups-view',
    'admin-judges-view',
    'admin-evaluations-view',
    'admin-rankings-view',
    'admin-statistics-view',
    'judge-dashboard-view',
    'judge-group-detail-view',
    'judge-evaluate-view'
  ];

  views.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.add('hidden');
  });

  const activeView = document.getElementById(viewId);
  if (activeView) activeView.classList.remove('hidden');

  // Update headers
  document.getElementById('mobile-view-title').innerText = titleText;
  
  // Highlight active sidebar links
  const hash = window.location.hash.split('?')[0];
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('href') === hash) {
      link.classList.add('bg-slate-800/60', 'text-white', 'border-l-4', 'border-emerald-500');
    } else {
      link.classList.remove('bg-slate-800/60', 'text-white', 'border-l-4', 'border-emerald-500');
    }
  });

  // Re-generate Lucide icons for newly shown views
  lucide.createIcons();
}

function handleRouting() {
  const hash = window.location.hash || '#login';
  
  if (hash === '#login' && currentUser) {
    if (currentUser.role === 'ADMIN') {
      window.location.hash = '#admin-dashboard';
    } else {
      window.location.hash = '#judge-dashboard';
    }
    return;
  }

  if (hash !== '#login' && !currentUser) {
    showLoginView();
    return;
  }

  // Parse queries like #judge-group-detail?id=1
  const pathPart = hash.split('?')[0];
  const queryPart = hash.split('?')[1] || '';
  const params = new URLSearchParams(queryPart);

  if (currentUser.role === 'ADMIN') {
    switch (pathPart) {
      case '#admin-dashboard':
        showView('admin-dashboard-view', 'Boshqaruv paneli');
        renderAdminDashboard();
        break;
      case '#admin-classes':
        showView('admin-classes-view', 'Sinflar');
        renderAdminClasses();
        break;
      case '#admin-groups':
        showView('admin-groups-view', 'Guruhlar');
        renderAdminGroups();
        break;
      case '#admin-judges':
        showView('admin-judges-view', 'Hakamlar');
        renderAdminJudges();
        break;
      case '#admin-evaluations':
        showView('admin-evaluations-view', 'Baholar jurnali');
        renderAdminEvaluations();
        break;
      case '#admin-rankings':
        showView('admin-rankings-view', 'Reyting');
        renderAdminRankings();
        break;
      case '#admin-statistics':
        showView('admin-statistics-view', 'Statistika');
        renderAdminStatistics();
        break;
      default:
        window.location.hash = '#admin-dashboard';
    }
  } else if (currentUser.role === 'JUDGE') {
    switch (pathPart) {
      case '#judge-dashboard':
        showView('judge-dashboard-view', 'Hakam paneli');
        renderJudgeDashboard();
        break;
      case '#judge-group-detail':
        showView('judge-group-detail-view', 'Guruh ma\'lumotlari');
        renderJudgeGroupDetail(params.get('id'));
        break;
      case '#judge-evaluate':
        showView('judge-evaluate-view', 'Baholash');
        renderJudgeEvaluate(params.get('id'));
        break;
      default:
        window.location.hash = '#judge-dashboard';
    }
  }
}

window.addEventListener('hashchange', handleRouting);

// ---------------------------------------------------------
// MOBILE SIDEBAR TOGGLES
// ---------------------------------------------------------
document.getElementById('mobile-sidebar-open').addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('fixed', 'inset-y-0', 'left-0', 'z-40', 'w-64');
  document.getElementById('sidebar').classList.remove('hidden');
});

document.getElementById('mobile-sidebar-close').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('fixed', 'inset-y-0', 'left-0', 'z-40', 'w-64');
  document.getElementById('sidebar').classList.add('w-full', 'lg:w-64');
});

// Auto-close sidebar on mobile navigation
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    if (window.innerWidth < 1024) {
      document.getElementById('sidebar').classList.remove('fixed', 'inset-y-0', 'left-0', 'z-40', 'w-64');
    }
  });
});


// ---------------------------------------------------------
// RENDER: ADMIN DASHBOARD
// ---------------------------------------------------------
async function renderAdminDashboard() {
  try {
    const stats = await fetchApi('/admin/dashboard-stats');

    // Populate counts
    const statsGrid = document.getElementById('admin-stats-cards');
    statsGrid.innerHTML = `
      <!-- Classes Card -->
      <div class="glass-panel p-5 rounded-2xl flex items-center gap-4">
        <div class="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
          <i data-lucide="graduation-cap" class="w-6 h-6"></i>
        </div>
        <div>
          <span class="text-xs text-slate-400 font-medium">Sinflar soni</span>
          <h2 class="text-2xl font-bold text-white mt-0.5">${stats.classes}</h2>
        </div>
      </div>
      <!-- Groups Card -->
      <div class="glass-panel p-5 rounded-2xl flex items-center gap-4">
        <div class="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
          <i data-lucide="users" class="w-6 h-6"></i>
        </div>
        <div>
          <span class="text-xs text-slate-400 font-medium">Guruhlar soni</span>
          <h2 class="text-2xl font-bold text-white mt-0.5">${stats.groups}</h2>
        </div>
      </div>
      <!-- Judges Card -->
      <div class="glass-panel p-5 rounded-2xl flex items-center gap-4">
        <div class="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
          <i data-lucide="shield-check" class="w-6 h-6"></i>
        </div>
        <div>
          <span class="text-xs text-slate-400 font-medium">Hakamlar soni</span>
          <h2 class="text-2xl font-bold text-white mt-0.5">${stats.judges}</h2>
        </div>
      </div>
      <!-- Evaluations Card -->
      <div class="glass-panel p-5 rounded-2xl flex items-center gap-4">
        <div class="p-3 bg-pink-500/10 text-pink-400 rounded-xl">
          <i data-lucide="check-square" class="w-6 h-6"></i>
        </div>
        <div>
          <span class="text-xs text-slate-400 font-medium">Baholangan loyihalar</span>
          <h2 class="text-2xl font-bold text-white mt-0.5">${stats.evaluations}</h2>
        </div>
      </div>
    `;

    // Populate recent evaluations table
    const tableBody = document.getElementById('recent-evaluations-list');
    if (stats.recent_evaluations.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-500 font-medium">Hozircha hech qanday baholash olingani yo'q.</td></tr>`;
      lucide.createIcons();
      return;
    }

    tableBody.innerHTML = stats.recent_evaluations.map(row => {
      const avg = ((row.score_functionality + row.score_architecture + row.score_performance + row.score_security + row.score_ui_ux) / 5).toFixed(1);
      const date = new Date(row.created_at).toLocaleDateString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
      return `
        <tr class="hover:bg-slate-900/10 transition">
          <td class="px-6 py-4">
            <div class="font-bold text-white">${row.group_name}</div>
            <div class="text-xs text-slate-400 mt-0.5">${row.project_name}</div>
          </td>
          <td class="px-6 py-4 font-medium">${row.first_name} ${row.last_name}</td>
          <td class="px-6 py-4">
            <span class="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded text-xs">
              <i data-lucide="star" class="w-3.5 h-3.5 fill-emerald-400/20"></i> ${avg}
            </span>
          </td>
          <td class="px-6 py-4 max-w-xs truncate text-slate-400 italic">${row.comment || 'Izohsiz'}</td>
          <td class="px-6 py-4 text-xs text-slate-400">${date}</td>
        </tr>
      `;
    }).join('');

    lucide.createIcons();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------------------------------------------------
// RENDER: ADMIN CLASSES
// ---------------------------------------------------------
async function renderAdminClasses() {
  try {
    const classes = await fetchApi('/admin/classes');

    const tableBody = document.getElementById('classes-table-body');
    if (classes.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-slate-500 font-medium">Hozircha sinflar kiritilmagan.</td></tr>`;
      return;
    }

    tableBody.innerHTML = classes.map(c => {
      const date = new Date(c.created_at).toLocaleDateString('uz-UZ');
      return `
        <tr class="hover:bg-slate-900/10 transition">
          <td class="px-6 py-4 font-bold text-white">${c.name}</td>
          <td class="px-6 py-4">${c.group_count} ta guruh</td>
          <td class="px-6 py-4 text-xs text-slate-400">${date}</td>
          <td class="px-6 py-4 text-right">
            <button onclick="deleteClass(${c.id})" class="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10 transition" title="O'chirish">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    lucide.createIcons();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('add-class-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nameInput = document.getElementById('class-name');
  const name = nameInput.value;

  try {
    await fetchApi('/admin/classes', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    nameInput.value = '';
    showToast('Sinf muvaffaqiyatli yaratildi!', 'success');
    renderAdminClasses();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

async function deleteClass(id) {
  if (!confirm('Ushbu sinfni o\'chirmoqchimisiz? Bu sinfdagi barcha guruhlar va ularning baholari ham o\'chib ketadi!')) return;

  try {
    const res = await fetchApi(`/admin/classes/${id}`, { method: 'DELETE' });
    showToast(res.message, 'success');
    renderAdminClasses();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------------------------------------------------
// RENDER: ADMIN GROUPS
// ---------------------------------------------------------
let selectedGroupJudges = [];
let groupMembersCount = 1;

async function renderAdminGroups() {
  try {
    // Reset form states
    groupMembersCount = 1;
    document.getElementById('members-inputs-container').innerHTML = `
      <input type="text" class="group-member-input glass-input w-full px-4 py-2 rounded-xl text-sm placeholder-slate-500" placeholder="Ism familiya">
    `;

    // Fetch classes for select
    const classes = await fetchApi('/admin/classes');
    const classSelect = document.getElementById('group-class-select');
    classSelect.innerHTML = `<option value="">Sinfni tanlang</option>` + 
      classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    // Fetch judges for checkboxes
    const judges = await fetchApi('/admin/judges');
    const judgesContainer = document.getElementById('judges-checkbox-container');
    if (judges.length === 0) {
      judgesContainer.innerHTML = `<span class="text-xs text-slate-500 italic">Hakamlar mavjud emas.</span>`;
    } else {
      judgesContainer.innerHTML = judges.map(j => `
        <label class="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
          <input type="checkbox" name="judges" value="${j.id}" class="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500/20">
          <span>${j.first_name} ${j.last_name} (${j.username})</span>
        </label>
      `).join('');
    }

    // Fetch and populate groups list
    const groups = await fetchApi('/admin/groups');
    const tableBody = document.getElementById('groups-table-body');
    if (groups.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-500 font-medium">Hozircha guruhlar kiritilmagan.</td></tr>`;
      return;
    }

    tableBody.innerHTML = groups.map(g => {
      const membersText = g.members.map(m => m.name).join(', ') || '<span class="text-slate-500 italic">A\'zolar yo\'q</span>';
      const judgesText = g.judges.map(j => `${j.first_name} ${j.last_name[0]}.`).join(', ') || '<span class="text-slate-500 italic">Biriktirilmagan</span>';
      return `
        <tr class="hover:bg-slate-900/10 transition">
          <td class="px-6 py-4">
            <div class="font-bold text-white">${g.name}</div>
            <div class="text-xs text-slate-400 mt-0.5">${g.class_name} sinfi</div>
          </td>
          <td class="px-6 py-4 font-medium text-slate-200">${g.project_name}</td>
          <td class="px-6 py-4 max-w-xs truncate text-xs text-slate-400">${membersText}</td>
          <td class="px-6 py-4 text-xs text-slate-300">${judgesText}</td>
          <td class="px-6 py-4 text-right">
            <button onclick="deleteGroup(${g.id})" class="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10 transition" title="O'chirish">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    lucide.createIcons();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Add member input field inside form
document.getElementById('add-member-input-btn').addEventListener('click', () => {
  const container = document.getElementById('members-inputs-container');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'group-member-input glass-input w-full px-4 py-2 rounded-xl text-sm placeholder-slate-500 animate-fade-in';
  input.placeholder = 'Ism familiya';
  container.appendChild(input);
});

document.getElementById('add-group-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('group-name').value;
  const project_name = document.getElementById('group-project-name').value;
  const school_class_id = document.getElementById('group-class-select').value;

  // Collect member inputs
  const memberInputs = document.querySelectorAll('.group-member-input');
  const members = Array.from(memberInputs).map(inp => inp.value.trim()).filter(val => val !== '');

  // Collect checked judges
  const judgeCheckboxes = document.querySelectorAll('input[name="judges"]:checked');
  const judges = Array.from(judgeCheckboxes).map(cb => parseInt(cb.value));

  try {
    await fetchApi('/admin/groups', {
      method: 'POST',
      body: JSON.stringify({ name, project_name, school_class_id: parseInt(school_class_id), judges, members })
    });
    
    // Clear form inputs
    document.getElementById('group-name').value = '';
    document.getElementById('group-project-name').value = '';
    document.getElementById('group-class-select').value = '';
    document.getElementById('members-inputs-container').innerHTML = `
      <input type="text" class="group-member-input glass-input w-full px-4 py-2 rounded-xl text-sm placeholder-slate-500">
    `;
    
    showToast('Guruh muvaffaqiyatli yaratildi!', 'success');
    renderAdminGroups();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

async function deleteGroup(id) {
  if (!confirm('Ushbu guruhni o\'chirmoqchimisiz? Guruhning barcha baholari o\'chirib tashlanadi!')) return;

  try {
    const res = await fetchApi(`/admin/groups/${id}`, { method: 'DELETE' });
    showToast(res.message, 'success');
    renderAdminGroups();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------------------------------------------------
// RENDER: ADMIN JUDGES
// ---------------------------------------------------------
async function renderAdminJudges() {
  try {
    const judges = await fetchApi('/admin/judges');

    const tableBody = document.getElementById('judges-table-body');
    if (judges.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="3" class="px-6 py-8 text-center text-slate-500 font-medium">Hozircha hakamlar kiritilmagan.</td></tr>`;
      return;
    }

    tableBody.innerHTML = judges.map(j => `
      <tr class="hover:bg-slate-900/10 transition">
        <td class="px-6 py-4 font-bold text-white">${j.first_name} ${j.last_name}</td>
        <td class="px-6 py-4 text-slate-400 font-mono">${j.username}</td>
        <td class="px-6 py-4 text-right">
          <button onclick="deleteJudge(${j.id})" class="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10 transition" title="O'chirish">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </td>
      </tr>
    `).join('');

    lucide.createIcons();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('add-judge-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const first_name = document.getElementById('judge-firstname').value;
  const last_name = document.getElementById('judge-lastname').value;
  const username = document.getElementById('judge-username').value;
  const password = document.getElementById('judge-password').value;

  try {
    await fetchApi('/admin/judges', {
      method: 'POST',
      body: JSON.stringify({ username, password, first_name, last_name })
    });

    // Clear inputs
    document.getElementById('judge-firstname').value = '';
    document.getElementById('judge-lastname').value = '';
    document.getElementById('judge-username').value = '';
    document.getElementById('judge-password').value = '';

    showToast('Hakam muvaffaqiyatli ro\'yxatdan o\'tkazildi!', 'success');
    renderAdminJudges();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

async function deleteJudge(id) {
  if (!confirm('Hakamni o\'chirmoqchimisiz? Uni guruhlardan olingan baholari saqlanib qoladi.')) return;

  try {
    const res = await fetchApi(`/admin/judges/${id}`, { method: 'DELETE' });
    showToast(res.message, 'success');
    renderAdminJudges();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------------------------------------------------
// RENDER: ADMIN EVALUATIONS HISTORY
// ---------------------------------------------------------
let cachedEvaluations = [];

async function renderAdminEvaluations() {
  try {
    // Populate class filter select
    const classes = await fetchApi('/admin/classes');
    const classFilter = document.getElementById('evals-class-filter');
    classFilter.innerHTML = `<option value="">Barcha sinflar bo'yicha</option>` + 
      classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

    // Fetch evaluations
    cachedEvaluations = await fetchApi('/admin/evaluations');
    applyEvaluationsFilter();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function applyEvaluationsFilter() {
  const searchQuery = document.getElementById('evals-search-input').value.trim().toLowerCase();
  const classFilter = document.getElementById('evals-class-filter').value;
  
  const filtered = cachedEvaluations.filter(row => {
    const matchSearch = row.group_name.toLowerCase().includes(searchQuery) ||
                        row.project_name.toLowerCase().includes(searchQuery) ||
                        `${row.first_name} ${row.last_name}`.toLowerCase().includes(searchQuery) ||
                        row.judge_username.toLowerCase().includes(searchQuery);
    
    const matchClass = classFilter === '' || row.class_name === classFilter;
    return matchSearch && matchClass;
  });

  const tableBody = document.getElementById('evaluations-table-body');
  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-slate-500 font-medium">Hech qanday baholash topilmadi.</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map(row => {
    const sum = row.score_functionality + row.score_architecture + row.score_performance + row.score_security + row.score_ui_ux;
    const avg = (sum / 5).toFixed(1);
    const date = new Date(row.created_at).toLocaleDateString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

    return `
      <tr class="hover:bg-slate-900/10 transition text-slate-300">
        <td class="px-6 py-4">
          <div class="font-bold text-white">${row.group_name}</div>
          <div class="text-xs text-slate-400 mt-0.5">${row.project_name} (${row.class_name})</div>
        </td>
        <td class="px-6 py-4">
          <div class="font-semibold text-slate-200">${row.first_name} ${row.last_name}</div>
          <div class="text-xs text-slate-400">@${row.judge_username}</div>
        </td>
        <td class="px-6 py-4 text-xs font-mono">
          <div class="grid grid-cols-5 gap-1 text-center min-w-[200px]">
            <div class="bg-slate-900/40 p-1.5 rounded border border-slate-800" title="Funksionallik">
              <span class="text-[9px] block text-emerald-400 uppercase font-sans">FUN</span>
              <span class="font-bold text-white text-sm">${row.score_functionality}</span>
            </div>
            <div class="bg-slate-900/40 p-1.5 rounded border border-slate-800" title="Arxitektura">
              <span class="text-[9px] block text-blue-400 uppercase font-sans">ARX</span>
              <span class="font-bold text-white text-sm">${row.score_architecture}</span>
            </div>
            <div class="bg-slate-900/40 p-1.5 rounded border border-slate-800" title="Tezlik">
              <span class="text-[9px] block text-indigo-400 uppercase font-sans">TEZ</span>
              <span class="font-bold text-white text-sm">${row.score_performance}</span>
            </div>
            <div class="bg-slate-900/40 p-1.5 rounded border border-slate-800" title="Xavfsizlik">
              <span class="text-[9px] block text-purple-400 uppercase font-sans">XAV</span>
              <span class="font-bold text-white text-sm">${row.score_security}</span>
            </div>
            <div class="bg-slate-900/40 p-1.5 rounded border border-slate-800" title="UI/UX">
              <span class="text-[9px] block text-pink-400 uppercase font-sans">UI</span>
              <span class="font-bold text-white text-sm">${row.score_ui_ux}</span>
            </div>
          </div>
        </td>
        <td class="px-6 py-4 text-center">
          <div class="font-extrabold text-white text-base">${sum}</div>
          <div class="text-[10px] text-slate-400">o'rtacha: ${avg}</div>
        </td>
        <td class="px-6 py-4 text-slate-400 italic max-w-xs break-words">${row.comment || 'Izohsiz'}</td>
        <td class="px-6 py-4 text-xs text-slate-400">${date}</td>
      </tr>
    `;
  }).join('');
}

document.getElementById('evals-search-input').addEventListener('input', applyEvaluationsFilter);
document.getElementById('evals-class-filter').addEventListener('change', applyEvaluationsFilter);

// ---------------------------------------------------------
// RENDER: ADMIN RANKINGS (LEADERBOARD)
// ---------------------------------------------------------
let cachedRankings = [];

async function renderAdminRankings() {
  try {
    // Populate class filter select
    const classes = await fetchApi('/admin/classes');
    const classFilter = document.getElementById('rankings-class-filter');
    classFilter.innerHTML = `<option value="">Barcha sinflar reytingi</option>` + 
      classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

    // Fetch rankings
    cachedRankings = await fetchApi('/admin/rankings');
    applyRankingsFilter();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function applyRankingsFilter() {
  const classFilter = document.getElementById('rankings-class-filter').value;
  const filtered = cachedRankings.filter(row => classFilter === '' || row.class_name === classFilter);

  const tableBody = document.getElementById('rankings-table-body');
  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-slate-500 font-medium">Loyihalar topilmadi.</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map((row, index) => {
    const isEvaluated = row.evaluations_count > 0;
    
    // Custom style for top 3 positions
    let medal = `<span class="font-bold text-slate-400">${index + 1}</span>`;
    if (index === 0 && classFilter !== '') {
      medal = `<span class="flex items-center justify-center w-7 h-7 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-bold text-xs"><i data-lucide="trophy" class="w-3.5 h-3.5 mr-0.5"></i>1</span>`;
    } else if (index === 1 && classFilter !== '') {
      medal = `<span class="flex items-center justify-center w-7 h-7 rounded-full bg-slate-300/10 border border-slate-300/30 text-slate-300 font-bold text-xs">2</span>`;
    } else if (index === 2 && classFilter !== '') {
      medal = `<span class="flex items-center justify-center w-7 h-7 rounded-full bg-amber-700/10 border border-amber-700/30 text-amber-500 font-bold text-xs">3</span>`;
    }

    return `
      <tr class="hover:bg-slate-900/10 transition text-slate-300">
        <td class="px-6 py-4 text-center font-bold">${medal}</td>
        <td class="px-6 py-4 font-bold text-white">${row.group_name}</td>
        <td class="px-6 py-4 font-medium text-slate-200">${row.project_name}</td>
        <td class="px-6 py-4 font-semibold">${row.class_name}</td>
        <td class="px-6 py-4 text-center font-mono text-slate-400">${row.evaluations_count} ta hakam</td>
        <td class="px-6 py-4 text-center font-extrabold text-white text-base">
          ${isEvaluated ? row.total_avg_score : '<span class="text-slate-500 font-normal italic">Baholanmagan</span>'}
        </td>
        <td class="px-6 py-4 text-center">
          ${isEvaluated ? `
            <span class="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold px-2.5 py-0.5 rounded text-xs">
              <i data-lucide="star" class="w-3 h-3 fill-emerald-400/20"></i> ${row.avg_score}
            </span>
          ` : '<span class="text-slate-500 italic text-xs">-</span>'}
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

document.getElementById('rankings-class-filter').addEventListener('change', applyRankingsFilter);

// Export PDF functionality
document.getElementById('export-pdf-btn').addEventListener('click', () => {
  // Set date in print format
  const dateStr = new Date().toLocaleString('uz-UZ', { dateStyle: 'long', timeStyle: 'short' });
  document.getElementById('print-date-text').innerText = `Chop etilgan vaqt: ${dateStr}`;
  
  // Trigger system print dialogue which generates PDF
  window.print();
});

// ---------------------------------------------------------
// RENDER: ADMIN STATISTICS
// ---------------------------------------------------------
async function renderAdminStatistics() {
  try {
    const stats = await fetchApi('/admin/statistics');

    // Category progress bars on the right
    const avgs = stats.averages;
    const widgetsContainer = document.getElementById('category-averages-widgets');
    
    const categories = [
      { name: 'Funksionallik', val: avgs.functionality, color: 'from-emerald-500 to-emerald-600', text: 'text-emerald-400' },
      { name: 'Kod arxitekturasi', val: avgs.architecture, color: 'from-blue-500 to-blue-600', text: 'text-blue-400' },
      { name: 'Tezlik va unumdorlik', val: avgs.performance, color: 'from-indigo-500 to-indigo-600', text: 'text-indigo-400' },
      { name: 'Xavfsizlik', val: avgs.security, color: 'from-purple-500 to-purple-600', text: 'text-purple-400' },
      { name: 'UI/UX (Dizayn)', val: avgs.ui_ux, color: 'from-pink-500 to-pink-600', text: 'text-pink-400' }
    ];

    widgetsContainer.innerHTML = `
      <h3 class="text-lg font-semibold text-white mb-4">Mezonlar ko'rsatkichlari</h3>
      <div class="space-y-4">
        ${categories.map(c => `
          <div>
            <div class="flex items-center justify-between text-xs font-semibold mb-1.5">
              <span class="text-slate-300">${c.name}</span>
              <span class="${c.text} font-bold">${c.val} / 10</span>
            </div>
            <div class="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
              <div class="bg-gradient-to-r ${c.color} h-full rounded-full" style="width: ${c.val * 10}%"></div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Radar Chart drawing
    if (currentChart) {
      currentChart.destroy();
    }

    const ctx = document.getElementById('category-radar-chart').getContext('2d');
    
    // Check if we have data to display
    const hasData = Object.values(avgs).some(v => v > 0);

    currentChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Funksionallik', 'Arxitektura', 'Tezlik', 'Xavfsizlik', 'UI/UX'],
        datasets: [{
          label: 'Umumiy o\'rtacha ko\'rsatkich',
          data: hasData ? [avgs.functionality, avgs.architecture, avgs.performance, avgs.security, avgs.ui_ux] : [0,0,0,0,0],
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          borderColor: '#10b981',
          borderWidth: 2,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#10b981'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          r: {
            angleLines: {
              color: 'rgba(255, 255, 255, 0.08)'
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.08)'
            },
            pointLabels: {
              color: '#94a3b8',
              font: {
                size: 11,
                family: 'Outfit'
              }
            },
            ticks: {
              color: '#475569',
              backdropColor: 'transparent',
              stepSize: 2
            },
            suggestedMin: 0,
            suggestedMax: 10
          }
        }
      }
    });

    // Populate Group Breakdown Table
    const breakdownTableBody = document.getElementById('statistics-groups-table-body');
    if (stats.group_scores.length === 0) {
      breakdownTableBody.innerHTML = `<tr><td colspan="8" class="px-6 py-8 text-center text-slate-500 font-medium">Statistikalar yaratilmagan.</td></tr>`;
      return;
    }

    breakdownTableBody.innerHTML = stats.group_scores.map(g => `
      <tr class="hover:bg-slate-900/10 transition text-slate-300">
        <td class="px-4 py-3 font-bold text-white">${g.group_name}</td>
        <td class="px-4 py-3 font-semibold">${g.class_name}</td>
        <td class="px-4 py-3 text-center bg-emerald-500/5 font-bold text-emerald-400">${g.functionality}</td>
        <td class="px-4 py-3 text-center bg-blue-500/5 font-bold text-blue-400">${g.architecture}</td>
        <td class="px-4 py-3 text-center bg-indigo-500/5 font-bold text-indigo-400">${g.performance}</td>
        <td class="px-4 py-3 text-center bg-purple-500/5 font-bold text-purple-400">${g.security}</td>
        <td class="px-4 py-3 text-center bg-pink-500/5 font-bold text-pink-400">${g.ui_ux}</td>
        <td class="px-4 py-3 text-center font-extrabold text-white text-base">${g.total_avg}</td>
      </tr>
    `).join('');

    lucide.createIcons();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------------------------------------------------
// RENDER: JUDGE DASHBOARD
// ---------------------------------------------------------
async function renderJudgeDashboard() {
  try {
    const groups = await fetchApi('/judge/dashboard');
    
    // Set welcome title
    document.getElementById('judge-welcome-title').innerText = `Xush kelibsiz, Hakam ${currentUser.first_name}!`;

    const container = document.getElementById('judge-assigned-groups');
    if (groups.length === 0) {
      container.innerHTML = `
        <div class="col-span-full glass-panel p-8 text-center rounded-2xl">
          <i data-lucide="info" class="w-8 h-8 text-slate-400 mx-auto mb-3"></i>
          <h3 class="text-white font-bold text-lg mb-1">Biriktirilgan loyihalar mavjud emas</h3>
          <p class="text-slate-400 text-sm">Hozircha sizga baholash uchun hech qanday loyiha biriktirilmagan.</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    container.innerHTML = groups.map(g => {
      const statusBadge = g.is_evaluated 
        ? `<span class="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-lg"><i data-lucide="check" class="w-3.5 h-3.5"></i>Baholangan</span>`
        : `<span class="inline-flex items-center gap-1 text-[11px] font-bold bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-lg"><i data-lucide="clock" class="w-3.5 h-3.5"></i>Kutilmoqda</span>`;

      const btnText = g.is_evaluated ? 'Batafsil ko\'rish' : 'Baholashni boshlash';
      const btnColor = g.is_evaluated 
        ? 'bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white' 
        : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-md shadow-emerald-500/10';

      return `
        <div class="glass-panel p-6 rounded-2xl shadow-xl flex flex-col justify-between glass-panel-hover transition">
          <div>
            <div class="flex items-center justify-between mb-3.5">
              <span class="text-xs font-extrabold text-blue-400 px-2 py-0.5 bg-blue-500/10 rounded-md border border-blue-500/20">${g.class_name} sinfi</span>
              ${statusBadge}
            </div>
            
            <h3 class="text-lg font-bold text-white leading-tight mb-1.5">${g.group_name}</h3>
            <p class="text-slate-400 text-xs font-medium mb-5 truncate">${g.project_name}</p>
          </div>

          <a href="#judge-group-detail?id=${g.id}" class="w-full text-center py-2.5 rounded-xl text-xs font-bold transition duration-200 block ${btnColor}">
            ${btnText}
          </a>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------------------------------------------------
// RENDER: JUDGE GROUP DETAIL
// ---------------------------------------------------------
async function renderJudgeGroupDetail(id) {
  try {
    const group = await fetchApi(`/judge/groups/${id}`);

    // Set titles
    document.getElementById('detail-group-title').innerText = `${group.name} - ${group.project_name}`;
    document.getElementById('detail-group-subtitle').innerText = `${group.class_name} sinfi jamoasi`;

    // Populate members
    const membersList = document.getElementById('detail-members-list');
    if (group.members.length === 0) {
      membersList.innerHTML = `<span class="text-slate-500 italic text-sm">Guruh a'zolari kiritilmagan.</span>`;
    } else {
      membersList.innerHTML = group.members.map(m => `
        <span class="px-3.5 py-1.5 bg-slate-900/60 border border-slate-800 text-slate-300 rounded-xl text-sm font-semibold flex items-center gap-1.5">
          <i data-lucide="user" class="w-4 h-4 text-emerald-400"></i> ${m.name}
        </span>
      `).join('');
    }

    // Populate other comments
    const commentsList = document.getElementById('detail-other-comments');
    if (group.other_comments.length === 0) {
      commentsList.innerHTML = `
        <div class="text-center py-6 text-slate-500">
          <i data-lucide="message-square" class="w-6 h-6 mx-auto mb-2 text-slate-600"></i>
          <span class="text-xs font-semibold">Hozircha hech kim izoh qoldirmagan</span>
        </div>
      `;
    } else {
      commentsList.innerHTML = group.other_comments.map(c => {
        const date = new Date(c.created_at).toLocaleDateString('uz-UZ');
        return `
          <div class="bg-slate-950/20 p-4 rounded-xl border border-slate-800/80">
            <div class="flex items-center justify-between text-xs font-semibold mb-1.5">
              <span class="text-slate-300">${c.first_name} ${c.last_name}</span>
              <span class="text-slate-500">${date}</span>
            </div>
            <p class="text-slate-400 italic text-sm">"${c.comment}"</p>
          </div>
        `;
      }).join('');
    }

    // Populate evaluation status box and action buttons
    const statusBox = document.getElementById('detail-eval-status-box');
    const startBtnText = document.getElementById('start-evaluation-btn-text');
    const startBtn = document.getElementById('start-evaluation-btn');

    // Set action handler for evaluate button
    startBtn.onclick = () => {
      window.location.hash = `#judge-evaluate?id=${group.id}`;
    };

    if (group.my_evaluation) {
      const my = group.my_evaluation;
      const sum = my.score_functionality + my.score_architecture + my.score_performance + my.score_security + my.score_ui_ux;
      
      statusBox.className = "p-5 rounded-xl border border-emerald-500/20 bg-emerald-950/20 text-emerald-200 mb-6";
      statusBox.innerHTML = `
        <div class="flex flex-col items-center">
          <i data-lucide="check-circle" class="w-8 h-8 text-emerald-400 mb-2"></i>
          <h4 class="font-bold text-sm">Siz loyihani baholagansiz</h4>
          <span class="text-3xl font-black text-white mt-2">${sum} <span class="text-xs text-emerald-300 font-normal">/ 50 ball</span></span>
          
          <div class="grid grid-cols-5 gap-1.5 mt-4 w-full text-[10px] text-center font-mono">
            <div class="bg-emerald-950/40 p-1.5 rounded border border-emerald-500/10">
              <span class="block text-emerald-300">FUN</span>
              <span class="font-bold text-white text-xs">${my.score_functionality}</span>
            </div>
            <div class="bg-emerald-950/40 p-1.5 rounded border border-emerald-500/10">
              <span class="block text-emerald-300">ARX</span>
              <span class="font-bold text-white text-xs">${my.score_architecture}</span>
            </div>
            <div class="bg-emerald-950/40 p-1.5 rounded border border-emerald-500/10">
              <span class="block text-emerald-300">TEZ</span>
              <span class="font-bold text-white text-xs">${my.score_performance}</span>
            </div>
            <div class="bg-emerald-950/40 p-1.5 rounded border border-emerald-500/10">
              <span class="block text-emerald-300">XAV</span>
              <span class="font-bold text-white text-xs">${my.score_security}</span>
            </div>
            <div class="bg-emerald-950/40 p-1.5 rounded border border-emerald-500/10">
              <span class="block text-emerald-300">UI</span>
              <span class="font-bold text-white text-xs">${my.score_ui_ux}</span>
            </div>
          </div>
          ${my.comment ? `<p class="text-xs text-emerald-300 italic mt-3 bg-slate-950/20 p-2.5 rounded-lg border border-emerald-500/5 w-full">"${my.comment}"</p>` : ''}
        </div>
      `;
      startBtnText.innerText = "Baholarni tahrirlash";
    } else {
      statusBox.className = "p-5 rounded-xl border border-yellow-500/20 bg-yellow-950/15 text-yellow-300 mb-6";
      statusBox.innerHTML = `
        <div class="flex flex-col items-center">
          <i data-lucide="clock" class="w-8 h-8 text-yellow-400 mb-2"></i>
          <h4 class="font-bold text-sm">Baholash kutilmoqda</h4>
          <p class="text-[11px] text-slate-400 mt-1">Loyiha uchun ball kiritilmagan. Baholash uchun quyidagi tugmani bosing.</p>
        </div>
      `;
      startBtnText.innerText = "Loyiha baholash";
    }

    // Bind back buttons
    document.querySelectorAll('.back-to-dashboard-btn').forEach(btn => {
      btn.onclick = () => window.location.hash = '#judge-dashboard';
    });

    lucide.createIcons();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------------------------------------------------
// RENDER: JUDGE EVALUATE FORM
// ---------------------------------------------------------
let activeEvaluateGroupId = null;

async function renderJudgeEvaluate(id) {
  try {
    activeEvaluateGroupId = id;
    const group = await fetchApi(`/judge/groups/${id}`);

    // Set titles
    document.getElementById('eval-form-title').innerText = `${group.name}: Loyihani baholash`;
    document.getElementById('eval-form-subtitle').innerText = `Loyiha nomi: ${group.project_name}`;

    // Reset slider defaults
    const categories = ['functionality', 'architecture', 'performance', 'security', 'ui-ux'];
    
    // Load pre-existing scores if present
    if (group.my_evaluation) {
      const my = group.my_evaluation;
      document.getElementById('score-functionality').value = my.score_functionality;
      document.getElementById('score-architecture').value = my.score_architecture;
      document.getElementById('score-performance').value = my.score_performance;
      document.getElementById('score-security').value = my.score_security;
      document.getElementById('score-ui-ux').value = my.score_ui_ux;
      document.getElementById('eval-comment').value = my.comment || '';
    } else {
      categories.forEach(cat => {
        document.getElementById(`score-${cat}`).value = 5;
      });
      document.getElementById('eval-comment').value = '';
    }

    // Set up real-time slider value updates and total score recalculation
    function updateValues() {
      let sum = 0;
      categories.forEach(cat => {
        const val = parseInt(document.getElementById(`score-${cat}`).value);
        document.getElementById(`score-val-${cat}`).innerText = val;
        sum += val;
      });
      document.getElementById('eval-total-score').innerHTML = `${sum} <span class="text-sm text-slate-400 font-medium">/ 50</span>`;
    }

    categories.forEach(cat => {
      document.getElementById(`score-${cat}`).oninput = updateValues;
    });

    // Run initial calculation
    updateValues();

    // Bind back buttons
    document.querySelectorAll('.back-to-group-detail-btn').forEach(btn => {
      btn.onclick = () => window.location.hash = `#judge-group-detail?id=${id}`;
    });

    lucide.createIcons();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Form Submission for Evaluation
document.getElementById('evaluation-submit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const score_functionality = parseInt(document.getElementById('score-functionality').value);
  const score_architecture = parseInt(document.getElementById('score-architecture').value);
  const score_performance = parseInt(document.getElementById('score-performance').value);
  const score_security = parseInt(document.getElementById('score-security').value);
  const score_ui_ux = parseInt(document.getElementById('score-ui-ux').value);
  const comment = document.getElementById('eval-comment').value;

  try {
    const res = await fetchApi('/judge/evaluate', {
      method: 'POST',
      body: JSON.stringify({
        group_id: parseInt(activeEvaluateGroupId),
        score_functionality,
        score_architecture,
        score_performance,
        score_security,
        score_ui_ux,
        comment
      })
    });

    showToast(res.message, 'success');
    window.location.hash = `#judge-group-detail?id=${activeEvaluateGroupId}`;
  } catch (err) {
    showToast(err.message, 'error');
  }
});


// ---------------------------------------------------------
// APP BOOTSTRAP
// ---------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});
