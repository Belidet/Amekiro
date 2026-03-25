const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const DB_PATH = '/tmp/db.json';
const adapter = new FileSync(DB_PATH);
const db = low(adapter);

const JWT_SECRET = process.env.JWT_SECRET || 'orthodox-secret-key-2024';

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  
  // GET - Fetch completions
  if (req.method === 'GET') {
    const { date } = req.query;
    let completions = db.get('completions')
      .filter(c => c.userId === decoded.id)
      .value();
    
    if (date) {
      completions = completions.filter(c => c.date === date);
    }
    
    return res.json(completions);
  }
  
  // POST - Create/Update completion
  if (req.method === 'POST') {
    const { taskType, taskId, date, completed } = req.body;
    
    let completion = db.get('completions')
      .find(c => c.userId === decoded.id && c.taskType === taskType && c.taskId === taskId && c.date === date)
      .value();
    
    if (completion) {
      db.get('completions')
        .find({ id: completion.id })
        .assign({
          completed: completed || false,
          completedAt: completed ? new Date().toISOString() : null
        })
        .write();
    } else {
      const newCompletion = {
        id: uuidv4(),
        userId: decoded.id,
        taskType,
        taskId,
        date,
        completed: completed || false,
        completedAt: completed ? new Date().toISOString() : null,
        notes: null
      };
      db.get('completions').push(newCompletion).write();
    }
    
    return res.json({ success: true });
  }
  
  res.status(405).json({ error: 'Method not allowed' });
};
