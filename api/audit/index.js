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
    await requireRole('root_admin')(req, res, () => {});
  } catch (error) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  const { limit = 50, offset = 0 } = req.query;
  
  const logs = db.get('auditLogs')
    .orderBy(['timestamp'], ['desc'])
    .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
    .value();
  
  res.json({
    logs,
    total: db.get('auditLogs').value().length
  });
};
