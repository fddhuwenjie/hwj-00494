const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { DB_PATH } = require('../config');

const dbPath = path.join(__dirname, '..', DB_PATH);
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`PRAGMA foreign_keys = ON`);
});

module.exports = db;
