const express = require('express');
const router = express.Router();

module.exports = (db, authenticateToken, requireRole) => {
  // Get audit logs (root admin only)
  router.get('/', authenticateToken, requireRole('root_admin'), (req, res) => {
    const { limit = 100, offset = 0 } = req.query;
    
    let logs = db.get('auditLogs')
      .orderBy(['timestamp'], ['desc'])
      .value();
    
    const total = logs.length;
    logs = logs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    // Enrich logs with user info
    const enrichedLogs = logs.map(log => {
      const performer = db.get('users').find({ id: log.performedByUserId }).value();
      const target = log.targetUserId ? db.get('users').find({ id: log.targetUserId }).value() : null;
      
      return {
        ...log,
        performerUsername: performer?.username || 'System',
        targetUsername: target?.username || null
      };
    });
    
    res.json({
      logs: enrichedLogs,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  });
  
  return router;
};
