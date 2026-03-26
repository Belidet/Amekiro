const jwt = require('jsonwebtoken');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

const dbPath = path.join(process.cwd(), 'db.json');
const adapter = new FileSync(dbPath);
const db = low(adapter);

const JWT_SECRET = process.env.JWT_SECRET || 'orthodox-secret-key-2024';

module.exports = (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    const user = db.get('users').find({ id: decoded.id }).value();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { password: _, ...userData } = user;
    res.json(userData);
  });
};
