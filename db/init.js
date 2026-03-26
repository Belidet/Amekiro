module.exports = function(db) {
  // Initialize default collections
  db.defaults({
    users: [],
    tasks: [],
    completions: [],
    auditLogs: [],
    inspirations: []
  }).write();
  
  // Create default admin user if no users exist
  const users = db.get('users').value();
  if (users.length === 0) {
    const bcrypt = require('bcryptjs');
    const defaultPassword = bcrypt.hashSync('admin123', 12);
    
    db.get('users')
      .push({
        id: '1',
        username: 'admin',
        password: defaultPassword,
        fullName: 'Administrator',
        role: 'root_admin',
        createdAt: new Date().toISOString()
      })
      .write();
    
    console.log('✓ Default admin user created (username: admin, password: admin123)');
  }
  
  // Create default daily tasks if none exist
  const tasks = db.get('tasks').value();
  if (tasks.length === 0) {
    const defaultTasks = [
      {
        id: '1',
        name: 'Morning Prayer',
        nameAmharic: 'ጠዋት ጸሎት',
        description: 'Morning prayers and scripture reading',
        descriptionAmharic: 'የጠዋት ጸሎት እና ቅዱሳት መጻሕፍትን ማንበብ',
        type: 'daily',
        icon: '🙏',
        order: 1,
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        name: 'Evening Prayer',
        nameAmharic: 'ማታ ጸሎት',
        description: 'Evening prayers and reflection',
        descriptionAmharic: 'የማታ ጸሎት እና ማሰላሰል',
        type: 'daily',
        icon: '🕯️',
        order: 2,
        createdAt: new Date().toISOString()
      }
    ];
    
    db.get('tasks')
      .push(...defaultTasks)
      .write();
    
    console.log('✓ Default daily tasks created');
  }
  
  // Create default inspirations if none exist
  const inspirations = db.get('inspirations').value();
  if (inspirations.length === 0) {
    const defaultInspirations = [
      {
        text: "እግዚአብሔር ፍቅር ነው።",
        source: "1 ዮሐንስ 4:8"
      },
      {
        text: "በእግዚአብሔር ዘንድ ሁሉ ነገር ይቻላል።",
        source: "ማቴዎስ 19:26"
      },
      {
        text: "ጸልዩ፣ አትጨነቁ።",
        source: "ፊልጵስዩስ 4:6"
      }
    ];
    
    db.get('inspirations')
      .push(...defaultInspirations)
      .write();
    
    console.log('✓ Default inspirations created');
  }
  
  return db;
};
