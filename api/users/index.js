const bcrypt = require('bcryptjs');
const { db, createAuditLog } = require('../_lib/db');
const { authenticateToken } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roles');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    await new Promise((resolve, reject) => {
      authenticateToken(req, res, (err) => err ? reject(err) : resolve());
    });
    await requireRole('root_admin', 'admin')(req, res, () => {});
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // GET - List all users
  if (req.method === 'GET') {
    const users = db.get('users').map(u => {
      const { password, ...userData } = u;
      return userData;
    }).value();
    return res.json(users);
  }
  
  // POST - Create user (standard by default)
  if (req.method === 'POST') {
    const { username, password, fullName, role = 'standard' } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    const existing = db.get('users').find({ username }).value();
    if (existing) return res.status(400).json({ error: 'Username exists' });
    
    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = {
      id: require('uuid').v4(),
      username,
      password: hashedPassword,
      fullName: fullName || username,
      role: role === 'admin' && req.user.role === 'root_admin' ? 'admin' : 'standard',
      createdAt: new Date().toISOString()
    };
    
    db.get('users').push(newUser).write();
    createAuditLog(req.user.id, req.user.username, 'create_user', username);
    
    const { password: _, ...userData } = newUser;
    return res.status(201).json(userData);
  }
  
  // PUT - Update user (reset password or edit)
  if (req.method === 'PUT') {
    const { userId, username, password, fullName } = req.body;
    const user = db.get('users').find({ id: userId }).value();
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (username) user.username = username;
    if (fullName) user.fullName = fullName;
    if (password) user.password = await bcrypt.hash(password, 12);
    
    db.get('users').find({ id: userId }).assign(user).write();
    createAuditLog(req.user.id, req.user.username, 'update_user', userId);
    
    const { password: _, ...userData } = user;
    return res.json(userData);
  }
  
  // DELETE - Delete user
  if (req.method === 'DELETE') {
    const { userId } = req.query;
    if (req.user.id === userId) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    
    db.get('users').remove({ id: userId }).write();
    db.get('completions').remove({ userId }).write();
    createAuditLog(req.user.id, req.user.username, 'delete_user', userId);
    
    return res.json({ message: 'User deleted' });
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};
