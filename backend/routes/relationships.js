const express = require('express');
const router = express.Router();
const { query, queryOne, execute, runTransaction } = require('../utils/db-helpers');

async function checkCycle(parentId, childId) {
  const visited = new Set();
  const queue = [childId];
  
  while (queue.length > 0) {
    const currentId = queue.shift();
    if (currentId == parentId) {
      return true;
    }
    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);
    
    const children = await query(`
      SELECT child_id FROM relationships 
      WHERE parent_id = ? AND relationship_type IN ('父子', '母子', '收养父子', '收养母子')
    `, [currentId]);
    
    children.forEach(c => queue.push(c.child_id));
  }
  return false;
}

async function getPersonParents(personId) {
  const parents = await query(`
    SELECT parent_id, relationship_type FROM relationships
    WHERE child_id = ? AND relationship_type IN ('父子', '母子', '收养父子', '收养母子')
  `, [personId]);
  
  return parents;
}

router.post('/parent-child', async (req, res, next) => {
  try {
    const { parent_id, child_id, relationship_type } = req.body;
    
    if (!parent_id || !child_id || !relationship_type) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    if (!['父子', '母子', '收养父子', '收养母子'].includes(relationship_type)) {
      return res.status(400).json({ error: '无效的关系类型' });
    }
    
    const parent = await queryOne('SELECT * FROM persons WHERE id = ?', [parent_id]);
    const child = await queryOne('SELECT * FROM persons WHERE id = ?', [child_id]);
    
    if (!parent || !child) {
      return res.status(404).json({ error: '人员不存在' });
    }
    
    if (parent.gender === '男' && ['母子', '收养母子'].includes(relationship_type)) {
      return res.status(400).json({ error: '男性不能建立母子关系' });
    }
    if (parent.gender === '女' && ['父子', '收养父子'].includes(relationship_type)) {
      return res.status(400).json({ error: '女性不能建立父子关系' });
    }
    
    const hasCycle = await checkCycle(parent_id, child_id);
    if (hasCycle) {
      return res.status(400).json({ error: '检测到循环关系：一个人不能是自己的祖先' });
    }
    
    const existing = await queryOne(`
      SELECT * FROM relationships 
      WHERE parent_id = ? AND child_id = ? AND relationship_type = ?
    `, [parent_id, child_id, relationship_type]);
    
    if (existing) {
      return res.status(400).json({ error: '该关系已存在' });
    }
    
    const result = await execute(`
      INSERT INTO relationships (parent_id, child_id, relationship_type)
      VALUES (?, ?, ?)
    `, [parent_id, child_id, relationship_type]);
    
    const relationship = await queryOne('SELECT * FROM relationships WHERE id = ?', [result.lastID]);
    res.status(201).json(relationship);
  } catch (err) {
    next(err);
  }
});

