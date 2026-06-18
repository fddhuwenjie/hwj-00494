const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { PORT } = require('./config');

const app = express();

app.use(cors({
  origin: ['http://localhost:3494', 'http://127.0.0.1:3494'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = require('./db');

const personRoutes = require('./routes/persons');
const relationshipRoutes = require('./routes/relationships');
const queryRoutes = require('./routes/queries');
const exportRoutes = require('./routes/export');
const shareRoutes = require('./routes/share');
const evidenceRoutes = require('./routes/evidence');
const revisionRoutes = require('./routes/revisions');

function ensureTableExists(tableName, createSql) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName], (err, row) => {
      if (err) return reject(err);
      if (!row) {
        db.run(createSql, (err2) => {
          if (err2) return reject(err2);
          resolve(true);
        });
      } else {
        resolve(false);
      }
    });
  });
}

function ensureIndexExists(indexName, createSql) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT name FROM sqlite_master WHERE type='index' AND name=?`, [indexName], (err, row) => {
      if (err) return reject(err);
      if (!row) {
        db.run(createSql, (err2) => {
          if (err2) return reject(err2);
          resolve(true);
        });
      } else {
        resolve(false);
      }
    });
  });
}

async function migrateDatabase() {
  const tables = [
    ['evidence', `
      CREATE TABLE evidence (
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
    `],
    ['revision_requests', `
      CREATE TABLE revision_requests (
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
    `],
    ['revision_comments', `
      CREATE TABLE revision_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        revision_id INTEGER NOT NULL,
        author TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (revision_id) REFERENCES revision_requests(id) ON DELETE CASCADE
      )
    `],
    ['change_logs', `
      CREATE TABLE change_logs (
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
    `]
  ];

  const indexes = [
    ['idx_evidence_target', 'CREATE INDEX idx_evidence_target ON evidence(target_type, target_id)'],
    ['idx_revision_status', 'CREATE INDEX idx_revision_status ON revision_requests(status)'],
    ['idx_revision_target', 'CREATE INDEX idx_revision_target ON revision_requests(target_type, target_id)'],
    ['idx_comments_revision', 'CREATE INDEX idx_comments_revision ON revision_comments(revision_id)'],
    ['idx_changelog_target', 'CREATE INDEX idx_changelog_target ON change_logs(target_type, target_id)']
  ];

  for (const [name, sql] of tables) {
    await ensureTableExists(name, sql);
  }
  for (const [name, sql] of indexes) {
    await ensureIndexExists(name, sql);
  }
  console.log('数据库迁移检查完成');
}

migrateDatabase().catch(err => {
  console.error('数据库迁移失败:', err);
});

app.use('/api/persons', personRoutes);
app.use('/api/relationships', relationshipRoutes);
app.use('/api/queries', queryRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/revisions', revisionRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '家族族谱API服务运行正常' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`家族族谱后端服务已启动，端口: ${PORT}`);
  console.log(`API地址: http://localhost:${PORT}`);
});

module.exports = app;
