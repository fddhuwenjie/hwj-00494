const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const PDFDocument = require('pdfkit');
const { query, queryOne, execute, runTransaction } = require('../utils/db-helpers');
const { v4: uuidv4 } = require('uuid');

router.get('/gedcom', async (req, res, next) => {
  try {
    const persons = await query('SELECT * FROM persons ORDER BY id');
    const marriages = await query('SELECT * FROM marriages');
    const relationships = await query(`
      SELECT * FROM relationships 
      WHERE relationship_type IN ('父子', '母子', '收养父子', '收养母子')
    `);
    
    let gedcom = '0 HEAD\n';
    gedcom += '1 GEDC\n';
    gedcom += '2 VERS 5.5.1\n';
    gedcom += '2 FORM LINEAGE-LINKED\n';
    gedcom += '1 CHAR UTF-8\n';
    gedcom += '1 LANG zh\n';
    gedcom += '1 SOUR FamilyTreeApp\n';
    gedcom += '2 NAME 家族族谱系统\n';
    gedcom += '2 VERS 1.0\n';
    gedcom += '1 DATE ' + new Date().toISOString().split('T')[0] + '\n';
    
    const personIdMap = {};
    persons.forEach((p, index) => {
      const indiId = `I${index + 1}`;
      personIdMap[p.id] = indiId;
      
      gedcom += `0 ${indiId} INDI\n`;
      gedcom += `1 NAME ${p.name}\n`;
      gedcom += `1 SEX ${p.gender === '男' ? 'M' : 'F'}\n`;
      
      if (p.birth_date) {
        gedcom += `1 BIRT\n`;
        gedcom += `2 DATE ${p.birth_date}\n`;
      }
      
      if (p.death_date) {
        gedcom += `1 DEAT\n`;
        gedcom += `2 DATE ${p.death_date}\n`;
      }
      
      if (p.hometown) {
        gedcom += `1 BIRT\n`;
        gedcom += `2 PLAC ${p.hometown}\n`;
      }
      
      if (p.occupation) {
        gedcom += `1 OCCU ${p.occupation}\n`;
      }
      
      if (p.bio) {
        gedcom += `1 NOTE ${p.bio}\n`;
      }
    });
    
    marriages.forEach((m, index) => {
      const famId = `F${index + 1}`;
      gedcom += `0 ${famId} FAM\n`;
      gedcom += `1 HUSB ${personIdMap[m.husband_id]}\n`;
      gedcom += `1 WIFE ${personIdMap[m.wife_id]}\n`;
      
      if (m.marriage_date) {
        gedcom += `1 MARR\n`;
        gedcom += `2 DATE ${m.marriage_date}\n`;
      }
      
      if (m.divorce_date) {
        gedcom += `1 DIV\n`;
        gedcom += `2 DATE ${m.divorce_date}\n`;
      }
      
      const children = relationships.filter(r => 
        (r.parent_id === m.husband_id || r.parent_id === m.wife_id) &&
        r.relationship_type.includes('子')
      );
      
      const childIds = new Set();
      children.forEach(c => childIds.add(c.child_id));
      
      childIds.forEach(childId => {
        if (personIdMap[childId]) {
          gedcom += `1 CHIL ${personIdMap[childId]}\n`;
        }
      });
    });
    
    gedcom += '0 TRLR\n';
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="family-tree-${Date.now()}.ged"`);
    res.send(gedcom);
  } catch (err) {
    next(err);
  }
});

router.post('/gedcom', async (req, res, next) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: '缺少GEDCOM内容' });
    }
    
    const lines = content.split('\n');
    const persons = [];
    const families = [];
    let currentIndi = null;
    let currentFam = null;
    
    for (const line of lines) {
      const match = line.match(/^(\d+)\s+(\S+)(?:\s+(.*))?$/);
      if (!match) continue;
      
      const level = parseInt(match[1]);
      const tag = match[2];
      const value = match[3] || '';
      
      if (level === 0) {
        if (tag === 'INDI') {
          if (currentIndi) persons.push(currentIndi);
          currentIndi = { id: value, name: '', gender: '', birth_date: null, death_date: null, hometown: null, occupation: null, bio: null };
        } else if (tag === 'FAM') {
          if (currentFam) families.push(currentFam);
          currentFam = { id: value, husband_id: null, wife_id: null, children: [], marriage_date: null };
        } else {
          if (currentIndi) persons.push(currentIndi);
          if (currentFam) families.push(currentFam);
          currentIndi = null;
          currentFam = null;
        }
      } else if (currentIndi) {
        if (tag === 'NAME') currentIndi.name = value;
        else if (tag === 'SEX') currentIndi.gender = value === 'M' ? '男' : '女';
        else if (tag === 'BIRT') currentIndi._inBirth = true;
        else if (tag === 'DEAT') currentIndi._inDeath = true;
        else if (tag === 'DATE') {
          if (currentIndi._inBirth) currentIndi.birth_date = value;
          else if (currentIndi._inDeath) currentIndi.death_date = value;
        } else if (tag === 'PLAC') {
          if (currentIndi._inBirth) currentIndi.hometown = value;
        } else if (tag === 'OCCU') currentIndi.occupation = value;
        else if (tag === 'NOTE') currentIndi.bio = value;
        
        if (level === 1) {
          currentIndi._inBirth = false;
          currentIndi._inDeath = false;
        }
      } else if (currentFam) {
        if (tag === 'HUSB') currentFam.husband_id = value;
        else if (tag === 'WIFE') currentFam.wife_id = value;
        else if (tag === 'CHIL') currentFam.children.push(value);
        else if (tag === 'MARR') currentFam._inMarriage = true;
        else if (tag === 'DATE' && currentFam._inMarriage) currentFam.marriage_date = value;
        
        if (level === 1) currentFam._inMarriage = false;
      }
    }
    
    if (currentIndi) persons.push(currentIndi);
    if (currentFam) families.push(currentFam);
    
    await execute('DELETE FROM relationships');
    await execute('DELETE FROM marriages');
    await execute('DELETE FROM persons');
    await execute('DELETE FROM family_events');
    
    const idMap = {};
    const queries = [];
    
    for (const p of persons) {
      const is_deceased = p.death_date ? 1 : 0;
      queries.push({
        sql: `INSERT INTO persons (name, gender, birth_date, death_date, hometown, occupation, bio, is_deceased) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [p.name, p.gender, p.birth_date, p.death_date, p.hometown, p.occupation, p.bio, is_deceased]
      });
    }
    
    const results = await runTransaction(queries);
    persons.forEach((p, i) => {
      idMap[p.id] = results[i].lastID;
    });
    
    const marriageQueries = [];
    for (const f of families) {
      if (f.husband_id && f.wife_id) {
        const husbandDbId = idMap[f.husband_id];
        const wifeDbId = idMap[f.wife_id];
        if (husbandDbId && wifeDbId) {
          marriageQueries.push({
            sql: `INSERT INTO marriages (husband_id, wife_id, marriage_order, marriage_date, is_active) VALUES (?, ?, 1, ?, 1)`,
            params: [husbandDbId, wifeDbId, f.marriage_date]
          });
        }
      }
    }
    
    if (marriageQueries.length > 0) {
      await runTransaction(marriageQueries);
    }
    
    for (const f of families) {
      const husbandDbId = idMap[f.husband_id];
      const wifeDbId = idMap[f.wife_id];
      
      for (const childGedId of f.children) {
        const childDbId = idMap[childGedId];
        if (childDbId) {
          if (husbandDbId) {
            await execute(`INSERT INTO relationships (parent_id, child_id, relationship_type) VALUES (?, ?, '父子')`, [husbandDbId, childDbId]);
          }
          if (wifeDbId) {
            await execute(`INSERT INTO relationships (parent_id, child_id, relationship_type) VALUES (?, ?, '母子')`, [wifeDbId, childDbId]);
          }
        }
      }
    }
    
    res.json({
      message: 'GEDCOM导入成功',
      imported_persons: persons.length,
      imported_families: families.length
    });
  } catch (err) {
    next(err);
  }
});

