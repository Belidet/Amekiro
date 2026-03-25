const express = require('express');
const router = express.Router();

module.exports = (db, uuidv4, authenticateToken, requireRole) => {
  // Get current user's completions for a date
  router.get('/my', authenticateToken, (req, res) => {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Date parameter required (YYYY-MM-DD)' });
    }
    
    const completions = db.get('completions')
      .filter(c => c.userId === req.user.id && c.date === date)
      .value();
    
    res.json(completions);
  });
  
  // Get all users' completions for a date (admin only)
  router.get('/group', authenticateToken, requireRole('root_admin', 'admin'), (req, res) => {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Date parameter required (YYYY-MM-DD)' });
    }
    
    let completions = db.get('completions')
      .filter(c => c.date === date)
      .value();
    
    // For standard admins, only show completions for standard users
    if (req.user.role === 'admin') {
      const standardUsers = db.get('users')
        .filter(u => u.role === 'standard' && u.isActive === true)
        .map(u => u.id)
        .value();
      
      completions = completions.filter(c => standardUsers.includes(c.userId));
    }
    
    res.json(completions);
  });
  
  // Get completions for a specific user (admin or self)
  router.get('/user/:userId', authenticateToken, (req, res) => {
    const { userId } = req.params;
    const { date } = req.query;
    
    // Permission check
    if (req.user.role === 'standard' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Cannot view other users\' completions' });
    }
    
    if (req.user.role === 'admin') {
      const targetUser = db.get('users').find({ id: userId }).value();
      if (targetUser && targetUser.role === 'root_admin') {
        return res.status(403).json({ error: 'Cannot view root admin completions' });
      }
    }
    
    let completions = db.get('completions')
      .filter(c => c.userId === userId);
    
    if (date) {
      completions = completions.filter(c => c.date === date);
    }
    
    res.json(completions.value());
  });
  
  // Mark task complete/incomplete
  router.post('/', authenticateToken, (req, res) => {
    const { taskType, taskId, date, completed, notes } = req.body;
    
    if (!taskType || !taskId || !date) {
      return res.status(400).json({ error: 'taskType, taskId, and date are required' });
    }
    
    // Check if completion exists
    let completion = db.get('completions')
      .find(c => c.userId === req.user.id && c.taskType === taskType && c.taskId === taskId && c.date === date)
      .value();
    
    if (completion) {
      // Update existing
      db.get('completions')
        .find({ id: completion.id })
        .assign({
          completed: completed || false,
          completedAt: completed ? new Date().toISOString() : null,
          notes: notes || completion.notes
        })
        .write();
      
      res.json({ ...completion, completed, completedAt: completed ? new Date().toISOString() : null });
    } else {
      // Create new
      const newCompletion = {
        id: uuidv4(),
        userId: req.user.id,
        taskType,
        taskId,
        date,
        completed: completed || false,
        completedAt: completed ? new Date().toISOString() : null,
        notes: notes || null
      };
      
      db.get('completions').push(newCompletion).write();
      res.status(201).json(newCompletion);
    }
  });
  
  return router;
};
