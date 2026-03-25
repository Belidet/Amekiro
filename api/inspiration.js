const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const DB_PATH = '/tmp/db.json';
const adapter = new FileSync(DB_PATH);
const db = low(adapter);

module.exports = (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const quotes = db.get('inspiration.quotes').value();
  const random = quotes[Math.floor(Math.random() * quotes.length)];
  res.json(random);
};