router.post('/marriage', async (req, res, next) => {
  try {
    const { husband_id, wife_id, marriage_date, divorce_date } = req.body;
    
    if (!husband_id || !wife_id) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const husband = await queryOne('SELECT * FROM persons WHERE id = ?', [husband_id]);
    const wife = await queryOne('SELECT * FROM persons WHERE id = ?', [wife_id]);
    
    if (!husband || !wife) {
      return res.status(404).json({ error: '人员不存在' });
    }
    
    if (husband.gender !== '男' || wife.gender !== '女') {
      return res.status(400).json({ error: '丈夫必须为男性，妻子必须为女性' });
    }
    
    const existing = await queryOne(`
      SELECT * FROM marriages 
      WHERE ((husband_id = ? AND wife_id = ?) OR (husband_id = ? AND wife_id = ?))
        AND is_active = 1
    `, [husband_id, wife_id, wife_id, husband_id]);
    
    if (existing) {
      return res.status(400).json({ error: '该婚姻关系已存在' });
    }
    
    const husbandMarriages = await query(`
      SELECT MAX(marriage_order) as max_order FROM marriages WHERE husband_id = ?
    `, [husband_id]);
    
    const wifeMarriages = await query(`
      SELECT MAX(marriage_order) as max_order FROM marriages WHERE wife_id = ?
    `, [wife_id]);
    
    const husbandOrder = (husbandMarriages[0]?.max_order || 0) + 1;
    const wifeOrder = (wifeMarriages[0]?.max_order || 0) + 1;
    const marriage_order = Math.max(husbandOrder, wifeOrder);
    
    const is_active = divorce_date ? 0 : 1;
    
    const result = await execute(`
      INSERT INTO marriages (husband_id, wife_id, marriage_order, marriage_date, divorce_date, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [husband_id, wife_id, marriage_order, marriage_date || null, divorce_date || null, is_active]);
    
    if (marriage_date) {
      await execute(`
        INSERT INTO family_events (event_type, event_date, description, person_id, related_person_ids)
        VALUES ('结婚', ?, ?, ?, ?)
      `, [marriage_date, `${husband.name}与${wife.name}结婚`, husband_id, JSON.stringify([wife_id])]);
    }
    
    const marriage = await queryOne('SELECT * FROM marriages WHERE id = ?', [result.lastID]);
    res.status(201).json(marriage);
  } catch (err) {
    next(err);
  }
});

router.post('/sibling', async (req, res, next) => {
  try {
    const { person1_id, person2_id } = req.body;
    
    if (!person1_id || !person2_id) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    if (person1_id == person2_id) {
      return res.status(400).json({ error: '不能与自己建立兄弟姐妹关系' });
    }
    
    const p1 = await queryOne('SELECT * FROM persons WHERE id = ?', [person1_id]);
    const p2 = await queryOne('SELECT * FROM persons WHERE id = ?', [person2_id]);
    
    if (!p1 || !p2) {
      return res.status(404).json({ error: '人员不存在' });
    }
    
    const existing = await queryOne(`
      SELECT * FROM relationships 
      WHERE ((parent_id = ? AND child_id = ?) OR (parent_id = ? AND child_id = ?))
        AND relationship_type = '兄弟姐妹'
    `, [person1_id, person2_id, person2_id, person1_id]);
    
    if (existing) {
      return res.status(400).json({ error: '该兄弟姐妹关系已存在' });
    }
    
    const result = await execute(`
      INSERT INTO relationships (parent_id, child_id, relationship_type)
      VALUES (?, ?, '兄弟姐妹')
    `, [person1_id, person2_id]);
    
    const relationship = await queryOne('SELECT * FROM relationships WHERE id = ?', [result.lastID]);
    res.status(201).json(relationship);
  } catch (err) {
    next(err);
  }
});

router.post('/add-child', async (req, res, next) => {
  try {
    const { father_id, mother_id, child_data } = req.body;
    
    if (!father_id || !mother_id || !child_data) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const father = await queryOne('SELECT * FROM persons WHERE id = ?', [father_id]);
    const mother = await queryOne('SELECT * FROM persons WHERE id = ?', [mother_id]);
    
    if (!father || !mother) {
      return res.status(404).json({ error: '父母不存在' });
    }
    
    if (father.gender !== '男' || mother.gender !== '女') {
      return res.status(400).json({ error: '父亲必须为男性，母亲必须为女性' });
    }
    
    if (!child_data.name || !child_data.gender) {
      return res.status(400).json({ error: '孩子姓名和性别为必填项' });
    }
    
    const marriage = await queryOne(`
      SELECT * FROM marriages 
      WHERE husband_id = ? AND wife_id = ? AND is_active = 1
    `, [father_id, mother_id]);
    
    const queries = [];
    
    queries.push({
      sql: `INSERT INTO persons (name, gender, birth_date, death_date, photo_url, hometown, occupation, bio, is_deceased)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        child_data.name,
        child_data.gender,
        child_data.birth_date || null,
        child_data.death_date || null,
        child_data.photo_url || null,
        child_data.hometown || null,
        child_data.occupation || null,
        child_data.bio || null,
        child_data.death_date ? 1 : 0
      ]
    });
    
    const results = await runTransaction(queries);
    const childId = results[0].lastID;
    
    const hasFatherCycle = await checkCycle(father_id, childId);
    const hasMotherCycle = await checkCycle(mother_id, childId);
    
    if (hasFatherCycle || hasMotherCycle) {
      await execute('DELETE FROM persons WHERE id = ?', [childId]);
      return res.status(400).json({ error: '检测到循环关系' });
    }
    
    await execute(`
      INSERT INTO relationships (parent_id, child_id, relationship_type)
      VALUES (?, ?, '父子')
    `, [father_id, childId]);
    
    await execute(`
      INSERT INTO relationships (parent_id, child_id, relationship_type)
      VALUES (?, ?, '母子')
    `, [mother_id, childId]);
    
    const existingSiblings = await query(`
      SELECT DISTINCT r.child_id as id
      FROM relationships r
      WHERE r.parent_id IN (?, ?) 
        AND r.relationship_type IN ('父子', '母子', '收养父子', '收养母子')
        AND r.child_id != ?
    `, [father_id, mother_id, childId]);
    
    for (const sibling of existingSiblings) {
      await execute(`
        INSERT INTO relationships (parent_id, child_id, relationship_type)
        VALUES (?, ?, '兄弟姐妹')
      `, [childId, sibling.id]);
    }
    
    if (child_data.birth_date) {
      await execute(`
        INSERT INTO family_events (event_type, event_date, description, person_id)
        VALUES ('出生', ?, ?, ?)
      `, [child_data.birth_date, `${child_data.name}出生`, childId]);
    }
    
    const child = await queryOne('SELECT * FROM persons WHERE id = ?', [childId]);
    res.status(201).json(child);
  } catch (err) {
    next(err);
  }
});

