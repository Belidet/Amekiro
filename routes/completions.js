module.exports = function(db, uuidv4, authenticateToken, requireRole) {
  const router = require('express').Router();
  
  // Get completions for a date
  router.get('/', authenticateToken, (req, res) => {
    const { date } = req.query;
    const userId = req.user.id;
    
    let completions = db.get('completions')
      .filter({ userId })
      .value();
    
    if (date) {
      completions = completions.filter(c => c.date === date);
    }
    
    res.json(completions);
  });
  
  // Toggle completion
  router.post('/', authenticateToken, (req, res) => {
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
    
    res.json({ success: true });
  });
  
  // Get statistics (admin only)
  router.get('/stats', authenticateToken, requireRole('admin', 'root_admin'), (req, res) => {
    const users = db.get('users').value();
    const completions = db.get('completions').value();
    
    const stats = users.map(user => {
      const userCompletions = completions.filter(c => c.userId === user.id);
      const completedCount = userCompletions.filter(c => c.completed).length;
      const totalCount = userCompletions.length;
      
      return {
        userId: user.id,
        username: user.username,
        fullName: user.fullName,
        completedCount,
        totalCount,
        percentage: totalCount > 0 ? (completedCount / totalCount) * 100 : 0
      };
    });
    
    res.json(stats);
  });
  
  return router;
};
