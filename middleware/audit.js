const auditLog = (db, uuidv4) => {
  return (action, performedByUserId, targetUserId = null, details = {}) => {
    const logEntry = {
      id: uuidv4(),
      action,
      performedByUserId,
      targetUserId,
      details,
      timestamp: new Date().toISOString()
    };
    
    db.get('auditLogs')
      .push(logEntry)
      .write();
    
    return logEntry;
  };
};

module.exports = auditLog;
