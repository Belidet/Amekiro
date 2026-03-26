// Family Reminder Tracker - Main Application
let currentUser = null;
let token = null;

// API Configuration - Automatically detects environment
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '' // Use relative paths for local development
  : ''; // Use relative paths for production (since API is on same domain)

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    if (response.status === 401 || response.status === 403) {
      // Token expired or invalid
      if (currentUser) {
        logout();
      }
      throw new Error('Authentication failed');
    }
    
    return response;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

// DOM Elements
const loginSection = document.getElementById('login-section');
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const userDisplay = document.getElementById('user-name-display');
const userRoleBadge = document.getElementById('user-role-badge');

// Check authentication on load
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupEventListeners();
  setupCandle();
  setupPasswordToggles();
});

// Setup password toggle functionality
function setupPasswordToggles() {
  const toggleButtons = document.querySelectorAll('.toggle-password');
  
  toggleButtons.forEach(button => {
    // Remove existing listeners to avoid duplicates
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    
    newButton.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const targetId = this.getAttribute('data-target');
      const passwordInput = document.getElementById(targetId);
      const icon = this.querySelector('i');
      
      if (passwordInput) {
        const currentType = passwordInput.getAttribute('type');
        const newType = currentType === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', newType);
        
        if (icon) {
          if (newType === 'text') {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
          } else {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
          }
        }
        
        // Visual feedback
        this.style.transform = 'translateY(-50%) scale(0.95)';
        setTimeout(() => {
          this.style.transform = 'translateY(-50%) scale(1)';
        }, 150);
        
        passwordInput.focus();
      }
    });
  });
}

async function checkAuth() {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  
  if (storedToken && storedUser) {
    token = storedToken;
    currentUser = JSON.parse(storedUser);
    
    try {
      const response = await apiCall('/api/auth/me');
      
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

function setupEventListeners() {
  loginForm.addEventListener('submit', handleLogin);
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  
  // Navigation
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) switchView(view);
    });
  });
  
  // New inspiration button
  const newInspirationBtn = document.getElementById('new-inspiration');
  if (newInspirationBtn) {
    newInspirationBtn.addEventListener('click', loadDailyInspiration);
  }
  
  // Task date selector
  const taskDateSelector = document.getElementById('task-date-selector');
  if (taskDateSelector) {
    taskDateSelector.value = new Date().toISOString().split('T')[0];
    taskDateSelector.addEventListener('change', () => loadTasksForDate(taskDateSelector.value));
  }
  
  // Admin tabs
  const adminTabs = document.querySelectorAll('.admin-tab');
  adminTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchAdminTab(tabName);
    });
  });
  
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
  
  // Schedule task form
  const scheduleTaskForm = document.getElementById('schedule-task-form');
  if (scheduleTaskForm) {
    scheduleTaskForm.addEventListener('submit', handleScheduleTask);
  }
  
  // Export buttons
  const exportJsonBtn = document.getElementById('export-json');
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => exportData('json'));
  }
  
  const exportCsvBtn = document.getElementById('export-csv');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => exportData('csv'));
  }
  
  // MutationObserver for dynamically added content
  const observer = new MutationObserver(() => {
    setupPasswordToggles();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

async function handleLogin(e) {
  e.preventDefault();
  
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');
  
  errorDiv.textContent = '';
  
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
      errorDiv.textContent = data.error || 'Invalid username or password';
    }
  } catch (error) {
    console.error('Login error:', error);
    errorDiv.textContent = 'Connection error. Please try again.';
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  token = null;
  currentUser = null;
  loginSection.style.display = 'block';
  mainApp.style.display = 'none';
  
  // Reset password fields
  const passwordInputs = document.querySelectorAll('#login-password, #new-password, #root-password');
  passwordInputs.forEach(input => {
    if (input.getAttribute('type') === 'text') {
      input.setAttribute('type', 'password');
    }
  });
  
  const toggleButtons = document.querySelectorAll('.toggle-password');
  toggleButtons.forEach(button => {
    const icon = button.querySelector('i');
    if (icon) {
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
  });
}

function showMainApp() {
  loginSection.style.display = 'none';
  mainApp.style.display = 'block';
  
  userDisplay.textContent = currentUser.fullName || currentUser.username;
  const roleClass = currentUser.role === 'root_admin' ? 'root' : currentUser.role;
  userRoleBadge.textContent = currentUser.role === 'root_admin' ? 'ሥር አስተዳዳሪ' : 
                               (currentUser.role === 'admin' ? 'አስተዳዳሪ' : 'ተጠቃሚ');
  userRoleBadge.className = `role-badge ${roleClass}`;
  
  // Show/hide admin elements
  const adminElements = document.querySelectorAll('.admin-only');
  adminElements.forEach(el => {
    if (currentUser.role === 'root_admin' || currentUser.role === 'admin') {
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  });
  
  const rootElements = document.querySelectorAll('.root-only');
  rootElements.forEach(el => {
    if (currentUser.role === 'root_admin') {
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  });
  
  // Re-setup password toggles
  setTimeout(() => {
    setupPasswordToggles();
  }, 100);
  
  // Load initial data
  loadDashboard();
  loadTodayTasks();
  loadDailyInspiration();
  
  // Load admin data if user is admin
  if (currentUser.role === 'admin' || currentUser.role === 'root_admin') {
    loadUsersList();
  }
}

function switchView(view) {
  const views = {
    dashboard: document.getElementById('dashboard-view'),
    tasks: document.getElementById('tasks-view'),
    calendar: document.getElementById('calendar-view'),
    admin: document.getElementById('admin-view'),
    analytics: document.getElementById('analytics-view')
  };
  
  Object.values(views).forEach(v => {
    if (v) v.style.display = 'none';
  });
  
  if (views[view]) views[view].style.display = 'block';
  
  // Update nav active state
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if (btn.dataset.view === view) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  if (view === 'tasks') {
    loadTasksForDate(new Date().toISOString().split('T')[0]);
  }
  
  if (view === 'admin') {
    loadUsersList();
    setTimeout(() => setupPasswordToggles(), 100);
  }
  
  if (view === 'analytics' && (currentUser.role === 'admin' || currentUser.role === 'root_admin')) {
    loadAnalytics();
  }
}

function switchAdminTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    }
  });
  
  // Show/hide tab content
  const tabs = ['users', 'create', 'create-root', 'audit'];
  tabs.forEach(tab => {
    const element = document.getElementById(`${tab}-tab`);
    if (element) {
      element.style.display = tab === tabName ? 'block' : 'none';
    }
  });
  
  if (tabName === 'audit') {
    loadAuditLogs();
  }
}

