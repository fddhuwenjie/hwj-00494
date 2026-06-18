const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, execute } = require('../utils/db-helpers');
const { JWT_SECRET, SHARE_TOKEN_EXPIRES_IN } = require('../config');

router.post('/create', async (req, res, next) => {
  try {
    const { created_by, expires_at } = req.body;
    
    const token = jwt.sign(
      { 
        type: 'share',
        created_by: created_by || null,
        share_id: uuidv4()
      },
      JWT_SECRET,
      { expiresIn: SHARE_TOKEN_EXPIRES_IN }
    );
    
    const result = await execute(`
      INSERT INTO share_links (token, created_by, expires_at)
      VALUES (?, ?, ?)
    `, [token, created_by || null, expires_at || null]);
    
    const shareUrl = `/share/${token}`;
    
    res.json({
      id: result.lastID,
      token,
      share_url: shareUrl,
      created_by: created_by || null,
      expires_at: expires_at || null,
      read_only: true
    });
  } catch (err) {
    next(err);
  }
});

router.get('/validate/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      const shareLink = await queryOne('SELECT * FROM share_links WHERE token = ?', [token]);
      
      if (!shareLink) {
        return res.status(404).json({ valid: false, error: '分享链接不存在' });
      }
      
      if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
        return res.status(401).json({ valid: false, error: '分享链接已过期' });
      }
      
      res.json({
        valid: true,
        read_only: true,
        decoded,
        share_link: shareLink
      });
    } catch (jwtErr) {
      res.status(401).json({ valid: false, error: '无效的分享令牌' });
    }
  } catch (err) {
    next(err);
  }
});

router.get('/list', async (req, res, next) => {
  try {
    const shareLinks = await query(`
      SELECT sl.*, p.name as created_by_name
      FROM share_links sl
      LEFT JOIN persons p ON sl.created_by = p.id
      ORDER BY sl.created_at DESC
    `);
    
    res.json(shareLinks);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM share_links WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '分享链接不存在' });
    }
    
    await execute('DELETE FROM share_links WHERE id = ?', [req.params.id]);
    res.json({ message: '分享链接已撤销' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
