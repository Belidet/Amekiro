module.exports = function(db, uuidv4, authenticateToken, requireRole) {
  const router = require('express').Router();
  
  // Get daily tasks
  router.get('/daily', authenticateToken, (req, res) => {
    const tasks = db.get('tasks')
      .filter({ type: 'daily' })
      .orderBy(['order'])
      .value();
    res.json(tasks);
  });
  
  // Get all tasks (admin only)
  router.get('/', authenticateToken, requireRole('admin', 'root_admin'), (req, res) => {
    const tasks = db.get('tasks').value();
    res.json(tasks);
  });
  
  // Create task (admin only)
  router.post('/', authenticateToken, requireRole('admin', 'root_admin'), (req, res) => {
    const { name, nameAmharic, description, descriptionAmharic, type, icon, order } = req.body;
    
    const newTask = {
      id: uuidv4(),
      name: name || nameAmharic,
      nameAmharic: nameAmharic || name,
      description: description || '',
      descriptionAmharic: descriptionAmharic || '',
      type: type || 'daily',
      icon: icon || '✠',
      order: order || 0,
      createdAt: new Date().toISOString()
    };
    
    db.get('tasks').push(newTask).write();
    res.status(201).json(newTask);
  });
  
  // Update task (admin only)
  router.put('/:id', authenticateToken, requireRole('admin', 'root_admin'), (req, res) => {
    const task = db.get('tasks').find({ id: req.params.id }).value();
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    db.get('tasks')
      .find({ id: req.params.id })
      .assign(req.body)
      .write();
    
    res.json(db.get('tasks').find({ id: req.params.id }).value());
  });
  
  // Delete task (admin only)
  router.delete('/:id', authenticateToken, requireRole('admin', 'root_admin'), (req, res) => {
    db.get('tasks').remove({ id: req.params.id }).write();
    res.json({ message: 'Task deleted successfully' });
  });
  
  return router;
};
