const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, getUserByUsername, createAuditLog } = require('../_lib/db');
const { JWT_SECRET } = require('../../middleware/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  let user = getUserByUsername(username);
  const totalUsers = db.get('users').value().length;
  
  if (!user) {
    // First user becomes root_admin
    const role = totalUsers === 0 ? 'root_admin' : 'standard';
    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = {
      id: require('uuid').v4(),
      username,
      password: hashedPassword,
      fullName: username,
      role: role,
      createdAt: new Date().toISOString()
    };
    db.get('users').push(newUser).write();
    createAuditLog(newUser.id, username, 'register', username);
    user = newUser;
  } else {
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
  }
  
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  createAuditLog(user.id, user.username, 'login');
  
  const { password: _, ...userWithoutPassword } = user;
  res.json({ token, user: userWithoutPassword });
};const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, getUserByUsername, createAuditLog } = require('../_lib/db');
const { JWT_SECRET } = require('../../middleware/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  let user = getUserByUsername(username);
  const totalUsers = db.get('users').value().length;
  
  if (!user) {
    // First user becomes root_admin
    const role = totalUsers === 0 ? 'root_admin' : 'standard';
    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = {
      id: require('uuid').v4(),
      username,
      password: hashedPassword,
      fullName: username,
      role: role,
      createdAt: new Date().toISOString()
    };
    db.get('users').push(newUser).write();
    createAuditLog(newUser.id, username, 'register', username);
    user = newUser;
  } else {
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
  }
  
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  createAuditLog(user.id, user.username, 'login');
  
  const { password: _, ...userWithoutPassword } = user;
  res.json({ token, user: userWithoutPassword });
};
