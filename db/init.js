const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

module.exports = function(db) {
  // Initialize default collections
  db.defaults({
    users: [],
    tasks: [],
    completions: [],
    auditLogs: [],
    inspirations: [
      { text: "እግዚአብሔር ፍቅር ነው።", source: "1 ዮሐንስ 4:8" },
      { text: "በእግዚአብሔር ዘንድ ሁሉ ነገር ይቻላል።", source: "ማቴዎስ 19:26" },
      { text: "ጸልዩ፣ አትጨነቁ።", source: "ፊልጵስዩስ 4:6" },
      { text: "እግዚአብሔር መልካም ነው።", source: "መዝሙረ ዳዊት 34:8" },
      { text: "ሰው በእንጀራ ብቻ አይኖርም።", source: "ማቴዎስ 4:4" }
    ]
  }).write();
  
  // Create default daily tasks
  const tasks = db.get('tasks').value();
  if (tasks.length === 0) {
    db.get('tasks')
      .push(
        {
          id: uuidv4(),
          name: "Morning Prayer",
          nameAmharic: "ጠዋት ጸሎት",
          description: "Morning prayers and scripture reading",
          descriptionAmharic: "የጠዋት ጸሎት እና ቅዱሳት መጻሕፍትን ማንበብ",
          type: 'daily',
          icon: "🙏",
          order: 1,
          createdAt: new Date().toISOString()
        },
        {
          id: uuidv4(),
          name: "Evening Prayer",
          nameAmharic: "ማታ ጸሎት",
          description: "Evening prayers and reflection",
          descriptionAmharic: "የማታ ጸሎት እና ማሰላሰል",
          type: 'daily',
          icon: "🕯️",
          order: 2,
          createdAt: new Date().toISOString()
        }
      )
      .write();
    console.log('✓ Default daily tasks created');
  }
  
  return db;
};
