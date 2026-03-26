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
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // GET - All tasks (admin sees all, standard sees their assigned)
  if (req.method === 'GET') {
    let tasks = db.get('tasks').value();
    if (req.user.role === 'standard') {
      tasks = tasks.filter(t => t.type === 'daily');
    }
    return res.json(tasks);
  }
  
  // Admin only: POST, PUT, DELETE
  try {
    await requireRole('root_admin', 'admin')(req, res, () => {});
  } catch (error) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  // POST - Create/update scheduled task (የጉባኤ አቴንዳንስ)
  if (req.method === 'POST') {
    const { nameAmharic, scheduledDate, type } = req.body;
    const existing = db.get('tasks').find({ nameAmharic, type: 'scheduled' }).value();
    
    if (existing) {
      db.get('tasks').find({ id: existing.id }).assign({ scheduledDate }).write();
      createAuditLog(req.user.id, req.user.username, 'update_scheduled_task', nameAmharic);
    } else {
      db.get('tasks').push({
        id: require('uuid').v4(),
        name: nameAmharic,
        nameAmharic,
        type: 'scheduled',
        scheduledDate,
        icon: '⛪',
        createdAt: new Date().toISOString()
      }).write();
      createAuditLog(req.user.id, req.user.username, 'create_scheduled_task', nameAmharic);
    }
    return res.json({ success: true });
  }
  
  // DELETE - Remove task
  if (req.method === 'DELETE') {
    const { taskId } = req.query;
    db.get('tasks').remove({ id: taskId }).write();
    createAuditLog(req.user.id, req.user.username, 'delete_task', taskId);
    return res.json({ success: true });
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};
