module.exports = (db) => {
  console.log('Initializing database...');
  
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
        { text: 'እግዚአብሔርን ፈራ ትእዛዛቱንም ጠብቅ፤ ይህ የሰው ሁሉ ዕጣ ፈንታ ነውና።', source: 'መክብብ 12:13', type: 'scripture' }
      ]
    }
  }).write();
  
  console.log('Database defaults written');

  // Create default root admin if no users exist
  const users = db.get('users').value();
  console.log('Current users:', users.length);
  
  if (users.length === 0) {
    console.log('No users found, creating default admin...');
    const bcrypt = require('bcryptjs');
    const defaultPassword = bcrypt.hashSync('admin123', 10);
    
    const newUser = {
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
    };
    
    db.get('users').push(newUser).write();
    console.log('Default admin created successfully!');
    console.log('Username: admin');
    console.log('Password: admin123');
    
    // Add audit log
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
  } else {
    console.log('Users already exist, skipping default creation');
  }
  
  return db;
};
