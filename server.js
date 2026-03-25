// Add at the very top of server.js
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

// Ensure db.json exists in a writable location
// For Vercel, use /tmp, for local development use current directory
const DB_PATH = process.env.VERCEL ? '/tmp/db.json' : path.join(__dirname, 'db.json');

// Initialize database with the correct path
const adapter = new FileSync(DB_PATH);
const db = low(adapter);

// Initialize database with default structure (with error handling)
try {
  // Check if db.json exists and has required structure
  const initDb = require('./db/init');
  initDb(db);
} catch (error) {
  console.error('Error initializing database:', error.message);
  // Fallback initialization if init.js is missing
  db.defaults({
    users: [],
    tasks: [],
    completions: [],
    auditLogs: [],
    inspirations: []
  }).write();
}

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'orthodox-secret-key-2024';
const SALT_ROUNDS = 12;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allows inline styles for design
}));
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});
app.use('/api/', limiter);

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

// Role middleware
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Import routes with error handling
let authRoutes, userRoutes, taskRoutes, completionRoutes, analyticsRoutes, auditRoutes;

try {
  authRoutes = require('./routes/auth')(db, bcrypt, jwt, JWT_SECRET, SALT_ROUNDS);
  userRoutes = require('./routes/users')(db, bcrypt, uuidv4, authenticateToken, requireRole);
  taskRoutes = require('./routes/tasks')(db, uuidv4, authenticateToken, requireRole);
  completionRoutes = require('./routes/completions')(db, uuidv4, authenticateToken, requireRole);
  analyticsRoutes = require('./routes/analytics')(db, authenticateToken, requireRole);
  auditRoutes = require('./routes/audit')(db, authenticateToken, requireRole);
} catch (error) {
  console.error('Error loading routes:', error.message);
  // Fallback route if route files are missing
  app.get('/api/*', (req, res) => {
    res.status(500).json({ error: 'API routes not properly configured' });
  });
}

// Use routes if they exist
if (authRoutes) app.use('/api/auth', authRoutes);
if (userRoutes) app.use('/api/users', userRoutes);
if (taskRoutes) app.use('/api/tasks', taskRoutes);
if (completionRoutes) app.use('/api/completions', completionRoutes);
if (analyticsRoutes) app.use('/api/analytics', analyticsRoutes);
if (auditRoutes) app.use('/api/audit', auditRoutes);

// Health check endpoint (useful for debugging)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    dbPath: DB_PATH,
    dbSize: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0
  });
});

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('Error loading application');
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✠ የአመክሮ ቤተሰብ መከታተያ running on port ${PORT} ✠`);
  console.log(`📁 Database path: ${DB_PATH}`);
  console.log(`📁 Static files: ${path.join(__dirname, 'public')}`);
});
