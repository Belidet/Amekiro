const { v4: uuidv4 } = require('uuid');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const { authenticateToken } = require('../../middleware/auth');

const dbPath = path.join(process.cwd(), 'db.json');
const adapter = new FileSync(dbPath);
const db = low(adapter);

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Auth middleware
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
  
  // GET - Get completions for date
  if (req.method === 'GET') {
    const { date } = req.query;
    const userId = req.user.id;
    
    let completions = db.get('completions')
      .filter({ userId })
      .value();
    
    if (date) {
      completions = completions.filter(c => c.date === date);
    }
    
    return res.json(completions);
  }
  
  // POST - Toggle completion
  if (req.method === 'POST') {
    const { taskId, taskType, date, completed } = req.body;
    const userId = req.user.id;
    
    if (!taskId || !date) {
      return res.status(400).json({ error: 'Task ID and date required' });
    }
    
    const existing = db.get('completions')
      .find({ userId, taskId, taskType, date })
      .value();
    
    if (existing) {
      db.get('completions')
        .find({ userId, taskId, taskType, date })
        .assign({ 
          completed, 
          updatedAt: new Date().toISOString() 
        })
        .write();
    } else {
      db.get('completions')
        .push({
          id: uuidv4(),
          userId,
          taskId,
          taskType: taskType || 'daily',
          date,
          completed,
          createdAt: new Date().toISOString()
        })
        .write();
    }
    
    return res.json({ success: true });
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};
