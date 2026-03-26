// Family Members Tracker - Main Application
let currentUser = null;
let token = null;

// DOM Elements
const loginSection = document.getElementById('login-section');
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const userDisplay = document.getElementById('user-name-display');
const userRoleBadge = document.getElementById('user-role-badge');

// API helper with timeout
async function apiCall(endpoint, options = {}, retries = 2) {
  const url = endpoint;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
      const response = await fetch(url, { ...options, headers, signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.status === 401 || response.status === 403) {
        if (currentUser) logout();
        throw new Error('Authentication failed');
      }
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loginSection.style.display = 'block';
  mainApp.style.display = 'none';
  setupPasswordToggles();
  setupEventListeners();
  setupCandle();
  setTimeout(() => checkAuth(), 100);
});

// Password toggle
function setupPasswordToggles() {
  document.querySelectorAll('.toggle-password').forEach(button => {
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    newButton.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.dataset.target;
      const input = document.getElementById(targetId);
      const icon = this.querySelector('i');
      if (input) {
        const newType = input.type === 'password' ? 'text' : 'password';
        input.type = newType;
        if (icon) {
          icon.classList.toggle('fa-eye');
          icon.classList.toggle('fa-eye-slash');
        }
        input.focus();
      }
    });
  });
}

async function checkAuth() {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  if (!storedToken || !storedUser) return;
  
  token = storedToken;
  currentUser = JSON.parse(storedUser);
  
  try {
    const response = await apiCall('/api/auth/me');
    if (response.ok) {
      currentUser = await response.json();
      showMainApp();
    } else {
      logout();
    }
  } catch (error) {
    console.error('Auth check failed:', error);
  }
}

function setupEventListeners() {
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  
  document.getElementById('new-inspiration')?.addEventListener('click', loadDailyInspiration);
  
  const taskDateSelector = document.getElementById('task-date-selector');
  if (taskDateSelector) {
    taskDateSelector.value = new Date().toISOString().split('T')[0];
    taskDateSelector.addEventListener('change', () => loadTasksForDate(taskDateSelector.value));
  }
  
  // Admin tabs
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => switchAdminTab(tab.dataset.tab));
  });
  
  document.getElementById('create-user-form')?.addEventListener('submit', handleCreateUser);
  document.getElementById('create-root-admin-form')?.addEventListener('submit', handleCreateRootAdmin);
  document.getElementById('schedule-task-form')?.addEventListener('submit', handleScheduleTask);
  document.getElementById('export-json')?.addEventListener('click', () => exportData('json'));
  document.getElementById('export-csv')?.addEventListener('click', () => exportData('csv'));
  
  new MutationObserver(() => setupPasswordToggles()).observe(document.body, { childList: true, subtree: true });
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  
  errorDiv.textContent = '';
  submitBtn.disabled = true;
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
  
  try {
    const response = await apiCall('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    
    if (response.ok) {
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(currentUser));
      showMainApp();
    } else {
      errorDiv.textContent = data.error || 'Invalid credentials';
    }
  } catch (error) {
    errorDiv.textContent = 'Connection error. Please try again.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

function logout() {
  localStorage.clear();
  token = null;
  currentUser = null;
  loginSection.style.display = 'block';
  mainApp.style.display = 'none';
  document.querySelectorAll('#login-password, #new-password, #root-password').forEach(input => {
    if (input.type === 'text') input.type = 'password';
  });
  document.querySelectorAll('.toggle-password i').forEach(icon => {
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  });
}

function showMainApp() {
  loginSection.style.display = 'none';
  mainApp.style.display = 'block';
  
  if (currentUser) {
    userDisplay.textContent = currentUser.fullName || currentUser.username;
    const roleClass = currentUser.role === 'root_admin' ? 'root' : currentUser.role;
    userRoleBadge.textContent = currentUser.role === 'root_admin' ? 'ሥር አስተዳዳሪ' : 
                                 (currentUser.role === 'admin' ? 'አስተዳዳሪ' : 'ተጠቃሚ');
    userRoleBadge.className = `role-badge ${roleClass}`;
  }
  
  const isAdmin = currentUser && (currentUser.role === 'root_admin' || currentUser.role === 'admin');
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');
  document.querySelectorAll('.root-only').forEach(el => el.style.display = currentUser?.role === 'root_admin' ? '' : 'none');
  
  setTimeout(() => setupPasswordToggles(), 100);
  
  if (currentUser.role === 'standard') {
    loadTasksForDate(new Date().toISOString().split('T')[0]);
    loadDailyInspiration();
  } else {
    loadDashboard();
    loadUsersList();
    loadAnalytics();
  }
}

function switchView(view) {
  const views = ['dashboard', 'tasks', 'calendar', 'admin', 'analytics'];
  views.forEach(v => {
    const el = document.getElementById(`${v}-view`);
    if (el) el.style.display = v === view ? 'block' : 'none';
  });
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  
  if (view === 'tasks') loadTasksForDate(new Date().toISOString().split('T')[0]);
  if (view === 'admin') loadUsersList();
  if (view === 'analytics' && currentUser?.role !== 'standard') loadAnalytics();
}

function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  ['users', 'create', 'create-root', 'audit'].forEach(tab => {
    const el = document.getElementById(`${tab}-tab`);
    if (el) el.style.display = tab === tabName ? 'block' : 'none';
  });
  if (tabName === 'audit') loadAuditLogs();
}

