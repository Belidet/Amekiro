const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = process.env.VERCEL ? '/tmp/db.json' : path.join(process.cwd(), 'db.json');

if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({}));
}

const adapter = new FileSync(DB_PATH);
const db = low(adapter);

const initDb = require('../../db/init');
initDb(db);

function getUserById(userId) {
  return db.get('users').find({ id: userId }).value();
}

function getUserByUsername(username) {
  return db.get('users').find({ username }).value();
}

function createAuditLog(userId, username, action, target = null) {
  db.get('auditLogs').push({
    id: uuidv4(),
    userId,
    username: username || 'anonymous',
    action,
    target,
    timestamp: new Date().toISOString()
  }).write();
}

function getCompletionsForUser(userId, date = null) {
  let completions = db.get('completions').filter({ userId }).value();
  if (date) {
    completions = completions.filter(c => c.date === date);
  }
  return completions;
}

function toggleCompletion(userId, taskId, taskType, date, completed) {
  const existing = db.get('completions').find({ userId, taskId, taskType, date }).value();
  
  if (existing) {
    db.get('completions').find({ userId, taskId, taskType, date }).assign({ completed, updatedAt: new Date().toISOString() }).write();
  } else {
    db.get('completions').push({
      id: uuidv4(),
      userId,
      taskId,
      taskType,
      date,
      completed,
      createdAt: new Date().toISOString()
    }).write();
  }
  return { success: true };
}

function getAnalytics() {
  const users = db.get('users').value();
  const completions = db.get('completions').value();
  const tasks = db.get('tasks').value();
  
  const userProgress = users.filter(u => u.role === 'standard').map(user => {
    const userCompletions = completions.filter(c => c.userId === user.id);
    const completedCount = userCompletions.filter(c => c.completed).length;
    const totalTasks = tasks.length;
    
    return {
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      completedCount,
      totalTasks,
      percentage: totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0
    };
  });
  
  return {
    totalUsers: users.filter(u => u.role === 'standard').length,
    totalAdmins: users.filter(u => u.role === 'admin' || u.role === 'root_admin').length,
    userProgress
  };
}

module.exports = {
  db,
  getUserById,
  getUserByUsername,
  createAuditLog,
  getCompletionsForUser,
  toggleCompletion,
  getAnalytics
};
