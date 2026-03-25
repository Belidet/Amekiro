// api/index.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

// Use /tmp for database on Vercel (writable location)
const DB_PATH = '/tmp/db.json';
const adapter = new FileSync(DB_PATH);
const db = low(adapter);

// Initialize database if empty
const initDb = require('../db/init');
initDb(db);

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'orthodox-secret-key-2024';

app.use(cors());
app.use(express.json());

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
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

// Get daily tasks
app.get('/api/tasks/daily', authenticateToken, (req, res) => {
  const dailyTasks = db.get('tasks.daily').value();
  res.json(dailyTasks);
});

// Get scheduled tasks
app.get('/api/tasks/scheduled', authenticateToken, (req, res) => {
  const { date } = req.query;
  let tasks = db.get('tasks.scheduled').value();
  
  if (date) {
    tasks = tasks.filter(task => task.date === date);
  }
  
  res.json(tasks);
});

// Get completions for current user
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

// Toggle task completion
app.post('/api/completions', authenticateToken, (req, res) => {
  const { taskType, taskId, date, completed } = req.body;
  
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
  }
  
  res.json({ success: true });
});

// Get random inspiration
app.get('/api/inspiration/random', (req, res) => {
  const quotes = db.get('inspiration.quotes').value();
  const random = quotes[Math.floor(Math.random() * quotes.length)];
  res.json(random);
});

// Serve static files
const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));

// Catch-all to serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

module.exports = app;
