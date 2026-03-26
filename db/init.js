const { v4: uuidv4 } = require('uuid');

module.exports = function(db) {
  // Initialize default collections
  db.defaults({
    users: [],
    tasks: [],
    completions: [],
    auditLogs: [],
    inspirations: [
      { id: uuidv4(), text: "እግዚአብሔር ፍቅር ነው።", source: "1 ዮሐንስ 4:8", createdAt: new Date().toISOString() },
      { id: uuidv4(), text: "በእግዚአብሔር ዘንድ ሁሉ ነገር ይቻላል።", source: "ማቴዎስ 19:26", createdAt: new Date().toISOString() },
      { id: uuidv4(), text: "ጸልዩ፣ አትጨነቁ።", source: "ፊልጵስዩስ 4:6", createdAt: new Date().toISOString() }
    ]
  }).write();

  // Create default tasks for standard users
  const tasks = db.get('tasks').value();
  if (tasks.length === 0) {
    db.get('tasks').push(
      {
        id: uuidv4(),
        name: "Bible Reading",
        nameAmharic: "የመጽሐፍ ቅዱስ ንባብ",
        description: "Daily Bible reading and reflection",
        descriptionAmharic: "ዕለታዊ የመጽሐፍ ቅዱስ ንባብ እና ማሰላሰል",
        type: 'daily',
        icon: "📖",
        order: 1,
        createdAt: new Date().toISOString()
      },
      {
        id: uuidv4(),
        name: "Book Reading",
        nameAmharic: "የመጽሐፍ ንባብ",
        description: "Daily spiritual book reading",
        descriptionAmharic: "ዕለታዊ የመንፈሳዊ መጽሐፍ ንባብ",
        type: 'daily',
        icon: "📚",
        order: 2,
        createdAt: new Date().toISOString()
      },
      {
        id: uuidv4(),
        name: "Church Attendance",
        nameAmharic: "የጉባኤ አቴንዳንስ",
        description: "Attend church service on scheduled date",
        descriptionAmharic: "በተያዘው ቀን የጉባኤ አገልግሎት መከታተል",
        type: 'scheduled',
        icon: "⛪",
        order: 3,
        createdAt: new Date().toISOString()
      },
      {
        id: uuidv4(),
        name: "Meeting the Father",
        nameAmharic: "አባን ማግኘት",
        description: "Meet with spiritual father (any weekday)",
        descriptionAmharic: "ከመንፈሳዊ አባት ጋር መገናኘት (በማንኛውም የሳምንት ቀን)",
        type: 'weekly',
        icon: "👨‍👦",
        order: 4,
        createdAt: new Date().toISOString()
      }
    ).write();
  }

  return db;
};
