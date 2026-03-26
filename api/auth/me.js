const { authenticateToken } = require('../../middleware/auth');
const { db } = require('../_lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  
  const authPromise = new Promise((resolve, reject) => {
    authenticateToken(req, res, (err) => err ? reject(err) : resolve());
  });
  
  try {
    await authPromise;
    const user = db.get('users').find({ id: req.user.id }).value();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password, ...userData } = user;
    res.json(userData);
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};
