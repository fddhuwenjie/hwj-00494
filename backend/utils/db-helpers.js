const db = require('../db');

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function queryOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function execute(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function runTransaction(queries) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      try {
        const results = [];
        queries.forEach(({ sql, params }) => {
          const stmt = db.prepare(sql);
          stmt.run(params || []);
          stmt.finalize();
          results.push({ lastID: db.lastID });
        });
        db.run('COMMIT', (err) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
          } else {
            resolve(results);
          }
        });
      } catch (err) {
        db.run('ROLLBACK');
        reject(err);
      }
    });
  });
}

module.exports = { query, queryOne, execute, runTransaction };
