const express = require('express');
const router = express.Router();
const { query, queryOne, execute } = require('../utils/db-helpers');

function parseDateParts(dateStr) {
  const parts = String(dateStr).split('-').map(Number);
  return { year: parts[0], month: parts[1] - 1, day: parts[2] };
}

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayStr() {
  return formatLocalDate(new Date());
}

function getDaysUntilNextAnniversary(eventDate, todayStr) {
  const { month: eventMonth, day: eventDay } = parseDateParts(eventDate);
  const { year: todayYear, month: todayMonth, day: todayDay } = parseDateParts(todayStr);

  const msPerDay = 1000 * 60 * 60 * 24;
  const todayNoon = new Date(todayYear, todayMonth, todayDay, 12, 0, 0);
  const thisYearAnniv = new Date(todayYear, eventMonth, eventDay, 12, 0, 0);
  const nextYearAnniv = new Date(todayYear + 1, eventMonth, eventDay, 12, 0, 0);

  const diffThisYear = Math.round((thisYearAnniv - todayNoon) / msPerDay);
  const diffNextYear = Math.round((nextYearAnniv - todayNoon) / msPerDay);

  return diffThisYear >= 0 ? diffThisYear : diffNextYear;
}

function getThisYearAnniversaryDate(eventDate, todayStr) {
  const { month: eventMonth, day: eventDay } = parseDateParts(eventDate);
  const { year: todayYear, month: todayMonth, day: todayDay } = parseDateParts(todayStr);

  const msPerDay = 1000 * 60 * 60 * 24;
  const todayNoon = new Date(todayYear, todayMonth, todayDay, 12, 0, 0);
  const thisYearAnniv = new Date(todayYear, eventMonth, eventDay, 12, 0, 0);
  const nextYearAnniv = new Date(todayYear + 1, eventMonth, eventDay, 12, 0, 0);

  const diffThisYear = Math.round((thisYearAnniv - todayNoon) / msPerDay);
  const target = diffThisYear >= 0 ? thisYearAnniv : nextYearAnniv;

  return formatLocalDate(target);
}

