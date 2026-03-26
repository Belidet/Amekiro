const { db } = require('../_lib/db');
const { authenticateToken } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roles');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    await new Promise((resolve, reject) => {
      authenticateToken(req, res, (err) => err ? reject(err) : resolve());
    });
    await requireRole('root_admin', 'admin')(req, res, () => {});
  } catch (error) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const logs = db.get('auditLogs').orderBy(['timestamp'], ['desc']).take(100).value();
  res.json({ logs });
};
