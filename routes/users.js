module.exports = function(db, bcrypt, uuidv4, authenticateToken, requireRole) {
  const router = require('express').Router();
  
  // Get all users (admin only)
  router.get('/', authenticateToken, requireRole('admin', 'root_admin'), (req, res) => {
    const users = db.get('users')
      .map(user => {
        const { password, ...userData } = user;
        return userData;
      })
      .value();
    res.json(users);
  });
  
  // Get single user
  router.get('/:id', authenticateToken, (req, res) => {
    const user = db.get('users').find({ id: req.params.id }).value();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { password, ...userData } = user;
    res.json(userData);
  });
  
  // Create user (admin only)
  router.post('/', authenticateToken, requireRole('admin', 'root_admin'), async (req, res) => {
    const { username, password, fullName, role } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Check if user exists
    const existing = db.get('users').find({ username }).value();
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = {
      id: uuidv4(),
      username,
      password: hashedPassword,
      fullName: fullName || username,
      role: role || 'standard',
      createdAt: new Date().toISOString()
    };
    
    db.get('users').push(newUser).write();
    
    // Log audit
    if (req.user) {
      db.get('auditLogs')
        .push({
          id: uuidv4(),
          userId: req.user.id,
          action: 'create_user',
          target: username,
          timestamp: new Date().toISOString()
        })
        .write();
    }
    
    const { password: _, ...userData } = newUser;
    res.status(201).json(userData);
  });
  
  // Delete user (admin only)
  router.delete('/:id', authenticateToken, requireRole('admin', 'root_admin'), (req, res) => {
    const user = db.get('users').find({ id: req.params.id }).value();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent deleting yourself
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    db.get('users').remove({ id: req.params.id }).write();
    
    res.json({ message: 'User deleted successfully' });
  });
  
  return router;
};
