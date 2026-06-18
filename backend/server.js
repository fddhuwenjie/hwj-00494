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

app.use('/api/persons', personRoutes);
app.use('/api/relationships', relationshipRoutes);
app.use('/api/queries', queryRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/share', shareRoutes);

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
