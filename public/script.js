// Family Reminder Tracker - Main Application
let currentUser = null;
let token = null;

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
  setupPasswordToggles(); // NEW: Setup password toggle buttons
});

async function checkAuth() {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  
  if (storedToken && storedUser) {
    token = storedToken;
    currentUser = JSON.parse(storedUser);
    
    try {
      const response = await fetch('/api/auth/me', {
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
}

// NEW: Function to setup password toggle functionality
function setupPasswordToggles() {
  // Find all toggle password buttons
  const toggleButtons = document.querySelectorAll('.toggle-password');
  
  toggleButtons.forEach(button => {
    // Remove any existing event listeners to avoid duplicates
    button.removeEventListener('click', handlePasswordToggle);
    // Add new event listener
    button.addEventListener('click', handlePasswordToggle);
  });
}

// NEW: Handle password toggle click
function handlePasswordToggle(event) {
  event.preventDefault();
  const button = event.currentTarget;
  const targetId = button.getAttribute('data-target');
  const passwordInput = document.getElementById(targetId);
  const icon = button.querySelector('i');
  
  if (passwordInput) {
    // Toggle the type attribute
    const currentType = passwordInput.getAttribute('type');
    const newType = currentType === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', newType);
    
    // Toggle the icon
    if (icon) {
      if (newType === 'text') {
        // Show password - change icon to eye-slash
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      } else {
        // Hide password - change icon to eye
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
    }
    
    // Toggle active class on button
    button.classList.toggle('active', newType === 'text');
    
    // Optional: Add visual feedback for screen readers
    const isVisible = newType === 'text';
    button.setAttribute('aria-label', isVisible ? 'Hide password' : 'Show password');
    
    // Optional: Add a subtle animation effect
    button.style.transform = 'translateY(-50%) scale(0.95)';
    setTimeout(() => {
      button.style.transform = 'translateY(-50%) scale(1)';
    }, 150);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');
  
  errorDiv.textContent = '';
  
  try {
    const response = await fetch('/api/auth/login', {
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
  
  // Reset password fields visibility when logging out
  const passwordInputs = document.querySelectorAll('input[type="password"], input[type="text"]');
  passwordInputs.forEach(input => {
    if (input.id === 'login-password' || input.id === 'new-password' || input.id === 'root-password') {
      input.setAttribute('type', 'password');
    }
  });
  
  // Reset toggle buttons icons
  const toggleButtons = document.querySelectorAll('.toggle-password');
  toggleButtons.forEach(button => {
    const icon = button.querySelector('i');
    if (icon) {
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
    button.classList.remove('active');
    button.setAttribute('aria-label', 'Show password');
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
  
  // Re-initialize password toggles for any dynamically added content
  setupPasswordToggles();
  
  // Load initial data
  loadDashboard();
  loadTodayTasks();
  loadDailyInspiration();
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
  
  // Re-initialize password toggles when switching to admin view
  if (view === 'admin') {
    setupPasswordToggles();
  }
}

async function loadDashboard() {
  try {
    const date = new Date().toISOString().split('T')[0];
    const response = await fetch(`/api/completions?date=${date}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
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
    // Load daily tasks
    const dailyResponse = await fetch('/api/tasks/daily', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const dailyTasks = await dailyResponse.json();
    
    // Load completions
    const completionsResponse = await fetch(`/api/completions?date=${date}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const completions = await completionsResponse.json();
    
    container.innerHTML = dailyTasks.map(task => {
      const completion = completions.find(c => c.taskType === 'daily' && c.taskId === task.id);
      const isCompleted = completion?.completed || false;
      
      return `
        <div class="task-item ${isCompleted ? 'completed' : ''}" data-task-id="${task.id}" data-task-type="daily">
          <div class="task-icon">${task.icon || '✠'}</div>
          <div class="task-content">
            <div class="task-title">${task.nameAmharic}</div>
          </div>
          <input type="checkbox" class="task-checkbox" ${isCompleted ? 'checked' : ''} 
                 onchange="toggleTaskCompletion('${task.id}', 'daily', '${date}', this.checked)">
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading tasks:', error);
    container.innerHTML = '<div class="error-message">ሥራዎችን ማምጣት አልተቻለም</div>';
  }
}

window.toggleTaskCompletion = async function(taskId, taskType, date, completed) {
  try {
    const response = await fetch('/api/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
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
    const response = await fetch('/api/inspiration/random');
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

// NEW: Function to handle form resets for password fields (can be called when creating new users)
window.resetPasswordVisibility = function() {
  const passwordFields = ['login-password', 'new-password', 'root-password'];
  passwordFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field && field.getAttribute('type') === 'text') {
      field.setAttribute('type', 'password');
    }
  });
  
  const toggleButtons = document.querySelectorAll('.toggle-password');
  toggleButtons.forEach(button => {
    const icon = button.querySelector('i');
    if (icon && icon.classList.contains('fa-eye-slash')) {
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
    button.classList.remove('active');
    button.setAttribute('aria-label', 'Show password');
  });
};

// NEW: Add keyboard accessibility for password toggle
document.addEventListener('keydown', function(event) {
  // If user presses Enter or Space on a toggle button, trigger the click
  if (event.target.classList && event.target.classList.contains('toggle-password')) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.target.click();
    }
  }
});

// NEW: MutationObserver to handle dynamically added password fields
const observer = new MutationObserver(function(mutations) {
  mutations.forEach(function(mutation) {
    if (mutation.type === 'childList') {
      // Check for newly added toggle buttons
      const newToggleButtons = document.querySelectorAll('.toggle-password:not([data-listener-attached])');
      newToggleButtons.forEach(button => {
        button.setAttribute('data-listener-attached', 'true');
        button.addEventListener('click', handlePasswordToggle);
      });
    }
  });
});

// Start observing the document for dynamic changes
observer.observe(document.body, {
  childList: true,
  subtree: true
});
