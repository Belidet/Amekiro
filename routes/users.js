const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

module.exports = (db, bcrypt, uuidv4, authenticateToken, requireRole) => {
  // Get all users (filtered by role permissions)
  router.get('/', authenticateToken, (req, res) => {
    let users = db.get('users')
      .filter(u => u.isActive === true)
      .value();
    
    // Remove password hashes
    users = users.map(u => {
      const { passwordHash, ...userWithoutPassword } = u;
      return userWithoutPassword;
    });
    
    // Standard admins can only see standard users and other admins (not root admin details)
    if (req.user.role === 'admin') {
      users = users.filter(u => u.role === 'standard' || u.role === 'admin');
    }
    
    res.json(users);
  });
  
  // Get single user
  router.get('/:id', authenticateToken, (req, res) => {
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
    
    if (req.user.role === 'admin' && (user.role === 'root_admin')) {
      return res.status(403).json({ error: 'Cannot view root admin details' });
    }
    
    const { passwordHash, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });
  
  // Create user (admin only)
  router.post('/', authenticateToken, requireRole('root_admin', 'admin'), [
    body('username').notEmpty().withMessage('Username required'),
    body('password').notEmpty().withMessage('Password required'),
    body('role').isIn(['admin', 'standard']).withMessage('Invalid role')
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { username, password, role, fullName, email } = req.body;
    
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
      role,
      fullName: fullName || '',
      email: email || '',
      createdAt: new Date().toISOString(),
      createdByUserId: req.user.id,
      lastLogin: null,
      isActive: true,
      notes: '',
      rootAdminBadge: null
    };
    
    db.get('users').push(newUser).write();
    
    // Audit log
    const auditLog = require('../middleware/audit')(db, uuidv4);
    auditLog('user_create', req.user.id, newUser.id, { role, createdBy: req.user.username });
    
    const { passwordHash, ...newUserWithoutPassword } = newUser;
    res.status(201).json(newUserWithoutPassword);
  });
  
  // Create root admin (root admin only)
  router.post('/root', authenticateToken, requireRole('root_admin'), [
    body('username').notEmpty().withMessage('Username required'),
    body('password').notEmpty().withMessage('Password required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { username, password, fullName, email, rootAdminBadge } = req.body;
    
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
      email: email || '',
      createdAt: new Date().toISOString(),
      createdByUserId: req.user.id,
      lastLogin: null,
      isActive: true,
      notes: '',
      rootAdminBadge: rootAdminBadge || 'Elder'
    };
    
    db.get('users').push(newRootAdmin).write();
    
    // Audit log
    const auditLog = require('../middleware/audit')(db, uuidv4);
    auditLog('user_create', req.user.id, newRootAdmin.id, { role: 'root_admin', createdBy: req.user.username });
    
    const { passwordHash, ...newRootAdminWithoutPassword } = newRootAdmin;
    res.status(201).json(newRootAdminWithoutPassword);
  });
  
  // Reset password (admin only)
  router.put('/:id/reset-password', authenticateToken, requireRole('root_admin', 'admin'), [
    body('newPassword').notEmpty().withMessage('New password required'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const targetUser = db.get('users')
      .find({ id: req.params.id, isActive: true })
      .value();
    
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Permission checks
    if (req.user.role === 'admin') {
      if (targetUser.role !== 'standard') {
        return res.status(403).json({ error: 'Standard admin can only reset passwords for standard users' });
      }
    }
    
    const hashedPassword = await bcrypt.hash(req.body.newPassword, 12);
    db.get('users')
      .find({ id: req.params.id })
      .assign({ passwordHash: hashedPassword })
      .write();
    
    // Audit log
    const auditLog = require('../middleware/audit')(db, uuidv4);
    auditLog('password_reset', req.user.id, targetUser.id, { resetBy: req.user.username });
    
    res.json({ message: 'Password reset successfully' });
  });
  
  // Delete user (root admin only)
  router.delete('/:id', authenticateToken, requireRole('root_admin'), (req, res) => {
    const targetUser = db.get('users')
      .find({ id: req.params.id })
      .value();
    
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent self-deletion
    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account. Ask another root admin.' });
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
    
    // Audit log
    const auditLog = require('../middleware/audit')(db, uuidv4);
    auditLog('user_delete', req.user.id, targetUser.id, { deletedBy: req.user.username });
    
    res.json({ message: 'User deleted successfully' });
  });
  
  return router;
};
