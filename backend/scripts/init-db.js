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

  db.run(`
    CREATE TABLE IF NOT EXISTS evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL CHECK(target_type IN ('person', 'marriage', 'relationship')),
      target_id INTEGER NOT NULL,
      evidence_type TEXT NOT NULL CHECK(evidence_type IN ('出生证明', '死亡证明', '结婚证', '家谱', '户籍', '照片', '采访记录', '其他')),
      source_title TEXT NOT NULL,
      source_url TEXT,
      photo_date TEXT,
      credibility INTEGER NOT NULL DEFAULT 3 CHECK(credibility BETWEEN 1 AND 5),
      notes TEXT,
      uploaded_by TEXT DEFAULT '系统',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS revision_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL CHECK(target_type IN ('person', 'marriage', 'relationship')),
      target_id INTEGER,
      action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete')),
      before_data TEXT,
      after_data TEXT NOT NULL,
      reason TEXT NOT NULL,
      evidence_ids TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'need_more_info', 'approved', 'rejected')),
      submitter TEXT DEFAULT '普通成员',
      reviewer TEXT,
      review_notes TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS revision_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      revision_id INTEGER NOT NULL,
      author TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (revision_id) REFERENCES revision_requests(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS change_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL CHECK(target_type IN ('person', 'marriage', 'relationship')),
      target_id INTEGER NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete', 'rollback')),
      before_data TEXT,
      after_data TEXT,
      revision_id INTEGER,
      operator TEXT DEFAULT '系统',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (revision_id) REFERENCES revision_requests(id) ON DELETE SET NULL
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_relationships_parent ON relationships(parent_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_relationships_child ON relationships(child_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_marriages_husband ON marriages(husband_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_marriages_wife ON marriages(wife_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_evidence_target ON evidence(target_type, target_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_revision_status ON revision_requests(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_revision_target ON revision_requests(target_type, target_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_comments_revision ON revision_comments(revision_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_changelog_target ON change_logs(target_type, target_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS family_anniversaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL,
      event_type TEXT NOT NULL CHECK(event_type IN ('生日', '忌日', '结婚纪念日', '迁居纪念', '家族大事')),
      event_date TEXT NOT NULL,
      is_lunar INTEGER DEFAULT 0,
      repeat_rule TEXT DEFAULT 'yearly',
      reminder_days INTEGER DEFAULT 7,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_anniversaries_person ON family_anniversaries(person_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_anniversaries_date ON family_anniversaries(event_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_anniversaries_type ON family_anniversaries(event_type)`);

  console.log('数据库初始化完成！');
});

db.close();
