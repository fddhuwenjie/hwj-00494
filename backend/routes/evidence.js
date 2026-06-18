const express = require('express');
const router = express.Router();
const { query, queryOne, execute } = require('../utils/db-helpers');

router.get('/', async (req, res, next) => {
  try {
    const { target_type, target_id, evidence_type, page = 1, pageSize = 20 } = req.query;
    let sql = 'SELECT * FROM evidence WHERE 1=1';
    let params = [];

    if (target_type) {
      sql += ' AND target_type = ?';
      params.push(target_type);
    }
    if (target_id) {
      sql += ' AND target_id = ?';
      params.push(parseInt(target_id));
    }
    if (evidence_type) {
      sql += ' AND evidence_type = ?';
      params.push(evidence_type);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const list = await query(sql, params);

    let countSql = 'SELECT COUNT(*) as total FROM evidence WHERE 1=1';
    let countParams = [];
    if (target_type) {
      countSql += ' AND target_type = ?';
      countParams.push(target_type);
    }
    if (target_id) {
      countSql += ' AND target_id = ?';
      countParams.push(parseInt(target_id));
    }
    if (evidence_type) {
      countSql += ' AND evidence_type = ?';
      countParams.push(evidence_type);
    }
    const { total } = await queryOne(countSql, countParams);

    res.json({
      data: list,
      pagination: { page: parseInt(page), pageSize: parseInt(pageSize), total }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const evidence = await queryOne('SELECT * FROM evidence WHERE id = ?', [req.params.id]);
    if (!evidence) {
      return res.status(404).json({ error: '证据不存在' });
    }
    res.json(evidence);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { target_type, target_id, evidence_type, source_title, source_url, photo_date, credibility, notes, uploaded_by } = req.body;

    if (!target_type || !target_id || !evidence_type || !source_title) {
      return res.status(400).json({ error: '目标类型、目标ID、证据类型、来源标题为必填项' });
    }

    if (!['person', 'marriage', 'relationship'].includes(target_type)) {
      return res.status(400).json({ error: '无效的目标类型' });
    }

    if (!['出生证明', '死亡证明', '结婚证', '家谱', '户籍', '照片', '采访记录', '其他'].includes(evidence_type)) {
      return res.status(400).json({ error: '无效的证据类型' });
    }

    let targetExists = false;
    if (target_type === 'person') {
      targetExists = !!(await queryOne('SELECT id FROM persons WHERE id = ?', [target_id]));
    } else if (target_type === 'marriage') {
      targetExists = !!(await queryOne('SELECT id FROM marriages WHERE id = ?', [target_id]));
    } else {
      targetExists = !!(await queryOne('SELECT id FROM relationships WHERE id = ?', [target_id]));
    }

    if (!targetExists) {
      return res.status(404).json({ error: '关联目标不存在' });
    }

    const result = await execute(`
      INSERT INTO evidence (target_type, target_id, evidence_type, source_title, source_url, photo_date, credibility, notes, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      target_type,
      parseInt(target_id),
      evidence_type,
      source_title,
      source_url || null,
      photo_date || null,
      credibility || 3,
      notes || null,
      uploaded_by || '普通成员'
    ]);

    const evidence = await queryOne('SELECT * FROM evidence WHERE id = ?', [result.lastID]);
    res.status(201).json(evidence);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM evidence WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '证据不存在' });
    }

    const { evidence_type, source_title, source_url, photo_date, credibility, notes } = req.body;

    if (evidence_type && !['出生证明', '死亡证明', '结婚证', '家谱', '户籍', '照片', '采访记录', '其他'].includes(evidence_type)) {
      return res.status(400).json({ error: '无效的证据类型' });
    }

    await execute(`
      UPDATE evidence
      SET evidence_type = ?, source_title = ?, source_url = ?, photo_date = ?, credibility = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      evidence_type || existing.evidence_type,
      source_title || existing.source_title,
      source_url !== undefined ? source_url : existing.source_url,
      photo_date !== undefined ? photo_date : existing.photo_date,
      credibility || existing.credibility,
      notes !== undefined ? notes : existing.notes,
      req.params.id
    ]);

    const evidence = await queryOne('SELECT * FROM evidence WHERE id = ?', [req.params.id]);
    res.json(evidence);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM evidence WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '证据不存在' });
    }

    await execute('DELETE FROM evidence WHERE id = ?', [req.params.id]);
    res.json({ message: '删除成功', deletedId: req.params.id });
  } catch (err) {
    next(err);
  }
});

router.get('/by-target/:target_type/:target_id', async (req, res, next) => {
  try {
    const { target_type, target_id } = req.params;

    if (!['person', 'marriage', 'relationship'].includes(target_type)) {
      return res.status(400).json({ error: '无效的目标类型' });
    }

    const list = await query(`
      SELECT * FROM evidence
      WHERE target_type = ? AND target_id = ?
      ORDER BY created_at DESC
    `, [target_type, parseInt(target_id)]);

    res.json({ data: list, total: list.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
