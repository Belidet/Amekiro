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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
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
    await requireRole('admin', 'root_admin')(req, res, () => {});
  } catch (error) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  const users = db.get('users').value();
  const completions = db.get('completions').value();
  const tasks = db.get('tasks').filter({ type: 'daily' }).value();
  
  // Calculate overall stats
  const totalCompletions = completions.length;
  const completedTasks = completions.filter(c => c.completed).length;
  const overallPercentage = totalCompletions > 0 ? (completedTasks / totalCompletions) * 100 : 0;
  
  // Calculate user progress
  const userProgress = users.map(user => {
    const userCompletions = completions.filter(c => c.userId === user.id);
    const userCompleted = userCompletions.filter(c => c.completed).length;
    
    // Simple streak calculation (last 7 days)
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    });
    
    let streak = 0;
    for (let i = 0; i < last7Days.length; i++) {
      const dayCompletions = userCompletions.filter(c => c.date === last7Days[i] && c.completed);
      if (dayCompletions.length > 0) streak++;
      else break;
    }
    
    return {
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      completedCount: userCompleted,
      totalTasks: tasks.length,
      percentage: tasks.length > 0 ? (userCompleted / tasks.length) * 100 : 0,
      streak: streak
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
};