async function loadTasksForDate(date) {
  const container = document.getElementById('tasks-list-container') || document.getElementById('today-tasks-list');
  if (!container || !token) return;
  
  try {
    const tasksRes = await apiCall('/api/tasks');
    const tasks = await tasksRes.json();
    const completionsRes = await apiCall(`/api/completions?date=${date}`);
    const completions = await completionsRes.json();
    
    const userTasks = currentUser.role === 'standard' 
      ? tasks.filter(t => t.type === 'daily' || (t.type === 'scheduled' && t.scheduledDate === date) || t.type === 'weekly')
      : tasks;
    
    container.innerHTML = userTasks.map(task => {
      const completion = completions.find(c => c.taskId === task.id);
      const isCompleted = completion?.completed || false;
      return `
        <div class="task-item ${isCompleted ? 'completed' : ''}" data-task-id="${task.id}">
          <div class="task-icon">${task.icon || '✠'}</div>
          <div class="task-content">
            <div class="task-title">${task.nameAmharic}</div>
            ${task.scheduledDate ? `<div class="task-date">📅 ${task.scheduledDate}</div>` : ''}
          </div>
          <input type="checkbox" class="task-checkbox" ${isCompleted ? 'checked' : ''} 
                 onchange="toggleTaskCompletion('${task.id}', '${task.type}', '${date}', this.checked)">
        </div>
      `;
    }).join('');
    setupPasswordToggles();
  } catch (error) {
    console.error('Error loading tasks:', error);
    container.innerHTML = '<div class="error-message">Failed to load tasks</div>';
  }
}

window.toggleTaskCompletion = async function(taskId, taskType, date, completed) {
  if (!token) return;
  try {
    await apiCall('/api/completions', {
      method: 'POST',
      body: JSON.stringify({ taskId, taskType, date, completed })
    });
    await loadTasksForDate(date);
    if (currentUser.role !== 'standard') loadDashboard();
  } catch (error) {
    console.error('Error toggling completion:', error);
  }
};

