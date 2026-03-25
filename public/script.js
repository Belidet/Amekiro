// የአመክሮ ቤተሰብ መከታተያ
// Main Application Logic

// Global state
let currentUser = null;
let token = null;
let currentView = 'dashboard';
let candleCount = parseInt(localStorage.getItem('candleCount') || '0');
let trendsChart = null;

// API Base URL
const API_BASE = '/api';

// DOM Elements
const loginSection = document.getElementById('login-section');
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const userDisplay = document.getElementById('user-name-display');
const userRoleBadge = document.getElementById('user-role-badge');

// Navigation
const navBtns = document.querySelectorAll('.nav-btn');
const views = {
  dashboard: document.getElementById('dashboard-view'),
  tasks: document.getElementById('tasks-view'),
  calendar: document.getElementById('calendar-view'),
  admin: document.getElementById('admin-view'),
  analytics: document.getElementById('analytics-view')
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupEventListeners();
  setupCandle();
  loadDailyInspiration();
});

// Check authentication
async function checkAuth() {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  
  if (storedToken && storedUser) {
    token = storedToken;
    currentUser = JSON.parse(storedUser);
    
    try {
      // Verify token
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const user = await response.json();
        currentUser = user;
        showMainApp();
      } else {
        logout();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      logout();
    }
  }
}

// Setup event listeners
function setupEventListeners() {
  loginForm.addEventListener('submit', handleLogin);
  logoutBtn.addEventListener('click', logout);
  
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) {
        switchView(view);
      }
    });
  });
  
  // Task date selector
  const taskDateSelector = document.getElementById('task-date-selector');
  if (taskDateSelector) {
    taskDateSelector.value = new Date().toISOString().split('T')[0];
    taskDateSelector.addEventListener('change', () => loadTasksForDate(taskDateSelector.value));
  }
  
  // Schedule task form
  const scheduleForm = document.getElementById('schedule-task-form');
  if (scheduleForm) {
    scheduleForm.addEventListener('submit', handleScheduleTask);
  }
  
  // Create user form
  const createUserForm = document.getElementById('create-user-form');
  if (createUserForm) {
    createUserForm.addEventListener('submit', handleCreateUser);
  }
  
  // Create root admin form
  const createRootForm = document.getElementById('create-root-admin-form');
  if (createRootForm) {
    createRootForm.addEventListener('submit', handleCreateRootAdmin);
  }
  
  // Admin tabs
  const adminTabs = document.querySelectorAll('.admin-tab');
  adminTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      switchAdminTab(tabId);
    });
  });
  
  // Export buttons
  const exportJson = document.getElementById('export-json');
  const exportCsv = document.getElementById('export-csv');
  if (exportJson) exportJson.addEventListener('click', () => exportReport('json'));
  if (exportCsv) exportCsv.addEventListener('click', () => exportReport('csv'));
  
  // New inspiration button
  const newInspirationBtn = document.getElementById('new-inspiration');
  if (newInspirationBtn) {
    newInspirationBtn.addEventListener('click', loadDailyInspiration);
  }
}

// Handle login
async function handleLogin(e) {
  e.preventDefault();
  
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');
  
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      errorDiv.textContent = data.error || 'Login failed';
    }
  } catch (error) {
    errorDiv.textContent = 'Connection error. Please try again.';
  }
}

// Logout
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  token = null;
  currentUser = null;
  loginSection.style.display = 'block';
  mainApp.style.display = 'none';
}

