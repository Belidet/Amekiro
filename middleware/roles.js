const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions. Required role: ' + roles.join(' or ') });
    }
    next();
  };
};

const requireRootAdmin = requireRole('root_admin');
const requireAdmin = requireRole('root_admin', 'admin');
const requireAnyUser = requireRole('root_admin', 'admin', 'standard');

module.exports = { requireRole, requireRootAdmin, requireAdmin, requireAnyUser };