router.delete('/parent-child/:id', async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM relationships WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '关系不存在' });
    }
    
    await execute('DELETE FROM relationships WHERE id = ?', [req.params.id]);
    res.json({ message: '关系删除成功' });
  } catch (err) {
    next(err);
  }
});

router.delete('/marriage/:id', async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM marriages WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '婚姻不存在' });
    }
    
    await execute('DELETE FROM marriages WHERE id = ?', [req.params.id]);
    res.json({ message: '婚姻关系删除成功' });
  } catch (err) {
    next(err);
  }
});

router.put('/marriage/:id', async (req, res, next) => {
  try {
    const { marriage_date, divorce_date, is_active } = req.body;
    
    const existing = await queryOne('SELECT * FROM marriages WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '婚姻不存在' });
    }
    
    const newIsActive = divorce_date ? 0 : (is_active !== undefined ? is_active : existing.is_active);
    
    await execute(`
      UPDATE marriages 
      SET marriage_date = ?, divorce_date = ?, is_active = ?
      WHERE id = ?
    `, [
      marriage_date !== undefined ? marriage_date : existing.marriage_date,
      divorce_date !== undefined ? divorce_date : existing.divorce_date,
      newIsActive,
      req.params.id
    ]);
    
    const marriage = await queryOne('SELECT * FROM marriages WHERE id = ?', [req.params.id]);
    res.json(marriage);
  } catch (err) {
    next(err);
  }
});

router.get('/all', async (req, res, next) => {
  try {
    const parentChildRels = await query(`
      SELECT r.*, p1.name as parent_name, p2.name as child_name
      FROM relationships r
      JOIN persons p1 ON r.parent_id = p1.id
      JOIN persons p2 ON r.child_id = p2.id
      WHERE r.relationship_type IN ('父子', '母子', '收养父子', '收养母子')
    `);
    
    const marriages = await query(`
      SELECT m.*, p1.name as husband_name, p2.name as wife_name
      FROM marriages m
      JOIN persons p1 ON m.husband_id = p1.id
      JOIN persons p2 ON m.wife_id = p2.id
    `);
    
    const siblingRels = await query(`
      SELECT r.*, p1.name as person1_name, p2.name as person2_name
      FROM relationships r
      JOIN persons p1 ON r.parent_id = p1.id
      JOIN persons p2 ON r.child_id = p2.id
      WHERE r.relationship_type = '兄弟姐妹'
    `);
    
    res.json({
      parentChild: parentChildRels,
      marriages: marriages,
      siblings: siblingRels
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
