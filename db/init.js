// db/init.js
const bcrypt = require('bcryptjs');

module.exports = (db) => {
  // Check if users exist
  const users = db.get('users').value();
  
  if (!users || users.length === 0) {
    // Initialize default database structure
    db.set('users', []).write();
    db.set('tasks.daily', [
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
    ]).write();
    
    db.set('tasks.scheduled', []).write();
    db.set('completions', []).write();
    db.set('auditLogs', []).write();
    db.set('candles', []).write();
    db.set('inspiration.quotes', [
      { text: 'ሰው በእንጀራ ብቻ አይኖርም፤ በእግዚአብሔር አፍ በሚወጣ በየቃሉ ሁሉ ይኖራል።', source: 'ማቴዎስ 4:4', type: 'scripture' },
      { text: 'እግዚአብሔርን ፈራ ትእዛዛቱንም ጠብቅ፤ ይህ የሰው ሁሉ ዕጣ ፈንታ ነውና።', source: 'መክብብ 12:13', type: 'scripture' },
      { text: 'ጸሎት ማለት ከእግዚአብሔር ጋር መነጋገር ነው። እንደ ልጅ ከአባቱ ጋር በቀላሉ ንገሩት።', source: 'ቅዱስ ዮሐንስ አፈወርቅ', type: 'saint' }
    ]).write();
    
    // Create default root admin
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
    
    console.log('✓ Default root admin created (username: admin, password: admin123)');
  }
  
  return db;
};