async function loadDashboard() {
  if (!token || currentUser.role === 'standard') return;
  try {
    const analyticsRes = await apiCall('/api/analytics');
    const analytics = await analyticsRes.json();
    const statsGrid = document.getElementById('stats-grid');
    if (statsGrid) {
      statsGrid.innerHTML = `
        <div class="stat-card"><div class="stat-value">${analytics.totalUsers}</div><div class="stat-label">ተጠቃሚዎች</div></div>
        <div class="stat-card"><div class="stat-value">${analytics.totalAdmins}</div><div class="stat-label">አስተዳዳሪዎች</div></div>
        <div class="stat-card"><div class="stat-value">${Math.round(analytics.userProgress.reduce((a,b)=>a+b.percentage,0)/analytics.userProgress.length || 0)}%</div><div class="stat-label">አማካይ ማጠናቀቅ</div></div>
      `;
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

async function loadDailyInspiration() {
  const textEl = document.getElementById('inspiration-text');
  const sourceEl = document.getElementById('inspiration-source');
  if (!textEl) return;
  try {
    const res = await apiCall('/api/inspiration');
    const data = await res.json();
    textEl.textContent = data.text;
    sourceEl.textContent = data.source;
  } catch (error) {
    console.error('Error loading inspiration:', error);
  }
}

async function loadUsersList() {
  const container = document.getElementById('users-list');
  if (!container || !token) return;
  try {
    const res = await apiCall('/api/users');
    const users = await res.json();
    container.innerHTML = users.map(user => `
      <div class="user-card">
        <div class="user-info">
          <div class="user-name">${user.fullName || user.username}</div>
          <div class="user-role ${user.role}">${user.role === 'root_admin' ? 'ሥር አስተዳዳሪ' : user.role === 'admin' ? 'አስተዳዳሪ' : 'ተጠቃሚ'}</div>
          <div class="user-username">@${user.username}</div>
        </div>
        <div class="user-actions">
          <button class="action-btn edit" onclick="editUser('${user.id}', '${user.username}', '${user.fullName || ''}', '${user.role}')"><i class="fas fa-edit"></i></button>
          ${user.id !== currentUser?.id ? `<button class="action-btn delete" onclick="deleteUser('${user.id}')"><i class="fas fa-trash"></i></button>` : ''}
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

window.editUser = function(userId, username, fullName, role) {
  const newUsername = prompt('New username (leave blank to keep):', username);
  const newFullName = prompt('New full name (leave blank to keep):', fullName);
  const newPassword = prompt('New password (leave blank to keep):', '');
  
  const updates = {};
  if (newUsername && newUsername !== username) updates.username = newUsername;
  if (newFullName && newFullName !== fullName) updates.fullName = newFullName;
  if (newPassword) updates.password = newPassword;
  if (Object.keys(updates).length === 0) return;
  
  apiCall('/api/users', {
    method: 'PUT',
    body: JSON.stringify({ userId, ...updates })
  }).then(res => {
    if (res.ok) loadUsersList();
    else alert('Failed to update user');
  }).catch(() => alert('Error updating user'));
};

window.deleteUser = async function(userId) {
  if (!confirm('Delete this user?')) return;
  try {
    const res = await apiCall(`/api/users?userId=${userId}`, { method: 'DELETE' });
    if (res.ok) loadUsersList();
    else alert('Failed to delete');
  } catch (error) {
    alert('Error deleting user');
  }
};

async function handleCreateUser(e) {
  e.preventDefault();
  const username = document.getElementById('new-username').value;
  const password = document.getElementById('new-password').value;
  const fullName = document.getElementById('new-fullname').value;
  const role = document.getElementById('new-role').value;
  
  try {
    const res = await apiCall('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, fullName, role })
    });
    if (res.ok) {
      alert('User created');
      document.getElementById('create-user-form').reset();
      loadUsersList();
      switchAdminTab('users');
    } else {
      alert('Failed to create user');
    }
  } catch (error) {
    alert('Error creating user');
  }
}

async function handleCreateRootAdmin(e) {
  e.preventDefault();
  const username = document.getElementById('root-username').value;
  const password = document.getElementById('root-password').value;
  const fullName = document.getElementById('root-fullname').value;
  
  try {
    const res = await apiCall('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, fullName, role: 'admin' })
    });
    if (res.ok) {
      alert('Admin created');
      document.getElementById('create-root-admin-form').reset();
      loadUsersList();
      switchAdminTab('users');
    } else {
      alert('Failed to create admin');
    }
  } catch (error) {
    alert('Error creating admin');
  }
}

async function handleScheduleTask(e) {
  e.preventDefault();
  const nameAmharic = document.getElementById('task-title').value;
  const scheduledDate = document.getElementById('task-date').value;
  const type = document.getElementById('task-type')?.value || 'scheduled';
  
  try {
    const res = await apiCall('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ nameAmharic, scheduledDate, type })
    });
    if (res.ok) {
      alert('Task scheduled');
      document.getElementById('schedule-task-form').reset();
    } else {
      alert('Failed to schedule');
    }
  } catch (error) {
    alert('Error scheduling task');
  }
}

async function loadAnalytics() {
  if (!token || currentUser.role === 'standard') return;
  try {
    const res = await apiCall('/api/analytics');
    const data = await res.json();
    
    document.getElementById('overall-percentage').textContent = `${Math.round(data.userProgress.reduce((a,b)=>a+b.percentage,0)/data.userProgress.length || 0)}%`;
    document.getElementById('total-members').textContent = data.totalUsers;
    
    const progressList = document.getElementById('user-progress-list');
    if (progressList) {
      progressList.innerHTML = data.userProgress.map(user => `
        <div class="progress-item">
          <div class="progress-header"><span>${user.fullName || user.username}</span><span>${user.percentage}%</span></div>
          <div class="progress-bar"><div class="progress-fill" style="width: ${user.percentage}%"></div></div>
        </div>
      `).join('');
    }
    
    const ctx = document.getElementById('trends-chart');
    if (ctx && typeof Chart !== 'undefined') {
      const existing = Chart.getChart(ctx);
      if (existing) existing.destroy();
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.userProgress.map(u => u.username),
          datasets: [{
            label: 'Completion Rate (%)',
            data: data.userProgress.map(u => u.percentage),
            backgroundColor: 'rgba(201,160,61,0.6)',
            borderColor: '#C9A03D'
          }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } } }
      });
    }
  } catch (error) {
    console.error('Error loading analytics:', error);
  }
}

async function loadAuditLogs() {
  const container = document.getElementById('audit-logs-container');
  if (!container) return;
  try {
    const res = await apiCall('/api/audit');
    const data = await res.json();
    container.innerHTML = data.logs.map(log => `
      <div class="audit-entry">
        <i class="fas fa-history"></i>
        <strong>${new Date(log.timestamp).toLocaleString()}</strong><br>
        ${log.username} performed: ${log.action} on ${log.target || 'system'}
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = '<div class="error-message">Failed to load audit logs</div>';
  }
}

async function exportData(format) {
  try {
    const res = await apiCall('/api/analytics');
    const data = await res.json();
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `family-tracker-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'csv') {
      const headers = ['Username', 'Full Name', 'Completion Rate (%)'];
      const rows = data.userProgress.map(u => [u.username, u.fullName, u.percentage]);
      const csv = [headers, ...rows].map(row => row.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `family-tracker-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    alert('Failed to export');
  }
}

// Candle feature
let candleCount = parseInt(localStorage.getItem('candleCount') || '0');
function setupCandle() {
  const candle = document.getElementById('prayer-candle');
  const flame = document.getElementById('candle-flame');
  const countSpan = document.getElementById('candle-count');
  if (countSpan) countSpan.textContent = candleCount;
  if (candle) {
    candle.addEventListener('click', () => {
      candleCount++;
      if (countSpan) countSpan.textContent = candleCount;
      localStorage.setItem('candleCount', candleCount);
      if (flame) {
        flame.classList.add('lit');
        setTimeout(() => flame.classList.remove('lit'), 1000);
      }
    });
  }
}
