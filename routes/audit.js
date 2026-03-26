module.exports = function(db, authenticateToken, requireRole) {
  const router = require('express').Router();
  
  router.get('/', authenticateToken, requireRole('root_admin'), (req, res) => {
    const { limit = 50, offset = 0 } = req.query;
    
    const logs = db.get('auditLogs')
      .orderBy(['timestamp'], ['desc'])
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
      .value();
    
    res.json({
      logs,
      total: db.get('auditLogs').value().length
    });
  });
  
  return router;
};
