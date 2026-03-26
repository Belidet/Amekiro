const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const { authenticateToken } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roles');

const dbPath = path.join(process.cwd(), 'db.json');
const adapter = new FileSync(dbPath);
const db = low(adapter);

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Auth middleware wrapper
  const authPromise = new Promise((resolve, reject) => {
    authenticateToken(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  try {
    await authPromise;
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // GET - List all users (admin only)
  if (req.method === 'GET') {
    try {
      await requireRole('admin', 'root_admin')(req, res, () => {});
      
      const users = db.get('users')
        .map(user => {
          const { password, ...userData } = user;
          return userData;
        })
        .value();
      
      return res.json(users);
    } catch (error) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
  }
  
  // POST - Create user (admin only)
  if (req.method === 'POST') {
    try {
      await requireRole('admin', 'root_admin')(req, res, () => {});
      
      const { username, password, fullName, role } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }
      
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
      db.get('auditLogs')
        .push({
          id: uuidv4(),
          userId: req.user.id,
          username: req.user.username,
          action: 'create_user',
          target: username,
          timestamp: new Date().toISOString()
        })
        .write();
      
      const { password: _, ...userData } = newUser;
      return res.status(201).json(userData);
    } catch (error) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
  }
  
  // DELETE - Remove user (admin only)
  if (req.method === 'DELETE') {
    try {
      await requireRole('admin', 'root_admin')(req, res, () => {});
      
      const userId = req.query.id;
      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }
      
      const user = db.get('users').find({ id: userId }).value();
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Prevent deleting yourself
      if (req.user.id === userId) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }
      
      db.get('users').remove({ id: userId }).write();
      
      return res.json({ message: 'User deleted successfully' });
    } catch (error) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};
