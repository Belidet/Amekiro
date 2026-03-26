// Family Reminder Tracker - Main Application
let currentUser = null;
let token = null;

// API Configuration
const API_BASE_URL = '';

// Helper function for API calls with timeout
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Add timeout to prevent hanging (30 seconds for Africa)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  
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
      console.error('API call timeout:', endpoint);
      throw new Error('Request timeout - please check your connection');
    }
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

// Check authentication on load with immediate display
document.addEventListener('DOMContentLoaded', () => {
  console.log('App starting...');
  
  // Show login form immediately to prevent blank screen
  if (loginSection) loginSection.style.display = 'block';
  if (mainApp) mainApp.style.display = 'none';
  
  // Setup password toggles immediately
  setupPasswordToggles();
  
  // Setup event listeners
  setupEventListeners();
  setupCandle();
  
  // Check auth in background (won't block UI)
  setTimeout(() => {
    checkAuth();
  }, 100);
  
  // Show welcome message for first-time users
  showWelcomeMessage();
});

function showWelcomeMessage() {
  const statusDiv = document.getElementById('login-status');
  if (statusDiv) {
    statusDiv.innerHTML = '✨ First user will become administrator ✨';
    statusDiv.style.color = '#C9A03D';
    setTimeout(() => {
      if (statusDiv.innerHTML === '✨ First user will become administrator ✨') {
        statusDiv.innerHTML = '';
      }
    }, 5000);
  }
}

// Setup password toggle functionality
function setupPasswordToggles() {
  const toggleButtons = document.querySelectorAll('.toggle-password');
  
  toggleButtons.forEach(button => {
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

async function handle