// Show main app after login
function showMainApp() {
  loginSection.style.display = 'none';
  mainApp.style.display = 'block';
  
  // Update user display
  userDisplay.textContent = currentUser.fullName || currentUser.username;
  const roleClass = currentUser.role === 'root_admin' ? 'root' : currentUser.role;
  userRoleBadge.textContent = currentUser.role === 'root_admin' ? 'ሥር አስተዳዳሪ' : 
                               (currentUser.role === 'admin' ? 'አስተዳዳሪ' : 'ተጠቃሚ');
  userRoleBadge.className = `role-badge ${roleClass}`;
  
  // Show/hide admin elements based on role
  const adminElements = document.querySelectorAll('.admin-only');
  const rootElements = document.querySelectorAll('.root-only');
  
  adminElements.forEach(el => {
    if (currentUser.role === 'root_admin' || currentUser.role === 'admin') {
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  });
  
  rootElements.forEach(el => {
    if (currentUser.role === 'root_admin') {
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  });
  
  // Load initial data
  loadDashboard();
  loadTodayTasks();
  
  // Initialize calendar if needed
  initCalendar();
}

// Switch views
function switchView(view) {
  currentView = view;
  
  // Hide all views
  Object.values(views).forEach(v => {
    if (v) v.style.display = 'none';
  });
  
  // Show selected view
  if (views[view]) {
    views[view].style.display = 'block';
  }
  
  // Update nav active state
  navBtns.forEach(btn => {
    if (btn.dataset.view === view) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Load view-specific data
  switch(view) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'tasks':
      loadTasksForDate(new Date().toISOString().split('T')[0]);
      break;
    case 'calendar':
      if (currentUser.role === 'root_admin' || currentUser.role === 'admin') {
        loadScheduledTasks();
      }
      break;
    case 'admin':
      loadUsers();
      break;
    case 'analytics':
      if (currentUser.role === 'root_admin') {
        loadAnalytics();
      }
      break;
  }
}

// Load dashboard data
async function loadDashboard() {
  try {
    // Load stats
    const statsResponse = await fetch(`${API_BASE}/completions/my?date=${new Date().toISOString().split('T')[0]}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const completions = await statsResponse.json();
    const completedCount = completions.filter(c => c.completed).length;
    const totalTasks = 2; // Daily tasks
    
    const statsGrid = document.getElementById('stats-grid');
    statsGrid.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${completedCount}/${totalTasks}</div>
        <div class="stat-label">የዛሬ ሥራዎች</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${Math.round((completedCount / totalTasks) * 100) || 0}%</div>
        <div class="stat-label">ማጠናቀቅ</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${candleCount}</div>
        <div class="stat-label">የቀጣሉት ሻማዎች</div>
      </div>
    `;
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

// Load today's tasks
async function loadTodayTasks() {
  const date = new Date().toISOString().split('T')[0];
  await loadTasksForDate(date);
}

// Load tasks for a specific date
async function loadTasksForDate(date) {
  const container = document.getElementById('tasks-list-container') || document.getElementById('today-tasks-list');
  if (!container) return;
  
  try {
    // Load daily tasks
    const dailyResponse = await fetch(`${API_BASE}/tasks/daily`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const dailyTasks = await dailyResponse.json();
    
    // Load scheduled tasks for date
    const scheduledResponse = await fetch(`${API_BASE}/tasks/scheduled?date=${date}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const scheduledTasks = await scheduledResponse.json();
    
    // Load completions
    const completionsResponse = await fetch(`${API_BASE}/completions/my?date=${date}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const completions = await completionsResponse.json();
    
    // Combine tasks
    const allTasks = [
      ...dailyTasks.map(t => ({ ...t, type: 'daily', title: t.nameAmharic, icon: t.icon })),
      ...scheduledTasks.map(t => ({ ...t, type: 'scheduled', title: t.title, icon: '📅' }))
    ];
    
    // Render tasks
    container.innerHTML = allTasks.map(task => {
      const completion = completions.find(c => c.taskType === task.type && c.taskId === task.id);
      const isCompleted = completion?.completed || false;
      
      return `
        <div class="task-item ${isCompleted ? 'completed' : ''}" data-task-id="${task.id}" data-task-type="${task.type}">
          <div class="task-icon">${task.icon || '✠'}</div>
          <div class="task-content">
            <div class="task-title">${task.title}</div>
            ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
          </div>
          <input type="checkbox" class="task-checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleTaskCompletion('${task.id}', '${task.type}', '${date}', this.checked)">
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading tasks:', error);
    container.innerHTML = '<div class="error-message">ሥራዎችን ማምጣት አልተቻለም</div>';
  }
}

// Toggle task completion
window.toggleTaskCompletion = async function(taskId, taskType, date, completed) {
  try {
    const response = await fetch(`${API_BASE}/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ taskId, taskType, date, completed })
    });
    
    if (response.ok) {
      // Reload tasks to update UI
      await loadTasksForDate(date);
      loadDashboard();
      
      // Play completion effect
      if (completed) {
        playCompletionEffect();
      }
    }
  } catch (error) {
    console.error('Error toggling completion:', error);
  }
};

// Play completion effect
function playCompletionEffect() {
  // Create halo effect
  const activeTask = document.querySelector('.task-checkbox:checked');
  if (activeTask) {
    const taskItem = activeTask.closest('.task-item');
    taskItem.style.animation = 'halo-glow 0.5s ease';
    setTimeout(() => {
      taskItem.style.animation = '';
    }, 500);
  }
  
  // Optional: Play sound (if user has interacted)
  // This is commented out to avoid autoplay restrictions
  // const audio = new Audio('/sounds/chime.mp3');
  // audio.play().catch(e => console.log('Audio play failed'));
}

// Candle lighting
function setupCandle() {
  const candle = document.getElementById('prayer-candle');
  const flame = document.getElementById('candle-flame');
  const candleCountSpan = document.getElementById('candle-count');
  
  candleCountSpan.textContent = candleCount;
  
  candle.addEventListener('click', () => {
    candleCount++;
    candleCountSpan.textContent = candleCount;
    localStorage.setItem('candleCount', candleCount);
    
    // Light flame effect
    flame.classList.add('lit');
    setTimeout(() => {
      flame.classList.remove('lit');
    }, 1000);
    
    // Optional: Record to server
    fetch(`${API_BASE}/candles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ count: 1 })
    }).catch(e => console.log('Candle record failed'));
  });
}

// Load daily inspiration
async function loadDailyInspiration() {
  const inspirationText = document.getElementById('inspiration-text');
  const inspirationSource = document.getElementById('inspiration-source');
  
  if (!inspirationText) return;
  
  try {
    const response = await fetch(`${API_BASE}/inspiration/random`);
    const data = await response.json();
    
    inspirationText.textContent = data.text;
    inspirationSource.textContent = data.source;
    
    // Animation
    inspirationText.style.opacity = '0';
    setTimeout(() => {
      inspirationText.style.transition = 'opacity 0.5s';
      inspirationText.style.opacity = '1';
    }, 10);
  } catch (error) {
    console.error('Error loading inspiration:', error);
  }
}

// Initialize calendar
let calendar = null;
function initCalendar() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;
  
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,dayGridWeek'
    },
    dateClick: function(info) {
      document.getElementById('task-date').value = info.dateStr;
    },
    events: async function(info, successCallback, failureCallback) {
      try {
        const response = await fetch(`${API_BASE}/tasks/scheduled`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const tasks = await response.json();
        
        const events = tasks.map(task => ({
          title: task.title,
          start: task.date,
          allDay: true,
          extendedProps: { description: task.description, id: task.id }
        }));
        
        successCallback(events);
      } catch (error) {
        failureCallback(error);
      }
    }
  });
  
  calendar.render();
}

// Load scheduled tasks for admin view
async function loadScheduledTasks() {
  const container = document.getElementById('scheduled-tasks-list');
  if (!container) return;
  
  try {
    const response = await fetch(`${API_BASE}/tasks/scheduled`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const tasks = await response.json();
    
    if (tasks.length === 0) {
      container.innerHTML = '<div class="empty-state">ምንም የታቀዱ ሥራዎች የሉም</div>';
      return;
    }
    
    container.innerHTML = tasks.map(task => `
      <div class="task-item">
        <div class="task-icon">📅</div>
        <div class="task-content">
          <div class="task-title">${task.title}</div>
          <div class="task-description">${task.description || 'ምንም መግለጫ የለም'}</div>
          <div class="task-date">📆 ${task.date}</div>
        </div>
        <button class="btn-small" onclick="deleteTask('${task.id}')"><i class="fas fa-trash"></i></button>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading scheduled tasks:', error);
  }
}

// Handle schedule task
async function handleScheduleTask(e) {
  e.preventDefault();
  
  const title = document.getElementById('task-title').value;
  const description = document.getElementById('task-description').value;
  const date = document.getElementById('task-date').value;
  
  try {
    const response = await fetch(`${API_BASE}/tasks/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title, description, date })
    });
    
    if (response.ok) {
      alert('ሥራው በሚገባ ተመዝግቧል');
      document.getElementById('schedule-task-form').reset();
      loadScheduledTasks();
      if (calendar) calendar.refetchEvents();
    } else {
      const error = await response.json();
      alert('ስህተት: ' + (error.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error scheduling task:', error);
    alert('ሥራውን ማስያዝ አልተቻለም');
  }
}

// Delete task
window.deleteTask = async function(taskId) {
  if (!confirm('ይህን ሥራ መሰረዝ እንደሚፈልጉ እርግጠኛ ነዎት?')) return;
  
  try {
    const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      loadScheduledTasks();
      if (calendar) calendar.refetchEvents();
    }
  } catch (error) {
    console.error('Error deleting task:', error);
  }
};

// Load users for admin panel
async function loadUsers() {
  const container = document.getElementById('users-list');
  if (!container) return;
  
  try {
    const response = await fetch(`${API_BASE}/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const users = await response.json();
    
    container.innerHTML = users.map(user => `
      <div class="user-card">
        <div class="user-info">
          <div class="user-name">${user.fullName || user.username}</div>
          <div class="user-role ${user.role === 'root_admin' ? 'root' : user.role}">
            ${user.role === 'root_admin' ? 'ሥር አስተዳዳሪ' : (user.role === 'admin' ? 'አስተዳዳሪ' : 'ተጠቃሚ')}
          </div>
          <div class="user-username">@${user.username}</div>
        </div>
        <div class="user-actions">
          <button class="action-btn reset" onclick="resetUserPassword('${user.id}')" title="የይለፍ ቃል መቀየር">
            <i class="fas fa-key"></i>
          </button>
          ${currentUser.role === 'root_admin' && user.id !== currentUser.id ? `
            <button class="action-btn delete" onclick="deleteUser('${user.id}')" title="ተጠቃሚ መሰረዝ">
              <i class="fas fa-trash"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

// Reset user password
window.resetUserPassword = async function(userId) {
  const newPassword = prompt('አዲስ የይለፍ ቃል ያስገቡ (ቢያንስ 6 ፊደላት)');
  if (!newPassword || newPassword.length < 6) {
    alert('የይለፍ ቃል ቢያንስ 6 ፊደላት መሆን አለበት');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/users/${userId}/reset-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ newPassword })
    });
    
    if (response.ok) {
      alert('የይለፍ ቃል በሚገባ ተቀይሯል');
    } else {
      const error = await response.json();
      alert('ስህተት: ' + (error.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error resetting password:', error);
  }
};

// Delete user
window.deleteUser = async function(userId) {
  if (!confirm('ይህን ተጠቃሚ መሰረዝ እንደሚፈልጉ እርግጠኛ ነዎት? ይህ ድርጊት ሊቀለበስ አይችልም')) return;
  
  try {
    const response = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      alert('ተጠቃሚው ተሰርዟል');
      loadUsers();
    } else {
      const error = await response.json();
      alert('ስህተት: ' + (error.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error deleting user:', error);
  }
};

// Handle create user
async function handleCreateUser(e) {
  e.preventDefault();
  
  const username = document.getElementById('new-username').value;
  const password = document.getElementById('new-password').value;
  const fullName = document.getElementById('new-fullname').value;
  const role = document.getElementById('new-role').value;
  
  try {
    const response = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ username, password, fullName, role })
    });
    
    if (response.ok) {
      alert('ተጠቃሚው በሚገባ ተፈጥሯል');
      document.getElementById('create-user-form').reset();
      loadUsers();
    } else {
      const error = await response.json();
      alert('ስህተት: ' + (error.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error creating user:', error);
  }
}

// Handle create root admin
async function handleCreateRootAdmin(e) {
  e.preventDefault();
  
  const username = document.getElementById('root-username').value;
  const password = document.getElementById('root-password').value;
  const fullName = document.getElementById('root-fullname').value;
  const rootAdminBadge = document.getElementById('root-badge').value;
  
  try {
    const response = await fetch(`${API_BASE}/users/root`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ username, password, fullName, rootAdminBadge })
    });
    
    if (response.ok) {
      alert('ሥር አስተዳዳሪ በሚገባ ተፈጥሯል');
      document.getElementById('create-root-admin-form').reset();
      loadUsers();
    } else {
      const error = await response.json();
      alert('ስህተት: ' + (error.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error creating root admin:', error);
  }
}

// Switch admin tabs
function switchAdminTab(tabId) {
  const tabs = document.querySelectorAll('.admin-tab-content');
  const tabBtns = document.querySelectorAll('.admin-tab');
  
  tabs.forEach(tab => tab.style.display = 'none');
  tabBtns.forEach(btn => btn.classList.remove('active'));
  
  const activeTab = document.getElementById(`${tabId}-tab`);
  if (activeTab) activeTab.style.display = 'block';
  
  const activeBtn = Array.from(tabBtns).find(btn => btn.dataset.tab === tabId);
  if (activeBtn) activeBtn.classList.add('active');
  
  if (tabId === 'audit') {
    loadAuditLogs();
  }
}

// Load audit logs
let auditOffset = 0;
async function loadAuditLogs() {
  const container = document.getElementById('audit-logs-container');
  if (!container) return;
  
  try {
    const response = await fetch(`${API_BASE}/audit?limit=20&offset=${auditOffset}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    
    if (auditOffset === 0) {
      container.innerHTML = '';
    }
    
    data.logs.forEach(log => {
      const logEntry = document.createElement('div');
      logEntry.className = 'audit-entry';
      logEntry.innerHTML = `
        <i class="fas fa-${getAuditIcon(log.action)} audit-icon"></i>
        <strong>${new Date(log.timestamp).toLocaleString()}</strong> - 
        ${log.performerUsername} ${getAuditActionText(log.action)} 
        ${log.targetUsername ? log.targetUsername : ''}
        ${log.details ? '<br><small>' + JSON.stringify(log.details) + '</small>' : ''}
      `;
      container.appendChild(logEntry);
    });
    
    const loadMoreBtn = document.getElementById('load-more-audit');
    if (loadMoreBtn) {
      if (data.logs.length < 20) {
        loadMoreBtn.style.display = 'none';
      } else {
        loadMoreBtn.style.display = 'block';
        loadMoreBtn.onclick = () => {
          auditOffset += 20;
          loadAuditLogs();
        };
      }
    }
  } catch (error) {
    console.error('Error loading audit logs:', error);
  }
}

function getAuditIcon(action) {
  const icons = {
    user_create: 'user-plus',
    user_delete: 'user-minus',
    password_reset: 'key',
    task_schedule: 'calendar-plus',
    task_delete: 'calendar-minus'
  };
  return icons[action] || 'info-circle';
}

function getAuditActionText(action) {
  const texts = {
    user_create: 'አዲስ ተጠቃሚ ፈጠረ',
    user_delete: 'ተጠቃሚ ሰረዘ',
    password_reset: 'የይለፍ ቃል ቀየረ',
    task_schedule: 'አዲስ ሥራ አስያዘ',
    task_delete: 'ሥራ ሰረዘ'
  };
  return texts[action] || 'ድርጊት ፈጸመ';
}

// Load analytics (root admin only)
async function loadAnalytics() {
  try {
    const overviewResponse = await fetch(`${API_BASE}/analytics/overview`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const overview = await overviewResponse.json();
    
    const trendsResponse = await fetch(`${API_BASE}/analytics/trends?period=week`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const trends = await trendsResponse.json();
    
    // Update summary stats
    document.getElementById('overall-percentage').textContent = `${overview.overallCompletion.percentage}%`;
    document.getElementById('total-members').textContent = overview.totalUsers;
    
    const streakCount = overview.userProgress.filter(u => u.streakDays >= 7).length;
    document.getElementById('streak-count').textContent = streakCount;
    
    // Render user progress list
    const progressList = document.getElementById('user-progress-list');
    progressList.innerHTML = overview.userProgress.map(user => `
      <div class="progress-item">
        <div class="progress-header">
          <span>${user.fullName || user.username}</span>
          <span class="streak-badge">${user.streakDays} ቀን ተከታታይ</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${user.completionPercentage}%"></div>
        </div>
        <div class="progress-percentage">${user.completionPercentage}% ማጠናቀቅ</div>
      </div>
    `).join('');
    
    // Update chart
    if (trendsChart) {
      trendsChart.destroy();
    }
    
    const ctx = document.getElementById('trends-chart').getContext('2d');
    trendsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: trends.dates.map(d => new Date(d).toLocaleDateString()),
        datasets: [{
          label: 'የተጠናቀቁ ሥራዎች',
          data: trends.trends,
          borderColor: '#C9A03D',
          backgroundColor: 'rgba(201, 160, 61, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: { color: '#F0E68C' }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(201, 160, 61, 0.2)' }
          },
          x: {
            grid: { color: 'rgba(201, 160, 61, 0.2)' }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading analytics:', error);
  }
}

// Export report
async function exportReport(format) {
  try {
    const response = await fetch(`${API_BASE}/analytics/export?format=${format}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family-report.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting report:', error);
  }
}
