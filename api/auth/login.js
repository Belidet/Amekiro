const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(process.cwd(), 'db.json');
const adapter = new FileSync(dbPath);
const db = low(adapter);
const initDb = require('../../db/init');
initDb(db);

const JWT_SECRET = process.env.JWT_SECRET || 'orthodox-secret-key-2024';

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  // Check if user exists
  let user = db.get('users').find({ username }).value();
  
  // If no users exist at all, this user becomes admin
  const totalUsers = db.get('users').value().length;
  
  if (!user) {
    // First user ever? They become admin
    const role = totalUsers === 0 ? 'root_admin' : 'standard';
    
    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = {
      id: uuidv4(),
      username,
      password: hashedPassword,
      fullName: username,
      role: role,
      createdAt: new Date().toISOString()
    };
    
    db.get('users').push(newUser).write();
    
    // Log audit
    db.get('auditLogs')
      .push({
        id: uuidv4(),
        userId: newUser.id,
        username: username,
        action: 'register',
        target: username,
        role: role,
        timestamp: new Date().toISOString()
      })
      .write();
    
    user = newUser;
  } else {
    // Existing user - verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
  }
  
  // Create token
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  // Log login
  db.get('auditLogs')
    .push({
      id: uuidv4(),
      userId: user.id,
      username: user.username,
      action: 'login',
      timestamp: new Date().toISOString()
    })
    .write();
  
  const { password: _, ...userWithoutPassword } = user;
  res.json({ token, user: userWithoutPassword });
};
