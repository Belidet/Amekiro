const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

module.exports = (db, uuidv4, authenticateToken, requireRole) => {
  // Get daily tasks
  router.get('/daily', authenticateToken, (req, res) => {
    const dailyTasks = db.get('tasks.daily').value();
    res.json(dailyTasks);
  });
  
  // Get scheduled tasks for a date
  router.get('/scheduled', authenticateToken, (req, res) => {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Date parameter required (YYYY-MM-DD)' });
    }
    
    const scheduledTasks = db.get('tasks.scheduled')
      .filter(task => task.date === date)
      .value();
    
    res.json(scheduledTasks);
  });
  
  // Schedule new task (admin only)
  router.post('/schedule', authenticateToken, requireRole('root_admin', 'admin'), [
    body('title').notEmpty().withMessage('Task title required'),
    body('date').notEmpty().withMessage('Date required'),
    body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be YYYY-MM-DD')
  ], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { title, description, date, isRecurring, recurrencePattern } = req.body;
    
    const newTask = {
      id: uuidv4(),
      title,
      description: description || '',
      date,
      createdByUserId: req.user.id,
      createdAt: new Date().toISOString(),
      isRecurring: isRecurring || false,
      recurrencePattern: recurrencePattern || null
    };
    
    db.get('tasks.scheduled').push(newTask).write();
    
    // Audit log
    const auditLog = require('../middleware/audit')(db, uuidv4);
    auditLog('task_schedule', req.user.id, null, { task: newTask });
    
    res.status(201).json(newTask);
  });
  
  // Delete scheduled task (admin only)
  router.delete('/:id', authenticateToken, requireRole('root_admin', 'admin'), (req, res) => {
    const task = db.get('tasks.scheduled')
      .find({ id: req.params.id })
      .value();
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    db.get('tasks.scheduled')
      .remove({ id: req.params.id })
      .write();
    
    // Audit log
    const auditLog = require('../middleware/audit')(db, uuidv4);
    auditLog('task_delete', req.user.id, null, { taskId: req.params.id, taskTitle: task.title });
    
    res.json({ message: 'Task deleted successfully' });
  });
  
  // Edit scheduled task (admin only)
  router.put('/:id', authenticateToken, requireRole('root_admin', 'admin'), (req, res) => {
    const task = db.get('tasks.scheduled')
      .find({ id: req.params.id })
      .value();
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const { title, description, date, isRecurring, recurrencePattern } = req.body;
    
    const updatedTask = {
      ...task,
      title: title || task.title,
      description: description !== undefined ? description : task.description,
      date: date || task.date,
      isRecurring: isRecurring !== undefined ? isRecurring : task.isRecurring,
      recurrencePattern: recurrencePattern !== undefined ? recurrencePattern : task.recurrencePattern
    };
    
    db.get('tasks.scheduled')
      .find({ id: req.params.id })
      .assign(updatedTask)
      .write();
    
    res.json(updatedTask);
  });
  
  return router;
};
