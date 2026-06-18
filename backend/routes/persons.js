const express = require('express');
const router = express.Router();
const { query, queryOne, execute } = require('../utils/db-helpers');

router.get('/', async (req, res, next) => {
  try {
    const { name, page = 1, pageSize = 20 } = req.query;
    let sql = 'SELECT * FROM persons WHERE 1=1';
    let params = [];
    
    if (name) {
      sql += ' AND name LIKE ?';
      params.push(`%${name}%`);
    }
    
    sql += ' ORDER BY id LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
    
    const persons = await query(sql, params);
    
    const countSql = 'SELECT COUNT(*) as total FROM persons WHERE 1=1' + (name ? ' AND name LIKE ?' : '');
    const countParams = name ? [`%${name}%`] : [];
    const { total } = await queryOne(countSql, countParams);
    
    res.json({
      data: persons,
      pagination: { page: parseInt(page), pageSize: parseInt(pageSize), total }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const person = await queryOne('SELECT * FROM persons WHERE id = ?', [req.params.id]);
    if (!person) {
      return res.status(404).json({ error: '人员不存在' });
    }
    
    const parents = await query(`
      SELECT p.*, r.relationship_type 
      FROM relationships r 
      JOIN persons p ON r.parent_id = p.id 
      WHERE r.child_id = ? AND r.relationship_type IN ('父子', '母子', '收养父子', '收养母子')
    `, [req.params.id]);
    
    const children = await query(`
      SELECT p.*, r.relationship_type 
      FROM relationships r 
      JOIN persons p ON r.child_id = p.id 
      WHERE r.parent_id = ? AND r.relationship_type IN ('父子', '母子', '收养父子', '收养母子')
    `, [req.params.id]);
    
    const marriages = await query(`
      SELECT m.*, 
             CASE WHEN m.husband_id = ? THEN w.name ELSE h.name END as spouse_name,
             CASE WHEN m.husband_id = ? THEN w.gender ELSE h.gender END as spouse_gender,
             CASE WHEN m.husband_id = ? THEN w.id ELSE h.id END as spouse_id
      FROM marriages m
      LEFT JOIN persons h ON m.husband_id = h.id
      LEFT JOIN persons w ON m.wife_id = w.id
      WHERE m.husband_id = ? OR m.wife_id = ?
      ORDER BY m.marriage_order
    `, [req.params.id, req.params.id, req.params.id, req.params.id, req.params.id]);
    
    const siblings = await query(`
      SELECT DISTINCT p.* 
      FROM relationships r1
      JOIN relationships r2 ON r1.child_id = r2.parent_id OR r1.parent_id = r2.child_id
      JOIN persons p ON (r2.child_id = p.id OR r2.parent_id = p.id) AND p.id != ?
      WHERE (r1.parent_id = ? OR r1.child_id = ?) 
        AND r1.relationship_type = '兄弟姐妹'
        AND r2.relationship_type = '兄弟姐妹'
      UNION
      SELECT DISTINCT p.*
      FROM relationships r
      JOIN persons p ON r.parent_id = p.id
      WHERE r.child_id IN (
        SELECT child_id FROM relationships 
        WHERE parent_id = ? AND relationship_type IN ('父子', '母子', '收养父子', '收养母子')
      ) AND r.relationship_type IN ('父子', '母子', '收养父子', '收养母子')
        AND p.id != ?
    `, [req.params.id, req.params.id, req.params.id, req.params.id, req.params.id]);
    
    person.parents = parents;
    person.children = children;
    person.marriages = marriages;
    person.siblings = siblings;
    
    res.json(person);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, gender, birth_date, death_date, photo_url, hometown, occupation, bio } = req.body;
    
    if (!name || !gender) {
      return res.status(400).json({ error: '姓名和性别为必填项' });
    }
    
    const is_deceased = death_date ? 1 : 0;
    
    const result = await execute(`
      INSERT INTO persons (name, gender, birth_date, death_date, photo_url, hometown, occupation, bio, is_deceased)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, gender, birth_date || null, death_date || null, photo_url || null, hometown || null, occupation || null, bio || null, is_deceased]);
    
    if (birth_date) {
      await execute(`
        INSERT INTO family_events (event_type, event_date, description, person_id)
        VALUES ('出生', ?, ?, ?)
      `, [birth_date, `${name}出生`, result.lastID]);
    }
    
    if (death_date) {
      await execute(`
        INSERT INTO family_events (event_type, event_date, description, person_id)
        VALUES ('去世', ?, ?, ?)
      `, [death_date, `${name}逝世`, result.lastID]);
    }
    
    const person = await queryOne('SELECT * FROM persons WHERE id = ?', [result.lastID]);
    res.status(201).json(person);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, gender, birth_date, death_date, photo_url, hometown, occupation, bio } = req.body;
    
    const existing = await queryOne('SELECT * FROM persons WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '人员不存在' });
    }
    
    const is_deceased = death_date ? 1 : 0;
    
    await execute(`
      UPDATE persons 
      SET name = ?, gender = ?, birth_date = ?, death_date = ?, photo_url = ?, 
          hometown = ?, occupation = ?, bio = ?, is_deceased = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name || existing.name, 
      gender || existing.gender, 
      birth_date !== undefined ? birth_date : existing.birth_date, 
      death_date !== undefined ? death_date : existing.death_date, 
      photo_url !== undefined ? photo_url : existing.photo_url, 
      hometown !== undefined ? hometown : existing.hometown, 
      occupation !== undefined ? occupation : existing.occupation, 
      bio !== undefined ? bio : existing.bio, 
      is_deceased,
      req.params.id
    ]);
    
    const person = await queryOne('SELECT * FROM persons WHERE id = ?', [req.params.id]);
    res.json(person);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM persons WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '人员不存在' });
    }
    
    await execute('DELETE FROM persons WHERE id = ?', [req.params.id]);
    res.json({ message: '删除成功', deletedId: req.params.id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
