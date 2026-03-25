const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

// Initialize database
const adapter = new FileSync('db.json');
const db = low(adapter);

// Initialize database with default structure
const initDb = require('./db/init');
initDb(db);

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

// Import routes
const authRoutes = require('./routes/auth')(db, bcrypt, jwt, JWT_SECRET, SALT_ROUNDS);
const userRoutes = require('./routes/users')(db, bcrypt, uuidv4, authenticateToken, requireRole);
const taskRoutes = require('./routes/tasks')(db, uuidv4, authenticateToken, requireRole);
const completionRoutes = require('./routes/completions')(db, uuidv4, authenticateToken, requireRole);
const analyticsRoutes = require('./routes/analytics')(db, authenticateToken, requireRole);
const auditRoutes = require('./routes/audit')(db, authenticateToken, requireRole);

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/completions', completionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/audit', auditRoutes);

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`✠ የአመክሮ ቤተሰብ መከታተያ running on port ${PORT} ✠`);
});
