const { db, getCompletionsForUser, toggleCompletion, createAuditLog } = require('../_lib/db');
const { authenticateToken } = require('../../middleware/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    await new Promise((resolve, reject) => {
      authenticateToken(req, res, (err) => err ? reject(err) : resolve());
    });
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // GET - Completions for user
  if (req.method === 'GET') {
    const { userId, date } = req.query;
    const targetUserId = userId && (req.user.role === 'root_admin' || req.user.role === 'admin') ? userId : req.user.id;
    const completions = getCompletionsForUser(targetUserId, date);
    return res.json(completions);
  }
  
  // POST - Toggle completion
  if (req.method === 'POST') {
    const { taskId, taskType, date, completed } = req.body;
    const userId = req.user.id;
    
    toggleCompletion(userId, taskId, taskType, date, completed);
    createAuditLog(userId, req.user.username, completed ? 'complete_task' : 'uncomplete_task', taskId);
    
    return res.json({ success: true });
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};
