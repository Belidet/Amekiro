// Debug endpoint to check database status (no auth required for testing)
app.get('/api/debug/db-status', (req, res) => {
  try {
    const users = db.get('users').value();
    const dailyTasks = db.get('tasks.daily').value();
    
    res.json({
      databaseExists: true,
      userCount: users?.length || 0,
      users: users?.map(u => ({ 
        username: u.username, 
        role: u.role, 
        isActive: u.isActive 
      })) || [],
      dailyTasksCount: dailyTasks?.length || 0,
      dbPath: '/tmp/db.json',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      databaseExists: false 
    });
  }
});

// Debug endpoint to manually create admin if missing
app.get('/api/debug/create-admin', async (req, res) => {
  try {
    const users = db.get('users').value();
    
    if (!users || users.length === 0) {
      const defaultPassword = await bcrypt.hash('admin123', 10);
      db.get('users')
        .push({
          id: 'root_admin_default',
          username: 'admin',
          passwordHash: defaultPassword,
          role: 'root_admin',
          fullName: 'መጀመሪያ አስተዳዳሪ',
          email: '',
          createdAt: new Date().toISOString(),
          createdByUserId: 'system',
          lastLogin: null,
          isActive: true,
          notes: 'Default root admin - please change password',
          rootAdminBadge: 'Founder'
        })
        .write();
      
      res.json({ 
        success: true, 
        message: 'Admin user created successfully',
        username: 'admin',
        password: 'admin123'
      });
    } else {
      res.json({ 
        success: false, 
        message: 'Users already exist',
        userCount: users.length 
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

// Use /tmp for writable storage on Vercel (ephemeral but writable)
const DB_PATH = '/tmp/db.json';
const adapter = new FileSync(DB_PATH);
const db = low(adapter);

// Initialize database if empty
const initDb = require('../db/init');
initDb(db);

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'orthodox-secret-key-2024';

// Middleware
app.use(cors());
app.use(express.json());

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
};

// ============ TEST ENDPOINT ============
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working!', 
    timestamp: new Date().toISOString(),
    status: 'online'
  });
});

// ============ AUTHENTICATION ROUTES ============

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  try {
    const user = db.get('users')
      .find(u => u.username === username && u.isActive === true)
      .value();
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Update last login
    db.get('users')
      .find({ id: user.id })
      .assign({ lastLogin: new Date().toISOString() })
      .write();
    
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        rootAdminBadge: user.rootAdminBadge
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = db.get('users')
    .find({ id: req.user.id, isActive: true })
    .value();
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const { passwordHash, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

// Logout endpoint (client-side token removal)
app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// ============ TASKS ROUTES ============

// Get daily tasks
app.get('/api/tasks/daily', authenticateToken, (req, res) => {
  const dailyTasks = db.get('tasks.daily').value();
  res.json(dailyTasks);
});

// Get scheduled tasks for a date
app.get('/api/tasks/scheduled', authenticateToken, (req, res) => {
  const { date } = req.query;
  let tasks = db.get('tasks.scheduled').value();
  
  if (date) {
    tasks = tasks.filter(task => task.date === date);
  }
  
  res.json(tasks);
});

// Schedule new task (admin only)
app.post('/api/tasks/schedule', authenticateToken, (req, res) => {
  if (req.user.role !== 'root_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  const { title, description, date } = req.body;
  
  if (!title || !date) {
    return res.status(400).json({ error: 'Title and date required' });
  }
  
  const newTask = {
    id: uuidv4(),
    title,
    description: description || '',
    date,
    createdByUserId: req.user.id,
    createdAt: new Date().toISOString(),
    isRecurring: false,
    recurrencePattern: null
  };
  
  db.get('tasks.scheduled').push(newTask).write();
  res.status(201).json(newTask);
});

// Delete task (admin only)
app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'root_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  const task = db.get('tasks.scheduled')
    .find({ id: req.params.id })
    .value();
  
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  db.get('tasks.scheduled')
    .remove({ id: req.params.id })
    .write();
  
  res.json({ message: 'Task deleted successfully' });
});

// ============ COMPLETIONS ROUTES ============

// Get current user's completions
app.get('/api/completions/my', authenticateToken, (req, res) => {
  const { date } = req.query;
  let completions = db.get('completions')
    .filter(c => c.userId === req.user.id)
    .value();
  
  if (date) {
    completions = completions.filter(c => c.date === date);
  }
  
  res.json(completions);
});

// Get all users' completions (admin only)
app.get('/api/completions/group', authenticateToken, (req, res) => {
  if (req.user.role !== 'root_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  const { date } = req.query;
  let completions = db.get('completions').value();
  
  if (date) {
    completions = completions.filter(c => c.date === date);
  }
  
  res.json(completions);
});

// Toggle task completion
app.post('/api/completions', authenticateToken, (req, res) => {
  const { taskType, taskId, date, completed } = req.body;
  
  if (!taskType || !taskId || !date) {
    return res.status(400).json({ error: 'taskType, taskId, and date required' });
  }
  
  let completion = db.get('completions')
    .find(c => c.userId === req.user.id && c.taskType === taskType && c.taskId === taskId && c.date === date)
    .value();
  
  if (completion) {
    db.get('completions')
      .find({ id: completion.id })
      .assign({
        completed: completed || false,
        completedAt: completed ? new Date().toISOString() : null
      })
      .write();
    res.json({ success: true, updated: true });
  } else {
    const newCompletion = {
      id: uuidv4(),
      userId: req.user.id,
      taskType,
      taskId,
      date,
      completed: completed || false,
      completedAt: completed ? new Date().toISOString() : null,
      notes: null
    };
    db.get('completions').push(newCompletion).write();
    res.status(201).json({ success: true, created: true });
  }
});

// ============ INSPIRATION ROUTES ============

// Get random inspiration (public, no auth needed)
app.get('/api/inspiration/random', (req, res) => {
  const quotes = db.get('inspiration.quotes').value();
  const random = quotes[Math.floor(Math.random() * quotes.length)];
  res.json(random);
});

// ============ USER MANAGEMENT ROUTES ============

// Get users list (admin only)
app.get('/api/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'root_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  let users = db.get('users')
    .filter(u => u.isActive === true)
    .value();
  
  // Remove password hashes
  users = users.map(u => {
    const { passwordHash, ...userWithoutPassword } = u;
    return userWithoutPassword;
  });
  
  // Standard admins can only see standard users
  if (req.user.role === 'admin') {
    users = users.filter(u => u.role === 'standard');
  }
  
  res.json(users);
});

// Get single user
app.get('/api/users/:id', authenticateToken, (req, res) => {
  const user = db.get('users')
    .find({ id: req.params.id, isActive: true })
    .value();
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Permission check
  if (req.user.role === 'standard' && req.user.id !== user.id) {
    return res.status(403).json({ error: 'Cannot view other users' });
  }
  
  if (req.user.role === 'admin' && user.role === 'root_admin') {
    return res.status(403).json({ error: 'Cannot view root admin details' });
  }
  
  const { passwordHash, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

// Create user (admin only)
app.post('/api/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'root_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  const { username, password, role, fullName } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  // Check if username exists
  const existingUser = db.get('users')
    .find(u => u.username === username)
    .value();
  
  if (existingUser) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  
  // Standard admin can only create standard users
  if (req.user.role === 'admin' && role !== 'standard') {
    return res.status(403).json({ error: 'Can only create standard users' });
  }
  
  const hashedPassword = await bcrypt.hash(password, 12);
  const newUser = {
    id: uuidv4(),
    username,
    passwordHash: hashedPassword,
    role: role || 'standard',
    fullName: fullName || '',
    email: '',
    createdAt: new Date().toISOString(),
    createdByUserId: req.user.id,
    lastLogin: null,
    isActive: true,
    notes: '',
    rootAdminBadge: null
  };
  
  db.get('users').push(newUser).write();
  
  const { passwordHash, ...newUserWithoutPassword } = newUser;
  res.status(201).json(newUserWithoutPassword);
});

// Create root admin (root admin only)
app.post('/api/users/root', authenticateToken, async (req, res) => {
  if (req.user.role !== 'root_admin') {
    return res.status(403).json({ error: 'Only root admin can create other root admins' });
  }
  
  const { username, password, fullName, rootAdminBadge } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  // Check if username exists
  const existingUser = db.get('users')
    .find(u => u.username === username)
    .value();
  
  if (existingUser) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  
  const hashedPassword = await bcrypt.hash(password, 12);
  const newRootAdmin = {
    id: uuidv4(),
    username,
    passwordHash: hashedPassword,
    role: 'root_admin',
    fullName: fullName || '',
    email: '',
    createdAt: new Date().toISOString(),
    createdByUserId: req.user.id,
    lastLogin: null,
    isActive: true,
    notes: '',
    rootAdminBadge: rootAdminBadge || 'Elder'
  };
  
  db.get('users').push(newRootAdmin).write();
  
  const { passwordHash, ...newRootAdminWithoutPassword } = newRootAdmin;
  res.status(201).json(newRootAdminWithoutPassword);
});

// Reset password (admin only)
app.put('/api/users/:id/reset-password', authenticateToken, async (req, res) => {
  if (req.user.role !== 'root_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  const targetUser = db.get('users')
    .find({ id: req.params.id, isActive: true })
    .value();
  
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Standard admin can only reset standard user passwords
  if (req.user.role === 'admin' && targetUser.role !== 'standard') {
    return res.status(403).json({ error: 'Can only reset passwords for standard users' });
  }
  
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  
  db.get('users')
    .find({ id: req.params.id })
    .assign({ passwordHash: hashedPassword })
    .write();
  
  res.json({ message: 'Password reset successfully' });
});

// Delete user (root admin only)
app.delete('/api/users/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'root_admin') {
    return res.status(403).json({ error: 'Only root admin can delete users' });
  }
  
  const targetUser = db.get('users')
    .find({ id: req.params.id })
    .value();
  
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Prevent self-deletion
  if (targetUser.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  
  // Check if this is the last root admin
  const rootAdmins = db.get('users')
    .filter(u => u.role === 'root_admin' && u.isActive === true)
    .value();
  
  if (targetUser.role === 'root_admin' && rootAdmins.length === 1) {
    return res.status(400).json({ error: 'Cannot delete the last root admin' });
  }
  
  // Soft delete
  db.get('users')
    .find({ id: req.params.id })
    .assign({ isActive: false })
    .write();
  
  res.json({ message: 'User deleted successfully' });
});

// ============ ANALYTICS ROUTES (Root Admin Only) ============

// Analytics overview
app.get('/api/analytics/overview', authenticateToken, (req, res) => {
  if (req.user.role !== 'root_admin') {
    return res.status(403).json({ error: 'Only root admin can view analytics' });
  }
  
  const standardUsers = db.get('users')
    .filter(u => u.role === 'standard' && u.isActive === true)
    .value();
  
  const allCompletions = db.get('completions').value();
  const dailyTasks = db.get('tasks.daily').value();
  
  // Calculate overall completion
  let totalTasksAssigned = 0;
  let totalTasksCompleted = 0;
  
  standardUsers.forEach(user => {
    const userCompletions = allCompletions.filter(c => c.userId === user.id);
    // Each user has 2 daily tasks per day (simplified)
    totalTasksAssigned += 2;
    totalTasksCompleted += userCompletions.filter(c => c.completed).length;
  });
  
  const overallPercentage = totalTasksAssigned > 0 
    ? Math.round((totalTasksCompleted / totalTasksAssigned) * 100) 
    : 0;
  
  // User progress
  const userProgress = standardUsers.map(user => {
    const userCompletions = allCompletions.filter(c => c.userId === user.id);
    const completedCount = userCompletions.filter(c => c.completed).length;
    
    return {
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      totalTasksAssigned: 2,
      totalTasksCompleted: completedCount,
      completionPercentage: Math.round((completedCount / 2) * 100),
      streakDays: 0
    };
  });
  
  res.json({
    overallCompletion: {
      totalTasksAssigned,
      totalTasksCompleted,
      percentage: overallPercentage
    },
    taskBreakdown: {},
    userProgress,
    totalUsers: standardUsers.length
  });
});

// Export analytics
app.get('/api/analytics/export', authenticateToken, (req, res) => {
  if (req.user.role !== 'root_admin') {
    return res.status(403).json({ error: 'Only root admin can export data' });
  }
  
  const { format = 'json' } = req.query;
  const users = db.get('users').filter(u => u.isActive === true).value();
  const completions = db.get('completions').value();
  const tasks = db.get('tasks').value();
  
  const exportData = {
    exportedAt: new Date().toISOString(),
    users: users.map(u => {
      const { passwordHash, ...userData } = u;
      return userData;
    }),
    completions,
    tasks
  };
  
  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=export.json');
    res.json(exportData);
  } else if (format === 'csv') {
    let csv = 'Date,User,Task,Completed\n';
    completions.forEach(c => {
      const user = users.find(u => u.id === c.userId);
      csv += `${c.date},${user?.username || 'Unknown'},${c.taskId},${c.completed}\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=export.csv');
    res.send(csv);
  } else {
    res.status(400).json({ error: 'Unsupported format' });
  }
});

// ============ AUDIT LOGS (Root Admin Only) ============

app.get('/api/audit', authenticateToken, (req, res) => {
  if (req.user.role !== 'root_admin') {
    return res.status(403).json({ error: 'Only root admin can view audit logs' });
  }
  
  const logs = db.get('auditLogs')
    .orderBy(['timestamp'], ['desc'])
    .value();
  
  res.json({ logs });
});

// ============ STATIC FILES ============

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Catch-all route to serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// ============ EXPORT FOR VERCEL ============
module.exports = app;
