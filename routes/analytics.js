const express = require('express');
const router = express.Router();

module.exports = (db, authenticateToken, requireRole) => {
  // Get overview analytics (root admin only)
  router.get('/overview', authenticateToken, requireRole('root_admin'), (req, res) => {
    const standardUsers = db.get('users')
      .filter(u => u.role === 'standard' && u.isActive === true)
      .value();
    
    const allCompletions = db.get('completions').value();
    const dailyTasks = db.get('tasks.daily').value();
    const scheduledTasks = db.get('tasks.scheduled').value();
    
    // Calculate overall completion
    let totalTasksAssigned = 0;
    let totalTasksCompleted = 0;
    
    standardUsers.forEach(user => {
      // Count tasks for the user (simplified - for demo)
      const userCompletions = allCompletions.filter(c => c.userId === user.id);
      totalTasksAssigned += 7; // Placeholder
      totalTasksCompleted += userCompletions.filter(c => c.completed).length;
    });
    
    const overallPercentage = totalTasksAssigned > 0 
      ? Math.round((totalTasksCompleted / totalTasksAssigned) * 100) 
      : 0;
    
    // Task-specific completion rates
    const taskBreakdown = {};
    dailyTasks.forEach(task => {
      const taskCompletions = allCompletions.filter(c => c.taskType === 'daily' && c.taskId === task.id);
      const completed = taskCompletions.filter(c => c.completed).length;
      taskBreakdown[task.id] = {
        name: task.nameAmharic,
        completed,
        total: standardUsers.length * 7,
        percentage: Math.round((completed / (standardUsers.length * 7)) * 100)
      };
    });
    
    // User progress
    const userProgress = standardUsers.map(user => {
      const userCompletions = allCompletions.filter(c => c.userId === user.id);
      const completedCount = userCompletions.filter(c => c.completed).length;
      const streak = calculateStreak(user.id, allCompletions);
      
      return {
        userId: user.id,
        username: user.username,
        fullName: user.fullName,
        totalTasksAssigned: 7,
        totalTasksCompleted: completedCount,
        completionPercentage: Math.round((completedCount / 7) * 100),
        streakDays: streak
      };
    });
    
    res.json({
      overallCompletion: {
        totalTasksAssigned,
        totalTasksCompleted,
        percentage: overallPercentage
      },
      taskBreakdown,
      userProgress,
      totalUsers: standardUsers.length
    });
  });
  
  // Get detailed user history (root admin only)
  router.get('/users/:userId/completions', authenticateToken, requireRole('root_admin'), (req, res) => {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    const user = db.get('users').find({ id: userId }).value();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    let completions = db.get('completions')
      .filter(c => c.userId === userId)
      .value();
    
    if (startDate) {
      completions = completions.filter(c => c.date >= startDate);
    }
    if (endDate) {
      completions = completions.filter(c => c.date <= endDate);
    }
    
    // Group by date
    const groupedByDate = completions.reduce((acc, completion) => {
      if (!acc[completion.date]) {
        acc[completion.date] = [];
      }
      acc[completion.date].push(completion);
      return acc;
    }, {});
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName
      },
      completions: groupedByDate
    });
  });
  
  // Get completion trends (root admin only)
  router.get('/trends', authenticateToken, requireRole('root_admin'), (req, res) => {
    const { period = 'week' } = req.query;
    
    const days = period === 'week' ? 7 : 30;
    const dates = [];
    const trends = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dates.push(dateStr);
      
      const completions = db.get('completions')
        .filter(c => c.date === dateStr && c.completed === true)
        .value();
      
      trends.push(completions.length);
    }
    
    res.json({
      period,
      dates,
      trends,
      totalCompletions: trends.reduce((a, b) => a + b, 0)
    });
  });
  
  // Export reports (root admin only)
  router.get('/export', authenticateToken, requireRole('root_admin'), (req, res) => {
    const { format = 'json' } = req.query;
    
    const users = db.get('users').filter(u => u.isActive === true).value();
    const completions = db.get('completions').value();
    const tasks = db.get('tasks').value();
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      users,
      completions,
      tasks
    };
    
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=export.json');
      res.json(exportData);
    } else if (format === 'csv') {
      // Simple CSV export for completions
      let csv = 'Date,User,Task,Completed\n';
      completions.forEach(c => {
        const user = users.find(u => u.id === c.userId);
        csv += `${c.date},${user?.username || 'Unknown'},${c.taskId},${c.completed}\n`;
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=export.csv');
      res.send(csv);
    } else {
      res.status(400).json({ error: 'Unsupported format' });
    }
  });
  
  // Helper function to calculate streak
  function calculateStreak(userId, completions) {
    const userCompletions = completions
      .filter(c => c.userId === userId && c.completed === true)
      .map(c => c.date)
      .sort();
    
    if (userCompletions.length === 0) return 0;
    
    let streak = 1;
    let currentDate = new Date(userCompletions[userCompletions.length - 1]);
    
    for (let i = userCompletions.length - 2; i >= 0; i--) {
      const prevDate = new Date(userCompletions[i]);
      const diffDays = Math.floor((currentDate - prevDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        streak++;
        currentDate = prevDate;
      } else {
        break;
      }
    }
    
    return streak;
  }
  
  return router;
};
