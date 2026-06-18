const express = require('express');
const router = express.Router();
const { query, queryOne, execute, runTransaction } = require('../utils/db-helpers');
const { detectConflicts } = require('../utils/conflict-detector');

const STATUSES = {
  PENDING: 'pending',
  NEED_MORE: 'need_more_info',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

const STATUS_LABELS = {
  pending: '待审核',
  need_more_info: '需补充',
  approved: '已通过',
  rejected: '已拒绝'
};

function parseJsonSafe(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function stringifyData(data) {
  if (data === undefined || data === null) return null;
  return JSON.stringify(data);
}

router.get('/', async (req, res, next) => {
  try {
    const { status, submitter, person_name, target_type, page = 1, pageSize = 20 } = req.query;
    let sql = `
      SELECT rr.*,
        CASE WHEN rr.target_type = 'person' AND rr.target_id IS NOT NULL THEN p.name
             WHEN rr.target_type = 'marriage' AND rr.target_id IS NOT NULL THEN 
               (SELECT p1.name || ' & ' || p2.name FROM marriages m 
                JOIN persons p1 ON m.husband_id = p1.id 
                JOIN persons p2 ON m.wife_id = p2.id WHERE m.id = rr.target_id)
             WHEN rr.target_type = 'relationship' AND rr.target_id IS NOT NULL THEN
               (SELECT p1.name || ' - ' || p2.name FROM relationships r
                JOIN persons p1 ON r.parent_id = p1.id
                JOIN persons p2 ON r.child_id = p2.id WHERE r.id = rr.target_id)
        END as target_name
      FROM revision_requests rr
      LEFT JOIN persons p ON rr.target_type = 'person' AND rr.target_id = p.id
      WHERE 1=1
    `;
    let params = [];

    if (status) {
      sql += ' AND rr.status = ?';
      params.push(status);
    }
    if (submitter) {
      sql += ' AND rr.submitter LIKE ?';
      params.push(`%${submitter}%`);
    }
    if (target_type) {
      sql += ' AND rr.target_type = ?';
      params.push(target_type);
    }
    if (person_name) {
      sql += ` AND (
        (rr.target_type = 'person' AND EXISTS (SELECT 1 FROM persons p WHERE p.id = rr.target_id AND p.name LIKE ?))
        OR (rr.target_type = 'marriage' AND EXISTS (
            SELECT 1 FROM marriages m 
            JOIN persons ph ON m.husband_id = ph.id 
            JOIN persons pw ON m.wife_id = pw.id 
            WHERE m.id = rr.target_id AND (ph.name LIKE ? OR pw.name LIKE ?)))
        OR (rr.target_type = 'relationship' AND EXISTS (
            SELECT 1 FROM relationships r
            JOIN persons pp ON r.parent_id = pp.id
            JOIN persons pc ON r.child_id = pc.id
            WHERE r.id = rr.target_id AND (pp.name LIKE ? OR pc.name LIKE ?)))
      )`;
      const pattern = `%${person_name}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    sql += ' ORDER BY rr.submitted_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const list = await query(sql, params);

    const enriched = list.map(r => ({
      ...r,
      status_label: STATUS_LABELS[r.status] || r.status,
      before_data: parseJsonSafe(r.before_data),
      after_data: parseJsonSafe(r.after_data),
      evidence_ids: parseJsonSafe(r.evidence_ids)
    }));

    let countSql = `
      SELECT COUNT(*) as total FROM revision_requests rr
      LEFT JOIN persons p ON rr.target_type = 'person' AND rr.target_id = p.id
      WHERE 1=1
    `;
    let countParams = [];
    if (status) {
      countSql += ' AND rr.status = ?';
      countParams.push(status);
    }
    if (submitter) {
      countSql += ' AND rr.submitter LIKE ?';
      countParams.push(`%${submitter}%`);
    }
    if (target_type) {
      countSql += ' AND rr.target_type = ?';
      countParams.push(target_type);
    }
    if (person_name) {
      countSql += ` AND (
        (rr.target_type = 'person' AND EXISTS (SELECT 1 FROM persons p WHERE p.id = rr.target_id AND p.name LIKE ?))
        OR (rr.target_type = 'marriage' AND EXISTS (
            SELECT 1 FROM marriages m 
            JOIN persons ph ON m.husband_id = ph.id 
            JOIN persons pw ON m.wife_id = pw.id 
            WHERE m.id = rr.target_id AND (ph.name LIKE ? OR pw.name LIKE ?)))
        OR (rr.target_type = 'relationship' AND EXISTS (
            SELECT 1 FROM relationships r
            JOIN persons pp ON r.parent_id = pp.id
            JOIN persons pc ON r.child_id = pc.id
            WHERE r.id = rr.target_id AND (pp.name LIKE ? OR pc.name LIKE ?)))
      )`;
      const pattern = `%${person_name}%`;
      countParams.push(pattern, pattern, pattern, pattern, pattern);
    }
    const { total } = await queryOne(countSql, countParams);

    res.json({
      data: enriched,
      pagination: { page: parseInt(page), pageSize: parseInt(pageSize), total }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) {
      return next();
    }
    const revision = await queryOne('SELECT * FROM revision_requests WHERE id = ?', [req.params.id]);
    if (!revision) {
      return res.status(404).json({ error: '修订申请不存在' });
    }

    const comments = await query(`
      SELECT * FROM revision_comments
      WHERE revision_id = ?
      ORDER BY created_at ASC
    `, [req.params.id]);

    let evidenceList = [];
    const evidenceIds = parseJsonSafe(revision.evidence_ids);
    if (evidenceIds && evidenceIds.length > 0) {
      const placeholders = evidenceIds.map(() => '?').join(',');
      evidenceList = await query(`SELECT * FROM evidence WHERE id IN (${placeholders})`, evidenceIds);
    }

    res.json({
      ...revision,
      status_label: STATUS_LABELS[revision.status] || revision.status,
      before_data: parseJsonSafe(revision.before_data),
      after_data: parseJsonSafe(revision.after_data),
      evidence_ids: evidenceIds,
      evidence: evidenceList,
      comments
    });
  } catch (err) {
    next(err);
  }
});

router.post('/detect-conflicts', async (req, res, next) => {
  try {
    const { target_type, target_id, data } = req.body;

    if (!target_type || !data) {
      return res.status(400).json({ error: '目标类型和数据为必填项' });
    }

    if (!['person', 'marriage', 'relationship'].includes(target_type)) {
      return res.status(400).json({ error: '无效的目标类型' });
    }

    const conflicts = await detectConflicts(target_type, data, target_id);
    const hasError = conflicts.some(c => c.severity === 'error');
    const hasWarning = conflicts.some(c => c.severity === 'warning');

    res.json({
      conflicts,
      has_errors: hasError,
      has_warnings: hasWarning,
      summary: hasError ? `存在${conflicts.filter(c => c.severity === 'error').length}个严重冲突` :
               hasWarning ? `存在${conflicts.filter(c => c.severity === 'warning').length}个警告` :
               '未检测到冲突'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { target_type, target_id, action, before_data, after_data, reason, evidence_ids, submitter, run_conflict_check = true } = req.body;

    if (!target_type || !action || !after_data || !reason) {
      return res.status(400).json({ error: '目标类型、操作类型、变更后数据、申请理由为必填项' });
    }

    if (!['person', 'marriage', 'relationship'].includes(target_type)) {
      return res.status(400).json({ error: '无效的目标类型' });
    }

    if (!['create', 'update', 'delete'].includes(action)) {
      return res.status(400).json({ error: '无效的操作类型' });
    }

    if (action !== 'create' && !target_id) {
      return res.status(400).json({ error: '更新或删除操作需要指定目标ID' });
    }

    if (run_conflict_check && action !== 'delete') {
      const conflicts = await detectConflicts(target_type, after_data, target_id);
      const hasError = conflicts.some(c => c.severity === 'error');
      if (hasError) {
        return res.status(400).json({
          error: '数据存在冲突，请修正后提交',
          conflicts
        });
      }
    }

    let existingBefore = before_data;
    if (!existingBefore && target_id) {
      if (target_type === 'person') {
        existingBefore = await queryOne('SELECT * FROM persons WHERE id = ?', [target_id]);
      } else if (target_type === 'marriage') {
        existingBefore = await queryOne('SELECT * FROM marriages WHERE id = ?', [target_id]);
      } else {
        existingBefore = await queryOne('SELECT * FROM relationships WHERE id = ?', [target_id]);
      }
    }

    const result = await execute(`
      INSERT INTO revision_requests (target_type, target_id, action, before_data, after_data, reason, evidence_ids, submitter)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      target_type,
      target_id ? parseInt(target_id) : null,
      action,
      stringifyData(existingBefore),
      stringifyData(after_data),
      reason,
      evidence_ids ? stringifyData(evidence_ids) : null,
      submitter || '普通成员'
    ]);

    const revision = await queryOne('SELECT * FROM revision_requests WHERE id = ?', [result.lastID]);
    res.status(201).json({
      ...revision,
      status_label: STATUS_LABELS[revision.status],
      before_data: parseJsonSafe(revision.before_data),
      after_data: parseJsonSafe(revision.after_data),
      evidence_ids: parseJsonSafe(revision.evidence_ids)
    });
  } catch (err) {
    next(err);
  }
});

async function applyPersonChange(afterData, action, targetId) {
  if (action === 'create') {
    const { name, gender, birth_date, death_date, photo_url, hometown, occupation, bio } = afterData;
    if (!name || !gender) {
      throw new Error('姓名和性别为必填项');
    }
    const is_deceased = death_date ? 1 : 0;
    const result = await execute(`
      INSERT INTO persons (name, gender, birth_date, death_date, photo_url, hometown, occupation, bio, is_deceased)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, gender, birth_date || null, death_date || null, photo_url || null, hometown || null, occupation || null, bio || null, is_deceased]);
    return result.lastID;
  } else if (action === 'update') {
    const existing = await queryOne('SELECT * FROM persons WHERE id = ?', [targetId]);
    if (!existing) throw new Error('人员不存在');
    const { name, gender, birth_date, death_date, photo_url, hometown, occupation, bio } = afterData;
    const is_deceased = death_date ? 1 : 0;
    await execute(`
      UPDATE persons SET name = ?, gender = ?, birth_date = ?, death_date = ?, photo_url = ?,
        hometown = ?, occupation = ?, bio = ?, is_deceased = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name || existing.name, gender || existing.gender,
      birth_date !== undefined ? birth_date : existing.birth_date,
      death_date !== undefined ? death_date : existing.death_date,
      photo_url !== undefined ? photo_url : existing.photo_url,
      hometown !== undefined ? hometown : existing.hometown,
      occupation !== undefined ? occupation : existing.occupation,
      bio !== undefined ? bio : existing.bio,
      is_deceased, targetId
    ]);
    return targetId;
  } else if (action === 'delete') {
    await execute('DELETE FROM persons WHERE id = ?', [targetId]);
    return targetId;
  }
}

