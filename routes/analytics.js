module.exports = function(db, authenticateToken, requireRole) {
  const router = require('express').Router();
  
  router.get('/', authenticateToken, requireRole('admin', 'root_admin'), (req, res) => {
    const users = db.get('users').value();
    const completions = db.get('completions').value();
    const tasks = db.get('tasks').value();
    
    // Calculate overall stats
    const totalCompletions = completions.length;
    const completedTasks = completions.filter(c => c.completed).length;
    const overallPercentage = totalCompletions > 0 ? (completedTasks / totalCompletions) * 100 : 0;
    
    // User progress
    const userProgress = users.map(user => {
      const userCompletions = completions.filter(c => c.userId === user.id);
      const userCompleted = userCompletions.filter(c => c.completed).length;
      
      // Calculate streak (simplified)
      const recentDates = userCompletions
        .filter(c => c.completed)
        .map(c => c.date)
        .sort();
      
      let streak = 0;
      // Simple streak calculation logic here
      
      return {
        userId: user.id,
        username: user.username,
        fullName: user.fullName,
        completedCount: userCompleted,
        totalTasks: tasks.length,
        percentage: tasks.length > 0 ? (userCompleted / tasks.length) * 100 : 0,
        streak
      };
    });
    
    res.json({
      overall: {
        totalUsers: users.length,
        totalTasks: tasks.length,
        totalCompletions: totalCompletions,
        completedTasks: completedTasks,
        completionRate: overallPercentage
      },
      userProgress: userProgress
    });
  });
  
  return router;
};
