// api/_lib/db.js
// Centralized database management for Vercel serverless functions

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// Database path handling for Vercel (ephemeral filesystem)
// Vercel uses /tmp for writable storage, local uses project root
const DB_PATH = process.env.VERCEL 
  ? '/tmp/db.json'  // Vercel's writable temp directory
  : path.join(process.cwd(), 'db.json');

// Ensure the database file exists before creating adapter
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({}));
}

// Create database adapter
const adapter = new FileSync(DB_PATH);
const db = low(adapter);

// Initialize database with default structure if empty
function initializeDatabase() {
  // Default collections
  db.defaults({
    users: [],
    tasks: [],
    completions: [],
    auditLogs: [],
    inspirations: [
      { 
        id: uuidv4(),
        text: "እግዚአብሔር ፍቅር ነው።", 
        source: "1 ዮሐንስ 4:8",
        createdAt: new Date().toISOString()
      },
      { 
        id: uuidv4(),
        text: "በእግዚአብሔር ዘንድ ሁሉ ነገር ይቻላል።", 
        source: "ማቴዎስ 19:26",
        createdAt: new Date().toISOString()
      },
      { 
        id: uuidv4(),
        text: "ጸልዩ፣ አትጨነቁ።", 
        source: "ፊልጵስዩስ 4:6",
        createdAt: new Date().toISOString()
      },
      { 
        id: uuidv4(),
        text: "እግዚአብሔር መልካም ነው።", 
        source: "መዝሙረ ዳዊት 34:8",
        createdAt: new Date().toISOString()
      },
      { 
        id: uuidv4(),
        text: "ሰው በእንጀራ ብቻ አይኖርም።", 
        source: "ማቴዎስ 4:4",
        createdAt: new Date().toISOString()
      }
    ]
  }).write();

  // Create default daily tasks if none exist
  const tasks = db.get('tasks').value();
  if (tasks.length === 0) {
    db.get('tasks')
      .push(
        {
          id: uuidv4(),
          name: "Morning Prayer",
          nameAmharic: "ጠዋት ጸሎት",
          description: "Morning prayers and scripture reading",
          descriptionAmharic: "የጠዋት ጸሎት እና ቅዱሳት መጻሕፍትን ማንበብ",
          type: 'daily',
          icon: "🙏",
          order: 1,
          createdAt: new Date().toISOString()
        },
        {
          id: uuidv4(),
          name: "Evening Prayer",
          nameAmharic: "ማታ ጸሎት",
          description: "Evening prayers and reflection",
          descriptionAmharic: "የማታ ጸሎት እና ማሰላሰል",
          type: 'daily',
          icon: "🕯️",
          order: 2,
          createdAt: new Date().toISOString()
        }
      )
      .write();
    console.log('✓ Default daily tasks created');
  }

  console.log(`✓ Database initialized at: ${DB_PATH}`);
  return db;
}

// Helper function to get user by ID
function getUserById(userId) {
  return db.get('users').find({ id: userId }).value();
}

// Helper function to get user by username
function getUserByUsername(username) {
  return db.get('users').find({ username }).value();
}

// Helper function to create audit log entry
function createAuditLog(userId, username, action, target = null, details = null) {
  const logEntry = {
    id: uuidv4(),
    userId: userId,
    username: username || 'anonymous',
    action: action,
    target: target,
    details: details,
    timestamp: new Date().toISOString(),
    ip: null, // Can be populated from request
    userAgent: null // Can be populated from request
  };
  
  db.get('auditLogs').push(logEntry).write();
  return logEntry;
}

// Helper function to get completions for a user on a specific date
function getUserCompletionsForDate(userId, date) {
  return db.get('completions')
    .filter(c => c.userId === userId && c.date === date)
    .value();
}

// Helper function to toggle task completion
function toggleTaskCompletion(userId, taskId, taskType, date, completed) {
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
    return { success: true, updated: true };
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
    return { success: true, updated: false };
  }
}

// Helper function to calculate user streak
function calculateUserStreak(userId, tasks) {
  const completions = db.get('completions')
    .filter(c => c.userId === userId && c.completed === true)
    .value();
  
  if (completions.length === 0) return 0;
  
  // Group completions by date
  const completionsByDate = {};
  completions.forEach(c => {
    if (!completionsByDate[c.date]) {
      completionsByDate[c.date] = [];
    }
    completionsByDate[c.date].push(c);
  });
  
  // Check consecutive days
  const dates = Object.keys(completionsByDate).sort();
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  // Check if today or yesterday has completions
  if (completionsByDate[today] && completionsByDate[today].length > 0) {
    streak = 1;
    // Count backwards
    let currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - 1);
    
    while (true) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (completionsByDate[dateStr] && completionsByDate[dateStr].length > 0) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
  } else if (completionsByDate[yesterday] && completionsByDate[yesterday].length > 0) {
    streak = 1;
    let currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - 2);
    
    while (true) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (completionsByDate[dateStr] && completionsByDate[dateStr].length > 0) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
  }
  
  return streak;
}

// Helper function to get analytics data
function getAnalyticsData() {
  const users = db.get('users').value();
  const completions = db.get('completions').value();
  const tasks = db.get('tasks').filter({ type: 'daily' }).value();
  
  const totalCompletions = completions.length;
  const completedTasks = completions.filter(c => c.completed).length;
  const overallPercentage = totalCompletions > 0 ? (completedTasks / totalCompletions) * 100 : 0;
  
  const userProgress = users.map(user => {
    const userCompletions = completions.filter(c => c.userId === user.id);
    const userCompleted = userCompletions.filter(c => c.completed).length;
    const streak = calculateUserStreak(user.id, tasks);
    
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
  
  return {
    overall: {
      totalUsers: users.length,
      totalTasks: tasks.length,
      totalCompletions: totalCompletions,
      completedTasks: completedTasks,
      completionRate: overallPercentage
    },
    userProgress: userProgress
  };
}

// Initialize database
initializeDatabase();

// Export database instance and helper functions
module.exports = {
  db,
  getUserById,
  getUserByUsername,
  createAuditLog,
  getUserCompletionsForDate,
  toggleTaskCompletion,
  calculateUserStreak,
  getAnalyticsData,
  DB_PATH
};
