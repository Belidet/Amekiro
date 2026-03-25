const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

module.exports = (db, bcrypt, jwt, JWT_SECRET, SALT_ROUNDS) => {
  // Login
  router.post('/login', [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;
    
    // Find user
    const user = db.get('users')
      .find(u => u.username === username && u.isActive === true)
      .value();
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Update last login
    db.get('users')
      .find({ id: user.id })
      .assign({ lastLogin: new Date().toISOString() })
      .write();
    
    // Generate token
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
  router.get('/me', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = db.get('users')
        .find({ id: decoded.id, isActive: true })
        .value();
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        rootAdminBadge: user.rootAdminBadge
      });
    } catch (err) {
      res.status(403).json({ error: 'Invalid token' });
    }
  });
  
  // Logout (client-side token removal)
  router.post('/logout', (req, res) => {
    res.json({ message: 'Logged out successfully' });
  });
  
  return router;
};
