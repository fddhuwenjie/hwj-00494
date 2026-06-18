const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'family_tree.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`PRAGMA foreign_keys = ON`);

  db.run(`
    CREATE TABLE IF NOT EXISTS persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      gender TEXT NOT NULL CHECK(gender IN ('男', '女')),
      birth_date TEXT,
      death_date TEXT,
      photo_url TEXT,
      hometown TEXT,
      occupation TEXT,
      bio TEXT,
      is_deceased INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS marriages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      husband_id INTEGER NOT NULL,
      wife_id INTEGER NOT NULL,
      marriage_order INTEGER NOT NULL DEFAULT 1,
      marriage_date TEXT,
      divorce_date TEXT,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (husband_id) REFERENCES persons(id) ON DELETE CASCADE,
      FOREIGN KEY (wife_id) REFERENCES persons(id) ON DELETE CASCADE,
      UNIQUE(husband_id, wife_id, marriage_order)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER,
      child_id INTEGER,
      relationship_type TEXT NOT NULL CHECK(relationship_type IN ('父子', '母子', '收养父子', '收养母子', '兄弟姐妹')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES persons(id) ON DELETE CASCADE,
      FOREIGN KEY (child_id) REFERENCES persons(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS share_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      created_by INTEGER,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES persons(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS family_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      event_date TEXT NOT NULL,
      description TEXT,
      person_id INTEGER,
      related_person_ids TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE SET NULL
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_relationships_parent ON relationships(parent_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_relationships_child ON relationships(child_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_marriages_husband ON marriages(husband_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_marriages_wife ON marriages(wife_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name)`);

  console.log('数据库初始化完成！');
});

db.close();
