// Family Reminder Tracker - Main Application
let currentUser = null;
let token = null;
let authChecked = false;

// DOM Elements
const loginSection = document.getElementById('login-section');
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const userDisplay = document.getElementById('user-name-display');
const userRoleBadge = document.getElementById('user-role-badge');

// API Configuration
const API_BASE_URL = '';

// Helper function for API calls with timeout and retry
async function apiCall(endpoint, options = {}, retries = 2) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.status === 401 || response.status === 403) {
        if (currentUser) {
          logout();
        }
        throw new Error('Authentication failed');
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.warn(`API call timeout (attempt ${attempt + 1}):`, endpoint);
        if (attempt === retries) {
          throw new Error('Request timeout - server may be slow');
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

// DOM Elements check
function checkElementsExist() {
  const required = ['login-section', 'main-app', 'login-form'];
  const missing = required.filter(id => !document.getElementById(id));
  if (missing.length) {
    console.error('Missing required elements:', missing);
    return false;
  }
  return true;
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  console.log('App starting...');
  
  // Check if all elements exist
  if (!checkElementsExist()) {
    console.error('Critical elements missing!');
    return;
  }
  
  // Show login section immediately
  loginSection.style.display = 'block';
  mainApp.style.display = 'none';
  
  // Setup password toggles
  setupPasswordToggles();
  
  // Setup event listeners
  setupEventListeners();
  setupCandle();
  
  // Add a status message
  const statusDiv = document.getElementById('login-status');
  if (statusDiv) {
    statusDiv.innerHTML = '🔄 Connecting to server...';
    statusDiv.style.color = '#C9A03D';
  }
  
  // Check authentication with timeout (don't block UI)
  setTimeout(async () => {
    try {
      await checkAuth();
    } catch (error) {
      console.error('Auth check error:', error);
      if (statusDiv) {
        statusDiv.innerHTML = '⚠️ Server connection slow - you can still login';
        statusDiv.style.color = '#C9A03D';
        setTimeout(() => {
          if (statusDiv.innerHTML.includes('slow')) {
            statusDiv.innerHTML = '';
          }
        }, 5000);
      }
    } finally {
      authChecked = true;
    }
  }, 100);
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
  
  if (!storedToken || !storedUser) {
    console.log('No stored auth, showing login');
    return;
  }
  
  token = storedToken;
  currentUser = JSON.parse(storedUser);
  
  try {
    console.log('Verifying auth with server...');
    const response = await apiCall('/api/auth/me');
    
    if (response.ok) {
      const user = await response.json();
      currentUser = user;
      showMainApp();
      console.log('Auth verified, showing main app');
    } else {
      console.log('Auth invalid, logging out');
      logout();
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    // Don't logout on network error - keep showing login
    // but clear potentially invalid token
    if (error.message.includes('401') || error.message.includes('403')) {
      logout();
    }
  }
}

function setupEventListeners() {
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
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
  const submitButton = loginForm.querySelector('button[type="submit"]');
  const statusDiv = document.getElementById('login-status');
  
  if (!username || !password) {
    errorDiv.textContent = 'Please enter username and password';
    return;
  }
  
  errorDiv.textContent = '';
  
  // Disable button and show loading
  submitButton.disabled = true;
  const originalButtonText = submitButton.innerHTML;
  submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
  
  if (statusDiv) {
    statusDiv.innerHTML = '🔄 Logging in...';
    statusDiv.style.color = '#C9A03D';
  }
  
  try {
    console.log('Attempting login for:', username);
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
      
      if (statusDiv) {
        const roleText = currentUser.role === 'root_admin' ? '👑 Welcome, Administrator!' : '✅ Login successful!';
        statusDiv.innerHTML = roleText;
        statusDiv.style.color = '#2E5A2E';
      }
      
      showMainApp();
    } else {
      errorDiv.textContent = data.error || 'Invalid username or password';
      if (statusDiv) {
        statusDiv.innerHTML = '❌ ' + (data.error || 'Login failed');
        statusDiv.style.color = '#C41E3A';
      }
    }
  } catch (error) {
    console.error('Login error:', error);
    errorDiv.textContent = 'Connection error: ' + (error.message || 'Please try again');
    if (statusDiv) {
      statusDiv.innerHTML = '⚠️ Connection error - please retry';
      statusDiv.style.color = '#C41E3A';
    }
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = originalButtonText;
    
    // Clear status after delay
    setTimeout(() => {
      if (statusDiv && statusDiv.innerHTML.includes('error')) {
        statusDiv.innerHTML = '';
      }
    }, 3000);
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  token = null;
  currentUser = null;
  loginSection.style.display = 'block';
  mainApp.style.display = 'none';
  
  // Clear any loading states
  const statusDiv = document.getElementById('login-status');
  if (statusDiv) {
    statusDiv.innerHTML = '👋 Logged out';
    statusDiv.style.color = '#2E5A2E';
    setTimeout(() => {
      if (statusDiv.innerHTML === '👋 Logged out') {
        statusDiv.innerHTML = '';
      }
    }, 2000);
  }
  
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
  
  if (currentUser) {
    if (userDisplay) userDisplay.textContent = currentUser.fullName || currentUser.username;
    const roleClass = currentUser.role === 'root_admin' ? 'root' : currentUser.role;
    if (userRoleBadge) {
      userRoleBadge.textContent = currentUser.role === 'root_admin' ? 'ሥር አስተዳዳሪ' : 
                                   (currentUser.role === 'admin' ? 'አስተዳዳሪ' : 'ተጠቃሚ');
      userRoleBadge.className = `role-badge ${roleClass}`;
    }
  }
  
  // Show/hide admin elements
  const adminElements = document.querySelectorAll('.admin-only');
  adminElements.forEach(el => {
    if (currentUser && (currentUser.role === 'root_admin' || currentUser.role === 'admin')) {
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  });
  
  const rootElements = document.querySelectorAll('.root-only');
  rootElements.forEach(el => {
    if (currentUser && currentUser.role === 'root_admin') {
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  });
  
  // Re-setup password toggles
  setTimeout(() => {
    setupPasswordToggles();
  }, 100);
  
  // Load initial data (non-blocking)
  loadDashboard();
  loadTodayTasks();
  loadDailyInspiration();
  
  // Load admin data if user is admin
  if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'root_admin')) {
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
  
  if (view === 'analytics' && currentUser && (currentUser.role === 'admin' || currentUser.role === 'root_admin')) {
    loadAnalytics();
  }
}

function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    }
  });
  
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
  if (!token) return;
  
  const statsGrid = document.getElementById('stats-grid');
  if (!statsGrid) return;
  
  try {
    const date = new Date().toISOString().split('T')[0];
    const response = await apiCall(`/api/completions?date=${date}`);
    const completions = await response.json();
    const completedCount = completions.filter(c => c.completed).length;
    const totalTasks = 2;
    
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
  } catch (error) {
    console.error('Error loading dashboard:', error);
    statsGrid.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">0/2</div>
        <div class="stat-label">የዛሬ ሥራዎች</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">0%</div>
        <div class="stat-label">ማጠናቀቅ</div>
      </div>
    `;
  }
}

async function loadTodayTasks() {
  const date = new Date().toISOString().split('T')[0];
  await loadTasksForDate(date);
}

async function loadTasksForDate(date) {
  const container = document.getElementById('tasks-list-container') || document.getElementById('today-tasks-list');
  if (!container || !token) return;
  
  try {
    const dailyResponse = await apiCall('/api/tasks');
    const dailyTasks = await dailyResponse.json();
    
    const completionsResponse = await apiCall(`/api/completions?date=${date}`);
    const completions = await completionsResponse.json();
    
    if (!dailyTasks || dailyTasks.length === 0) {
      container.innerHTML = '<div class="task-item">No tasks available</div>';
      return;
    }
    
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
                 onchange="window.toggleTaskCompletion('${task.id}', 'daily', '${date}', this.checked)">
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
  if (!token) return;
  
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
    const response = await apiCall('/api/inspiration');
    const data = await response.json();
    
    inspirationText.textContent = data.text || "እግዚአብሔር ፍቅር ነው።";
    inspirationSource.textContent = data.source || "1 ዮሐንስ 4:8";
  } catch (error) {
    console.error('Error loading inspiration:', error);
    inspirationText.textContent = "እግዚአብሔር ፍቅር ነው።";
    inspirationSource.textContent = "1 ዮሐንስ 4:8";
  }
}

async function loadUsersList() {
  const usersList = document.getElementById('users-list');
  if (!usersList || !token) return;
  
  try {
    const response = await apiCall('/api/users');
    const users = await response.json();
    
    if (!users || users.length === 0) {
      usersList.innerHTML = '<div class="user-card">No users found</div>';
      return;
    }
    
    usersList.innerHTML = users.map(user => `
      <div class="user-card">
        <div class="user-info">
          <div class="user-name">${escapeHtml(user.fullName || user.username)}</div>
          <div class="user-role ${user.role}">${user.role === 'root_admin' ? 'ሥር አስተዳዳሪ' : user.role === 'admin' ? 'አስተዳዳሪ' : 'ተጠቃሚ'}</div>
          <div class="user-username">@${escapeHtml(user.username)}</div>
        </div>
        <div class="user-actions">
          ${user.id !== currentUser?.id ? `<button class="action-btn delete" onclick="window.deleteUser('${user.id}')"><i class="fas fa-trash"></i></button>` : ''}
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading users:', error);
    usersList.innerHTML = '<div class="error-message">Failed to load users</div>';
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

window.deleteUser = async function(userId) {
  if (!confirm('Are you sure you want to delete this user?')) return;
  
  try {
    const response = await apiCall(`/api/users?id=${userId}`, {
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
  
  try {
    const response = await apiCall('/api/users', {
      method: 'POST',
      body: JSON.stringify({ 
        username, 
        password, 
        fullName: fullName || username, 
        role: 'root_admin'
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
  
  try {
    const response = await apiCall('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ 
        name: title,
        nameAmharic: title,
        description,
        type: 'daily'
      })
    });
    
    if (response.ok) {
      alert('Task created successfully!');
      document.getElementById('schedule-task-form').reset();
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to create task');
    }
  } catch (error) {
    console.error('Error creating task:', error);
    alert('Failed to create task');
  }
}

async function loadAnalytics() {
  if (!token) return;
  
  try {
    const response = await apiCall('/api/analytics');
    const data = await response.json();
    
    if (data && data.overall) {
      const overallPercent = document.getElementById('overall-percentage');
      const totalMembers = document.getElementById('total-members');
      const streakCount = document.getElementById('streak-count');
      
      if (overallPercent) overallPercent.textContent = `${Math.round(data.overall.completionRate)}%`;
      if (totalMembers) totalMembers.textContent = data.overall.totalUsers || 0;
      
      const streakCountValue = data.userProgress ? data.userProgress.filter(u => u.streak >= 7).length : 0;
      if (streakCount) streakCount.textContent = streakCountValue;
      
      const userProgressList = document.getElementById('user-progress-list');
      if (userProgressList && data.userProgress) {
        userProgressList.innerHTML = data.userProgress.map(user => `
          <div class="progress-item">
            <div class="progress-header">
              <span>${escapeHtml(user.fullName || user.username)}</span>
              <span>${Math.round(user.percentage)}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${user.percentage}%"></div>
            </div>
            ${user.streak > 0 ? `<div class="streak-badge">🔥 ${user.streak} day streak</div>` : ''}
          </div>
        `).join('');
      }
      
      // Create chart
      const ctx = document.getElementById('trends-chart');
      if (ctx && data.userProgress && typeof Chart !== 'undefined') {
        const existingChart = Chart.getChart(ctx);
        if (existingChart) existingChart.destroy();
        
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
            maintainAspectRatio: true,
            scales: {
              y: {
                beginAtZero: true,
                max: 100
              }
            }
          }
        });
      }
    }
  } catch (error) {
    console.error('Error loading analytics:', error);
  }
}

async function loadAuditLogs() {
  const container = document.getElementById('audit-logs-container');
  if (!container || !token) return;
  
  try {
    const response = await apiCall('/api/audit');
    const data = await response.json();
    
    if (!data.logs || data.logs.length === 0) {
      container.innerHTML = '<div class="audit-entry">No audit logs available</div>';
      return;
    }
    
    container.innerHTML = data.logs.map(log => `
      <div class="audit-entry">
        <i class="fas fa-history audit-icon"></i>
        <strong>${new Date(log.timestamp).toLocaleString()}</strong><br>
        ${escapeHtml(log.username || 'User')} performed: ${escapeHtml(log.action)} on ${escapeHtml(log.target || 'unknown')}
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading audit logs:', error);
    container.innerHTML = '<div class="error-message">Failed to load audit logs</div>';
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
    } else if (format === 'csv' && data.userProgress) {
      const headers = ['Username', 'Full Name', 'Completion Rate (%)', 'Streak'];
      const rows = data.userProgress.map(u => [
        u.username,
        u.fullName,
        u.percentage,
        u.streak
      ]);
      
      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
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