async function applyMarriageChange(afterData, action, targetId) {
  if (action === 'create') {
    const { husband_id, wife_id, marriage_order, marriage_date, divorce_date, is_active } = afterData;
    if (!husband_id || !wife_id) throw new Error('丈夫和妻子ID为必填项');
    const result = await execute(`
      INSERT INTO marriages (husband_id, wife_id, marriage_order, marriage_date, divorce_date, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      parseInt(husband_id), parseInt(wife_id),
      marriage_order || 1,
      marriage_date || null, divorce_date || null,
      is_active !== undefined ? is_active : (divorce_date ? 0 : 1)
    ]);
    return result.lastID;
  } else if (action === 'update') {
    const existing = await queryOne('SELECT * FROM marriages WHERE id = ?', [targetId]);
    if (!existing) throw new Error('婚姻不存在');
    const { marriage_date, divorce_date, is_active, marriage_order } = afterData;
    await execute(`
      UPDATE marriages SET marriage_date = ?, divorce_date = ?, is_active = ?, marriage_order = ?
      WHERE id = ?
    `, [
      marriage_date !== undefined ? marriage_date : existing.marriage_date,
      divorce_date !== undefined ? divorce_date : existing.divorce_date,
      is_active !== undefined ? is_active : existing.is_active,
      marriage_order !== undefined ? marriage_order : existing.marriage_order,
      targetId
    ]);
    return targetId;
  } else if (action === 'delete') {
    await execute('DELETE FROM marriages WHERE id = ?', [targetId]);
    return targetId;
  }
}

async function applyRelationshipChange(afterData, action, targetId) {
  if (action === 'create') {
    const { parent_id, child_id, relationship_type } = afterData;
    if (!parent_id || !child_id || !relationship_type) throw new Error('父/母ID、子女ID、关系类型为必填项');
    const result = await execute(`
      INSERT INTO relationships (parent_id, child_id, relationship_type)
      VALUES (?, ?, ?)
    `, [parseInt(parent_id), parseInt(child_id), relationship_type]);
    return result.lastID;
  } else if (action === 'update') {
    const existing = await queryOne('SELECT * FROM relationships WHERE id = ?', [targetId]);
    if (!existing) throw new Error('关系不存在');
    const { parent_id, child_id, relationship_type } = afterData;
    await execute(`
      UPDATE relationships SET parent_id = ?, child_id = ?, relationship_type = ?
      WHERE id = ?
    `, [
      parent_id !== undefined ? parseInt(parent_id) : existing.parent_id,
      child_id !== undefined ? parseInt(child_id) : existing.child_id,
      relationship_type || existing.relationship_type,
      targetId
    ]);
    return targetId;
  } else if (action === 'delete') {
    await execute('DELETE FROM relationships WHERE id = ?', [targetId]);
    return targetId;
  }
}

router.post('/:id/review', async (req, res, next) => {
  try {
    const { status, reviewer, review_notes } = req.body;

    if (!status || !['approved', 'rejected', 'need_more_info'].includes(status)) {
      return res.status(400).json({ error: '无效的审核状态' });
    }

    const revision = await queryOne('SELECT * FROM revision_requests WHERE id = ?', [req.params.id]);
    if (!revision) {
      return res.status(404).json({ error: '修订申请不存在' });
    }

    if (revision.status === STATUSES.APPROVED || revision.status === STATUSES.REJECTED) {
      return res.status(400).json({ error: '该申请已完成审核，不能再次审核' });
    }

    const afterData = parseJsonSafe(revision.after_data);
    let finalTargetId = revision.target_id;

    if (status === STATUSES.APPROVED) {
      try {
        if (revision.target_type === 'person') {
          finalTargetId = await applyPersonChange(afterData, revision.action, revision.target_id);
        } else if (revision.target_type === 'marriage') {
          finalTargetId = await applyMarriageChange(afterData, revision.action, revision.target_id);
        } else if (revision.target_type === 'relationship') {
          finalTargetId = await applyRelationshipChange(afterData, revision.action, revision.target_id);
        }
      } catch (applyErr) {
        return res.status(400).json({ error: '应用变更失败: ' + applyErr.message });
      }

      await execute(`
        INSERT INTO change_logs (target_type, target_id, action, before_data, after_data, revision_id, operator, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        revision.target_type,
        finalTargetId,
        revision.action,
        revision.before_data,
        revision.after_data,
        revision.id,
        reviewer || '管理员',
        review_notes || '审核通过'
      ]);
    }

    await execute(`
      UPDATE revision_requests
      SET status = ?, reviewer = ?, review_notes = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, reviewer || '管理员', review_notes || null, req.params.id]);

    const updated = await queryOne('SELECT * FROM revision_requests WHERE id = ?', [req.params.id]);
    res.json({
      ...updated,
      status_label: STATUS_LABELS[updated.status],
      before_data: parseJsonSafe(updated.before_data),
      after_data: parseJsonSafe(updated.after_data),
      evidence_ids: parseJsonSafe(updated.evidence_ids),
      applied_target_id: finalTargetId
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/comments', async (req, res, next) => {
  try {
    const { author, content } = req.body;

    if (!content) {
      return res.status(400).json({ error: '评论内容为必填项' });
    }

    const revision = await queryOne('SELECT id FROM revision_requests WHERE id = ?', [req.params.id]);
    if (!revision) {
      return res.status(404).json({ error: '修订申请不存在' });
    }

    const result = await execute(`
      INSERT INTO revision_comments (revision_id, author, content)
      VALUES (?, ?, ?)
    `, [parseInt(req.params.id), author || '匿名', content]);

    const comment = await queryOne('SELECT * FROM revision_comments WHERE id = ?', [result.lastID]);
    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/comments', async (req, res, next) => {
  try {
    const comments = await query(`
      SELECT * FROM revision_comments
      WHERE revision_id = ?
      ORDER BY created_at ASC
    `, [req.params.id]);

    res.json({ data: comments, total: comments.length });
  } catch (err) {
    next(err);
  }
});

router.get('/change-logs/:target_type/:target_id', async (req, res, next) => {
  try {
    const { target_type, target_id } = req.params;

    if (!['person', 'marriage', 'relationship'].includes(target_type)) {
      return res.status(400).json({ error: '无效的目标类型' });
    }

    const logs = await query(`
      SELECT cl.*, rr.submitter, rr.reason, rr.reviewer
      FROM change_logs cl
      LEFT JOIN revision_requests rr ON cl.revision_id = rr.id
      WHERE cl.target_type = ? AND cl.target_id = ?
      ORDER BY cl.created_at DESC
    `, [target_type, parseInt(target_id)]);

    const enriched = logs.map(log => ({
      ...log,
      before_data: parseJsonSafe(log.before_data),
      after_data: parseJsonSafe(log.after_data)
    }));

    res.json({ data: enriched, total: enriched.length });
  } catch (err) {
    next(err);
  }
});

router.post('/rollback/:log_id', async (req, res, next) => {
  try {
    const { operator, notes } = req.body;

    const log = await queryOne('SELECT * FROM change_logs WHERE id = ?', [req.params.log_id]);
    if (!log) {
      return res.status(404).json({ error: '变更记录不存在' });
    }

    const rollbackData = parseJsonSafe(log.before_data);
    if (!rollbackData && log.action !== 'create') {
      return res.status(400).json({ error: '回滚数据不存在' });
    }

    let rollbackAction;
    if (log.action === 'create') {
      rollbackAction = 'delete';
    } else if (log.action === 'delete') {
      rollbackAction = 'create';
    } else {
      rollbackAction = 'update';
    }

    let finalTargetId = log.target_id;

    try {
      if (log.target_type === 'person') {
        finalTargetId = await applyPersonChange(rollbackData || {}, rollbackAction, log.target_id);
      } else if (log.target_type === 'marriage') {
        finalTargetId = await applyMarriageChange(rollbackData || {}, rollbackAction, log.target_id);
      } else if (log.target_type === 'relationship') {
        finalTargetId = await applyRelationshipChange(rollbackData || {}, rollbackAction, log.target_id);
      }
    } catch (applyErr) {
      return res.status(400).json({ error: '回滚失败: ' + applyErr.message });
    }

    const currentAfter = log.action === 'create' ? log.after_data : log.before_data;
    const currentBefore = log.action === 'create' ? log.before_data : log.after_data;

    await execute(`
      INSERT INTO change_logs (target_type, target_id, action, before_data, after_data, revision_id, operator, notes)
      VALUES (?, ?, 'rollback', ?, ?, ?, ?, ?)
    `, [
      log.target_type,
      finalTargetId,
      currentBefore,
      currentAfter,
      null,
      operator || '管理员',
      notes || `回滚到变更 #${log.id} 之前的状态`
    ]);

    res.json({
      message: '回滚成功',
      target_type: log.target_type,
      target_id: finalTargetId,
      rolled_back_to: log.id
    });
  } catch (err) {
    next(err);
  }
});

router.get('/statuses', (req, res) => {
  res.json({
    statuses: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))
  });
});

module.exports = router;
