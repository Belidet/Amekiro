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
  
  // GET - Get daily tasks
  if (req.method === 'GET') {
    const tasks = db.get('tasks')
      .filter({ type: 'daily' })
      .orderBy(['order'])
      .value();
    return res.json(tasks);
  }
  
  // POST - Create task (admin only)
  if (req.method === 'POST') {
    try {
      await requireRole('admin', 'root_admin')(req, res, () => {});
      
      const { name, nameAmharic, description, type, icon } = req.body;
      
      const newTask = {
        id: uuidv4(),
        name: name || nameAmharic,
        nameAmharic: nameAmharic || name,
        description: description || '',
        type: type || 'daily',
        icon: icon || '✠',
        order: db.get('tasks').filter({ type: 'daily' }).value().length,
        createdAt: new Date().toISOString()
      };
      
      db.get('tasks').push(newTask).write();
      
      return res.status(201).json(newTask);
    } catch (error) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
  }
  
  // DELETE - Remove task (admin only)
  if (req.method === 'DELETE') {
    try {
      await requireRole('admin', 'root_admin')(req, res, () => {});
      
      const taskId = req.query.id;
      if (!taskId) {
        return res.status(400).json({ error: 'Task ID required' });
      }
      
      db.get('tasks').remove({ id: taskId }).write();
      return res.json({ message: 'Task deleted successfully' });
    } catch (error) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};