async function loadDashboard() {
  try {
    const date = new Date().toISOString().split('T')[0];
    const response = await apiCall(`/api/completions?date=${date}`);
    const completions = await response.json();
    const completedCount = completions.filter(c => c.completed).length;
    const totalTasks = 2;
    
    const statsGrid = document.getElementById('stats-grid');
    if (statsGrid) {
      statsGrid.innerHTML = `
        <div class="stat-card">
          <div class="stat-value">${completedCount}/${totalTasks}</div>
          <div class="stat-label">የዛሬ ሥራዎች</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${Math.round((completedCount / totalTasks) * 100) || 0}%</div>
          <div class="stat-label">ማጠናቀቅ</div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

async function loadTodayTasks() {
  const date = new Date().toISOString().split('T')[0];
  await loadTasksForDate(date);
}

async function loadTasksForDate(date) {
  const container = document.getElementById('tasks-list-container') || document.getElementById('today-tasks-list');
  if (!container) return;
  
  try {
    const dailyResponse = await apiCall('/api/tasks/daily');
    const dailyTasks = await dailyResponse.json();
    
    const completionsResponse = await apiCall(`/api/completions?date=${date}`);
    const completions = await completionsResponse.json();
    
    container.innerHTML = dailyTasks.map(task => {
      const completion = completions.find(c => c.taskType === 'daily' && c.taskId === task.id);
      const isCompleted = completion?.completed || false;
      
      return `
        <div class="task-item ${isCompleted ? 'completed' : ''}" data-task-id="${task.id}" data-task-type="daily">
          <div class="task-icon">${task.icon || '✠'}</div>
          <div class="task-content">
            <div class="task-title">${task.nameAmharic || task.name}</div>
            ${task.descriptionAmharic ? `<div class="task-description">${task.descriptionAmharic}</div>` : ''}
          </div>
          <input type="checkbox" class="task-checkbox" ${isCompleted ? 'checked' : ''} 
                 onchange="toggleTaskCompletion('${task.id}', 'daily', '${date}', this.checked)">
        </div>
      `;
    }).join('');
    
    setupPasswordToggles();
    
  } catch (error) {
    console.error('Error loading tasks:', error);
    container.innerHTML = '<div class="error-message">ሥራዎችን ማምጣት አልተቻለም</div>';
  }
}

window.toggleTaskCompletion = async function(taskId, taskType, date, completed) {
  try {
    const response = await apiCall('/api/completions', {
      method: 'POST',
      body: JSON.stringify({ taskId, taskType, date, completed })
    });
    
    if (response.ok) {
      await loadTasksForDate(date);
      loadDashboard();
      
      if (completed) {
        const taskItem = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (taskItem) {
          taskItem.style.animation = 'halo-glow 0.5s ease';
          setTimeout(() => {
            taskItem.style.animation = '';
          }, 500);
        }
      }
    }
  } catch (error) {
    console.error('Error toggling completion:', error);
  }
};

async function loadDailyInspiration() {
  const inspirationText = document.getElementById('inspiration-text');
  const inspirationSource = document.getElementById('inspiration-source');
  
  if (!inspirationText) return;
  
  try {
    const response = await apiCall('/api/inspiration/random');
    const data = await response.json();
    
    inspirationText.textContent = data.text;
    inspirationSource.textContent = data.source;
    
    inspirationText.style.opacity = '0';
    setTimeout(() => {
      inspirationText.style.transition = 'opacity 0.5s';
      inspirationText.style.opacity = '1';
    }, 10);
  } catch (error) {
    console.error('Error loading inspiration:', error);
  }
}

async function loadUsersList() {
  const usersList = document.getElementById('users-list');
  if (!usersList) return;
  
  try {
    const response = await apiCall('/api/users');
    const users = await response.json();
    
    usersList.innerHTML = users.map(user => `
      <div class="user-card">
        <div class="user-info">
          <div class="user-name">${user.fullName || user.username}</div>
          <div class="user-role ${user.role}">${user.role === 'root_admin' ? 'ሥር አስተዳዳሪ' : user.role === 'admin' ? 'አስተዳዳሪ' : 'ተጠቃሚ'}</div>
          <div class="user-username">@${user.username}</div>
        </div>
        <div class="user-actions">
          ${user.id !== currentUser?.id ? `<button class="action-btn delete" onclick="deleteUser('${user.id}')"><i class="fas fa-trash"></i></button>` : ''}
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

window.deleteUser = async function(userId) {
  if (!confirm('Are you sure you want to delete this user?')) return;
  
  try {
    const response = await apiCall(`/api/users/${userId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      loadUsersList();
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to delete user');
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    alert('Failed to delete user');
  }
};

async function handleCreateUser(e) {
  e.preventDefault();
  
  const username = document.getElementById('new-username').value;
  const password = document.getElementById('new-password').value;
  const fullName = document.getElementById('new-fullname').value;
  const role = document.getElementById('new-role').value;
  
  try {
    const response = await apiCall('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, fullName, role })
    });
    
    if (response.ok) {
      alert('User created successfully!');
      document.getElementById('create-user-form').reset();
      loadUsersList();
      // Switch to users tab
      switchAdminTab('users');
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to create user');
    }
  } catch (error) {
    console.error('Error creating user:', error);
    alert('Failed to create user');
  }
}

async function handleCreateRootAdmin(e) {
  e.preventDefault();
  
  const username = document.getElementById('root-username').value;
  const password = document.getElementById('root-password').value;
  const fullName = document.getElementById('root-fullname').value;
  const badge = document.getElementById('root-badge').value;
  
  try {
    const response = await apiCall('/api/users', {
      method: 'POST',
      body: JSON.stringify({ 
        username, 
        password, 
        fullName: fullName || username, 
        role: 'root_admin',
        badge 
      })
    });
    
    if (response.ok) {
      alert('Root admin created successfully!');
      document.getElementById('create-root-admin-form').reset();
      loadUsersList();
      switchAdminTab('users');
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to create root admin');
    }
  } catch (error) {
    console.error('Error creating root admin:', error);
    alert('Failed to create root admin');
  }
}

async function handleScheduleTask(e) {
  e.preventDefault();
  
  const title = document.getElementById('task-title').value;
  const description = document.getElementById('task-description').value;
  const date = document.getElementById('task-date').value;
  
  try {
    const response = await apiCall('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ 
        name: title,
        nameAmharic: title,
        description,
        type: 'scheduled',
        date
      })
    });
    
    if (response.ok) {
      alert('Task scheduled successfully!');
      document.getElementById('schedule-task-form').reset();
      loadScheduledTasks();
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to schedule task');
    }
  } catch (error) {
    console.error('Error scheduling task:', error);
    alert('Failed to schedule task');
  }
}

async function loadScheduledTasks() {
  const container = document.getElementById('scheduled-tasks-list');
  if (!container) return;
  
  try {
    const response = await apiCall('/api/tasks');
    const tasks = await response.json();
    const scheduledTasks = tasks.filter(t => t.type === 'scheduled');
    
    container.innerHTML = scheduledTasks.map(task => `
      <div class="task-item">
        <div class="task-content">
          <div class="task-title">${task.nameAmharic || task.name}</div>
          <div class="task-description">${task.description || ''}</div>
          <div class="task-date">📅 ${task.date || 'No date'}</div>
        </div>
        <button class="btn-small" onclick="deleteTask('${task.id}')">Delete</button>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading scheduled tasks:', error);
  }
}

window.deleteTask = async function(taskId) {
  if (!confirm('Are you sure you want to delete this task?')) return;
  
  try {
    const response = await apiCall(`/api/tasks/${taskId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      loadScheduledTasks();
    } else {
      alert('Failed to delete task');
    }
  } catch (error) {
    console.error('Error deleting task:', error);
    alert('Failed to delete task');
  }
};

async function loadAnalytics() {
  try {
    const response = await apiCall('/api/analytics');
    const data = await response.json();
    
    // Update stats
    document.getElementById('overall-percentage').textContent = `${Math.round(data.overall.completionRate)}%`;
    document.getElementById('total-members').textContent = data.overall.totalUsers;
    
    // Calculate streak count (users with >7 day streak)
    const streakCount = data.userProgress.filter(u => u.streak >= 7).length;
    document.getElementById('streak-count').textContent = streakCount;
    
    // Update user progress list
    const userProgressList = document.getElementById('user-progress-list');
    userProgressList.innerHTML = data.userProgress.map(user => `
      <div class="progress-item">
        <div class="progress-header">
          <span>${user.fullName || user.username}</span>
          <span>${Math.round(user.percentage)}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${user.percentage}%"></div>
        </div>
        ${user.streak > 0 ? `<div class="streak-badge">🔥 ${user.streak} day streak</div>` : ''}
      </div>
    `).join('');
    
    // Create chart
    const ctx = document.getElementById('trends-chart').getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.userProgress.map(u => u.username),
        datasets: [{
          label: 'Completion Rate (%)',
          data: data.userProgress.map(u => u.percentage),
          backgroundColor: 'rgba(201, 160, 61, 0.6)',
          borderColor: '#C9A03D',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading analytics:', error);
  }
}

async function loadAuditLogs() {
  const container = document.getElementById('audit-logs-container');
  if (!container) return;
  
  try {
    const response = await apiCall('/api/audit');
    const data = await response.json();
    
    container.innerHTML = data.logs.map(log => `
      <div class="audit-entry">
        <i class="fas fa-history audit-icon"></i>
        <strong>${new Date(log.timestamp).toLocaleString()}</strong><br>
        User ${log.userId} performed: ${log.action} on ${log.target || 'unknown'}
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading audit logs:', error);
  }
}

async function exportData(format) {
  try {
    const response = await apiCall('/api/analytics');
    const data = await response.json();
    
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `family-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'csv') {
      // Convert to CSV
      const headers = ['Username', 'Full Name', 'Completion Rate (%)', 'Streak'];
      const rows = data.userProgress.map(u => [
        u.username,
        u.fullName,
        u.percentage,
        u.streak
      ]);
      
      const csvContent = [headers, ...rows]
        .map(row => row.join(','))
        .join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `family-tracker-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    alert('Failed to export data');
  }
}

// Candle feature
let candleCount = parseInt(localStorage.getItem('candleCount') || '0');

function setupCandle() {
  const candle = document.getElementById('prayer-candle');
  const flame = document.getElementById('candle-flame');
  const candleCountSpan = document.getElementById('candle-count');
  
  if (candleCountSpan) candleCountSpan.textContent = candleCount;
  
  if (candle) {
    candle.addEventListener('click', () => {
      candleCount++;
      if (candleCountSpan) candleCountSpan.textContent = candleCount;
      localStorage.setItem('candleCount', candleCount);
      
      if (flame) {
        flame.classList.add('lit');
        setTimeout(() => {
          flame.classList.remove('lit');
        }, 1000);
      }
    });
  }
}