router.get('/', async (req, res, next) => {
  try {
    const { 
      person_id, 
      event_type, 
      month, 
      year,
      page = 1, 
      pageSize = 20 
    } = req.query;
    
    let sql = `
      SELECT fa.*, p.name as person_name, p.gender as person_gender, p.photo_url as person_photo
      FROM family_anniversaries fa
      LEFT JOIN persons p ON fa.person_id = p.id
      WHERE 1=1
    `;
    let params = [];
    
    if (person_id) {
      sql += ' AND fa.person_id = ?';
      params.push(person_id);
    }
    
    if (event_type) {
      sql += ' AND fa.event_type = ?';
      params.push(event_type);
    }
    
    if (month) {
      const targetMonth = String(month).padStart(2, '0');
      sql += " AND strftime('%m', fa.event_date) = ?";
      params.push(targetMonth);
    }
    
    if (year) {
      const targetYear = String(year);
      sql += " AND strftime('%Y', fa.event_date) = ?";
      params.push(targetYear);
    }
    
    const countSql = sql.replace('SELECT fa.*, p.name as person_name, p.gender as person_gender, p.photo_url as person_photo', 'SELECT COUNT(*) as total');
    const { total } = await queryOne(countSql, params);
    
    sql += ' ORDER BY fa.event_date LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
    
    const anniversaries = await query(sql, params);
    
    const today = getTodayStr();
    const enriched = anniversaries.map(a => ({
      ...a,
      days_until_next: getDaysUntilNextAnniversary(a.event_date, today),
      this_year_date: getThisYearAnniversaryDate(a.event_date, today)
    }));
    
    res.json({
      data: enriched,
      pagination: { page: parseInt(page), pageSize: parseInt(pageSize), total }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/monthly', async (req, res, next) => {
  try {
    const { year, month } = req.query;
    const today = new Date();
    const targetYear = year ? parseInt(year) : today.getFullYear();
    const targetMonth = month ? parseInt(month) - 1 : today.getMonth();
    
    const startDate = formatLocalDate(new Date(targetYear, targetMonth, 1));
    const endDate = formatLocalDate(new Date(targetYear, targetMonth + 1, 0));
    
    const sql = `
      SELECT fa.*, p.name as person_name, p.gender as person_gender, p.photo_url as person_photo
      FROM family_anniversaries fa
      LEFT JOIN persons p ON fa.person_id = p.id
      WHERE 1=1
    `;
    
    const anniversaries = await query(sql, []);
    
    const todayStr = formatLocalDate(today);
    const monthlyAnniversaries = anniversaries.filter(a => {
      const thisYearDate = getThisYearAnniversaryDate(a.event_date, todayStr);
      return thisYearDate >= startDate && thisYearDate <= endDate;
    }).map(a => ({
      ...a,
      days_until_next: getDaysUntilNextAnniversary(a.event_date, todayStr),
      this_year_date: getThisYearAnniversaryDate(a.event_date, todayStr)
    }));
    
    const birthdayCount = monthlyAnniversaries.filter(a => a.event_type === '生日').length;
    const deathdayCount = monthlyAnniversaries.filter(a => a.event_type === '忌日').length;
    const familyEventCount = monthlyAnniversaries.filter(a => a.event_type === '家族大事').length;
    
    const dayMap = {};
    monthlyAnniversaries.forEach(a => {
      const day = parseInt(a.this_year_date.split('-')[2]);
      if (!dayMap[day]) dayMap[day] = [];
      dayMap[day].push(a);
    });
    
    res.json({
      data: monthlyAnniversaries,
      day_map: dayMap,
      stats: {
        birthday_count: birthdayCount,
        deathday_count: deathdayCount,
        family_event_count: familyEventCount,
        total_count: monthlyAnniversaries.length
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/upcoming', async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const daysNum = parseInt(days);
    
    const sql = `
      SELECT fa.*, p.name as person_name, p.gender as person_gender, p.photo_url as person_photo
      FROM family_anniversaries fa
      LEFT JOIN persons p ON fa.person_id = p.id
      ORDER BY fa.event_date
    `;
    
    const anniversaries = await query(sql, []);
    const today = getTodayStr();
    
    const upcoming = anniversaries
      .map(a => ({
        ...a,
        days_until_next: getDaysUntilNextAnniversary(a.event_date, today),
        this_year_date: getThisYearAnniversaryDate(a.event_date, today)
      }))
      .filter(a => a.days_until_next <= daysNum)
      .sort((a, b) => a.days_until_next - b.days_until_next);
    
    res.json({
      data: upcoming,
      total: upcoming.length
    });
  } catch (err) {
    next(err);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    
    const monthSql = `
      SELECT fa.*, p.name as person_name
      FROM family_anniversaries fa
      LEFT JOIN persons p ON fa.person_id = p.id
    `;
    const allAnniversaries = await query(monthSql, []);
    
    const todayStr = formatLocalDate(today);
    const monthlyList = allAnniversaries.map(a => ({
      ...a,
      this_year_date: getThisYearAnniversaryDate(a.event_date, todayStr)
    })).filter(a => {
      const [y, m] = a.this_year_date.split('-');
      return parseInt(y) === currentYear && parseInt(m) === currentMonth;
    });
    
    const typeStats = await query(`
      SELECT event_type, COUNT(*) as count
      FROM family_anniversaries
      GROUP BY event_type
      ORDER BY count DESC
    `, []);
    
    const personStats = await query(`
      SELECT p.id, p.name, COUNT(fa.id) as anniversary_count
      FROM family_anniversaries fa
      LEFT JOIN persons p ON fa.person_id = p.id
      GROUP BY fa.person_id
      ORDER BY anniversary_count DESC
      LIMIT 10
    `, []);
    
    const upcomingSql = `
      SELECT fa.*, p.name as person_name
      FROM family_anniversaries fa
      LEFT JOIN persons p ON fa.person_id = p.id
    `;
    const allUpcoming = await query(upcomingSql, []);
    const upcoming30 = allUpcoming
      .map(a => ({
        ...a,
        days_until_next: getDaysUntilNextAnniversary(a.event_date, todayStr)
      }))
      .filter(a => a.days_until_next <= 30)
      .sort((a, b) => a.days_until_next - b.days_until_next);
    
    res.json({
      current_month: {
        year: currentYear,
        month: currentMonth,
        birthday_count: monthlyList.filter(a => a.event_type === '生日').length,
        deathday_count: monthlyList.filter(a => a.event_type === '忌日').length,
        family_event_count: monthlyList.filter(a => a.event_type === '家族大事').length,
        wedding_count: monthlyList.filter(a => a.event_type === '结婚纪念日').length,
        relocation_count: monthlyList.filter(a => a.event_type === '迁居纪念').length,
        total_count: monthlyList.length
      },
      by_type: typeStats,
      by_person: personStats,
      upcoming_30_days: upcoming30.slice(0, 10)
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const anniversary = await queryOne(`
      SELECT fa.*, p.name as person_name, p.gender as person_gender, p.photo_url as person_photo
      FROM family_anniversaries fa
      LEFT JOIN persons p ON fa.person_id = p.id
      WHERE fa.id = ?
    `, [req.params.id]);
    
    if (!anniversary) {
      return res.status(404).json({ error: '纪念日不存在' });
    }
    
    const today = getTodayStr();
    anniversary.days_until_next = getDaysUntilNextAnniversary(anniversary.event_date, today);
    anniversary.this_year_date = getThisYearAnniversaryDate(anniversary.event_date, today);
    
    res.json(anniversary);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { 
      person_id, 
      event_type, 
      event_date, 
      is_lunar = 0, 
      repeat_rule = 'yearly', 
      reminder_days = 7, 
      notes 
    } = req.body;
    
    if (!person_id || !event_type || !event_date) {
      return res.status(400).json({ error: '关联人物、事件类型和事件日期为必填项' });
    }
    
    const validTypes = ['生日', '忌日', '结婚纪念日', '迁居纪念', '家族大事'];
    if (!validTypes.includes(event_type)) {
      return res.status(400).json({ error: '无效的事件类型' });
    }
    
    const person = await queryOne('SELECT id FROM persons WHERE id = ?', [person_id]);
    if (!person) {
      return res.status(404).json({ error: '关联人物不存在' });
    }
    
    const result = await execute(`
      INSERT INTO family_anniversaries (person_id, event_type, event_date, is_lunar, repeat_rule, reminder_days, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [person_id, event_type, event_date, is_lunar ? 1 : 0, repeat_rule, reminder_days, notes || null]);
    
    const anniversary = await queryOne(`
      SELECT fa.*, p.name as person_name, p.gender as person_gender, p.photo_url as person_photo
      FROM family_anniversaries fa
      LEFT JOIN persons p ON fa.person_id = p.id
      WHERE fa.id = ?
    `, [result.lastID]);
    
    res.status(201).json(anniversary);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM family_anniversaries WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '纪念日不存在' });
    }
    
    const { 
      person_id, 
      event_type, 
      event_date, 
      is_lunar, 
      repeat_rule, 
      reminder_days, 
      notes 
    } = req.body;
    
    if (person_id) {
      const person = await queryOne('SELECT id FROM persons WHERE id = ?', [person_id]);
      if (!person) {
        return res.status(404).json({ error: '关联人物不存在' });
      }
    }
    
    if (event_type) {
      const validTypes = ['生日', '忌日', '结婚纪念日', '迁居纪念', '家族大事'];
      if (!validTypes.includes(event_type)) {
        return res.status(400).json({ error: '无效的事件类型' });
      }
    }
    
    await execute(`
      UPDATE family_anniversaries 
      SET person_id = ?, event_type = ?, event_date = ?, is_lunar = ?, 
          repeat_rule = ?, reminder_days = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      person_id !== undefined ? person_id : existing.person_id,
      event_type || existing.event_type,
      event_date || existing.event_date,
      is_lunar !== undefined ? (is_lunar ? 1 : 0) : existing.is_lunar,
      repeat_rule || existing.repeat_rule,
      reminder_days !== undefined ? reminder_days : existing.reminder_days,
      notes !== undefined ? notes : existing.notes,
      req.params.id
    ]);
    
    const anniversary = await queryOne(`
      SELECT fa.*, p.name as person_name, p.gender as person_gender, p.photo_url as person_photo
      FROM family_anniversaries fa
      LEFT JOIN persons p ON fa.person_id = p.id
      WHERE fa.id = ?
    `, [req.params.id]);
    
    res.json(anniversary);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM family_anniversaries WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '纪念日不存在' });
    }
    
    await execute('DELETE FROM family_anniversaries WHERE id = ?', [req.params.id]);
    res.json({ message: '删除成功', deletedId: req.params.id });
  } catch (err) {
    next(err);
  }
});

router.get('/by-person/:personId', async (req, res, next) => {
  try {
    const { personId } = req.params;
    
    const person = await queryOne('SELECT id, name FROM persons WHERE id = ?', [personId]);
    if (!person) {
      return res.status(404).json({ error: '人物不存在' });
    }
    
    const anniversaries = await query(`
      SELECT fa.*, p.name as person_name, p.gender as person_gender, p.photo_url as person_photo
      FROM family_anniversaries fa
      LEFT JOIN persons p ON fa.person_id = p.id
      WHERE fa.person_id = ?
      ORDER BY fa.event_date
    `, [personId]);
    
    const today = getTodayStr();
    const enriched = anniversaries.map(a => ({
      ...a,
      days_until_next: getDaysUntilNextAnniversary(a.event_date, today),
      this_year_date: getThisYearAnniversaryDate(a.event_date, today)
    }));
    
    res.json({
      data: enriched,
      person: person,
      total: enriched.length
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
