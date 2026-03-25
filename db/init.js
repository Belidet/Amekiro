module.exports = (db) => {
  // Initialize database defaults
  db.defaults({
    users: [],
    tasks: {
      daily: [
        {
          id: 'bible_reading',
          nameAmharic: 'የመጽሐፍ ቅዱስ ንባብ',
          nameEnglish: 'Bible Reading',
          icon: '📖'
        },
        {
          id: 'book_reading',
          nameAmharic: 'የመጽሐፍ ንባብ',
          nameEnglish: 'Book Reading',
          icon: '📚'
        }
      ],
      scheduled: []
    },
    completions: [],
    auditLogs: [],
    candles: [],
    inspiration: {
      quotes: [
        { text: 'ሰው በእንጀራ ብቻ አይኖርም፤ በእግዚአብሔር አፍ በሚወጣ በየቃሉ ሁሉ ይኖራል።', source: 'ማቴዎስ 4:4', type: 'scripture' },
        { text: 'እግዚአብሔርን ፈራ ትእዛዛቱንም ጠብቅ፤ ይህ የሰው ሁሉ ዕጣ ፈንታ ነውና።', source: 'መክብብ 12:13', type: 'scripture' },
        { text: 'ጸሎት ማለት ከእግዚአብሔር ጋር መነጋገር ነው። እንደ ልጅ ከአባቱ ጋር በቀላሉ ንገሩት።', source: 'ቅዱስ ዮሐንስ አፈወርቅ', type: 'saint' },
        { text: 'ልብህን ሰጠኝ ልቤንም ስጠኝ። እንዲህ ነው እግዚአብሔር የሚወደው።', source: 'ቅዱስ ሲልዋኖስ', type: 'saint' }
      ]
    }
  }).write();

  // Create default root admin if no users exist
  const users = db.get('users').value();
  if (users.length === 0) {
    const bcrypt = require('bcryptjs');
    const defaultPassword = bcrypt.hashSync('admin123', 10);
    
    db.get('users')
      .push({
        id: 'root_admin_default',
        username: 'admin',
        passwordHash: defaultPassword,
        role: 'root_admin',
        fullName: 'መጀመሪያ አስተዳዳሪ',
        email: '',
        createdAt: new Date().toISOString(),
        createdByUserId: 'system',
        lastLogin: null,
        isActive: true,
        notes: 'Default root admin - please change password',
        rootAdminBadge: 'Founder'
      })
      .write();
    
    // Add audit log for default admin creation
    db.get('auditLogs')
      .push({
        id: 'audit_default',
        action: 'user_create',
        performedByUserId: 'system',
        targetUserId: 'root_admin_default',
        details: { role: 'root_admin', note: 'Default root admin created on first run' },
        timestamp: new Date().toISOString()
      })
      .write();
    
    console.log('✠ Default root admin created (username: admin, password: admin123) ✠');
    console.log('✠ Please change the password after first login for security ✠');
  }
  
  return db;
};