router.get('/png', async (req, res, next) => {
  try {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: 'new'
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.goto(`http://localhost:8494/export-view?type=png`, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });
    
    await page.waitForSelector('#family-tree-container', { timeout: 10000 });
    
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true,
      encoding: 'binary'
    });
    
    await browser.close();
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="family-tree-${Date.now()}.png"`);
    res.send(screenshot);
  } catch (err) {
    next(err);
  }
});

router.get('/pdf', async (req, res, next) => {
  try {
    const persons = await query('SELECT * FROM persons ORDER BY id');
    const marriages = await query('SELECT * FROM marriages');
    const stats = await queryOne(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_deceased = 0 THEN 1 ELSE 0 END) as alive,
        SUM(CASE WHEN is_deceased = 1 THEN 1 ELSE 0 END) as deceased
      FROM persons
    `);
    
    const doc = new PDFDocument({
      layout: 'landscape',
      size: 'A3',
      margin: 50
    });
    
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const result = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="family-tree-${Date.now()}.pdf"`);
      res.send(result);
    });
    
    doc.fontSize(24).text('家族族谱', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(14).text(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
    doc.text(`总人数: ${stats.total} | 在世: ${stats.alive} | 已故: ${stats.deceased}`);
    doc.moveDown();
    
    doc.fontSize(18).text('家族成员列表', { underline: true });
    doc.moveDown();
    
    const pageWidth = doc.page.width - 100;
    const colWidths = [80, 60, 120, 120, 100, pageWidth - 480];
    
    doc.fontSize(12);
    doc.text('姓名', 50, doc.y, { width: colWidths[0], continued: true });
    doc.text('性别', { width: colWidths[1], continued: true });
    doc.text('出生日期', { width: colWidths[2], continued: true });
    doc.text('去世日期', { width: colWidths[3], continued: true });
    doc.text('职业', { width: colWidths[4], continued: true });
    doc.text('籍贯', { width: colWidths[5] });
    
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.5);
    
    persons.forEach((p, index) => {
      if (doc.y > doc.page.height - 100) {
        doc.addPage();
        doc.fontSize(12);
        doc.text('姓名', 50, doc.y, { width: colWidths[0], continued: true });
        doc.text('性别', { width: colWidths[1], continued: true });
        doc.text('出生日期', { width: colWidths[2], continued: true });
        doc.text('去世日期', { width: colWidths[3], continued: true });
        doc.text('职业', { width: colWidths[4], continued: true });
        doc.text('籍贯', { width: colWidths[5] });
        doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
        doc.moveDown(0.5);
      }
      
      doc.text(p.name || '', 50, doc.y, { width: colWidths[0], continued: true });
      doc.text(p.gender || '', { width: colWidths[1], continued: true });
      doc.text(p.birth_date || '-', { width: colWidths[2], continued: true });
      doc.text(p.death_date || '-', { width: colWidths[3], continued: true });
      doc.text(p.occupation || '-', { width: colWidths[4], continued: true });
      doc.text(p.hometown || '-', { width: colWidths[5] });
      doc.moveDown(0.5);
    });
    
    if (marriages.length > 0) {
      doc.addPage();
      doc.fontSize(18).text('婚姻关系', { underline: true });
      doc.moveDown();
      
      const personsMap = {};
      persons.forEach(p => personsMap[p.id] = p);
      
      doc.fontSize(12);
      marriages.forEach((m, index) => {
        const husband = personsMap[m.husband_id];
        const wife = personsMap[m.wife_id];
        if (husband && wife) {
          doc.text(`${index + 1}. ${husband.name} (夫) 与 ${wife.name} (妻)`);
          if (m.marriage_date) doc.text(`   结婚日期: ${m.marriage_date}`);
          if (m.divorce_date) doc.text(`   离婚日期: ${m.divorce_date}`);
          doc.text(`   婚姻顺序: 第${m.marriage_order}段婚姻`);
          doc.moveDown(0.5);
        }
      });
    }
    
    doc.end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
