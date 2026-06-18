const express = require('express');
const router = express.Router();
const { query, queryOne, execute } = require('../utils/db-helpers');

async function getPersonParents(personId) {
  const parents = await query(`
    SELECT parent_id, relationship_type FROM relationships
    WHERE child_id = ? AND relationship_type IN ('父子', '母子', '收养父子', '收养母子')
  `, [personId]);
  return parents;
}

async function getPersonChildren(personId) {
  const children = await query(`
    SELECT child_id, relationship_type FROM relationships
    WHERE parent_id = ? AND relationship_type IN ('父子', '母子', '收养父子', '收养母子')
  `, [personId]);
  return children;
}

async function getPersonSpouses(personId) {
  const spouses = await query(`
    SELECT DISTINCT 
      CASE WHEN m.husband_id = ? THEN w.id ELSE h.id END as id,
      CASE WHEN m.husband_id = ? THEN w.name ELSE h.name END as name,
      m.marriage_order, m.marriage_date, m.divorce_date, m.is_active
    FROM marriages m
    LEFT JOIN persons h ON m.husband_id = h.id
    LEFT JOIN persons w ON m.wife_id = w.id
    WHERE m.husband_id = ? OR m.wife_id = ?
  `, [personId, personId, personId, personId]);
  return spouses;
}

async function findPathBFS(startId, endId) {
  const queue = [[startId]];
  const visited = new Set();
  const pathMap = new Map();
  
  while (queue.length > 0) {
    const currentPath = queue.shift();
    const currentId = currentPath[currentPath.length - 1];
    
    if (currentId == endId) {
      return currentPath;
    }
    
    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);
    
    const parents = await getPersonParents(currentId);
    for (const p of parents) {
      if (!visited.has(p.parent_id)) {
        queue.push([...currentPath, p.parent_id]);
        pathMap.set(`${currentId}-${p.parent_id}`, { type: 'parent', relationship: p.relationship_type });
      }
    }
    
    const children = await getPersonChildren(currentId);
    for (const c of children) {
      if (!visited.has(c.child_id)) {
        queue.push([...currentPath, c.child_id]);
        pathMap.set(`${currentId}-${c.child_id}`, { type: 'child', relationship: c.relationship_type });
      }
    }
    
    const spouses = await getPersonSpouses(currentId);
    for (const s of spouses) {
      if (!visited.has(s.id)) {
        queue.push([...currentPath, s.id]);
        pathMap.set(`${currentId}-${s.id}`, { type: 'spouse', relationship: '夫妻' });
      }
    }
  }
  
  return null;
}

function getRelationshipDescription(path, personsMap) {
  if (path.length < 2) return '';
  
  const descriptions = [];
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];
    const fromPerson = personsMap[from];
    const toPerson = personsMap[to];
    
    const rel = getRelationshipType(from, to, fromPerson, toPerson);
    descriptions.push(rel);
  }
  
  return descriptions.join('的');
}

function getRelationshipType(fromId, toId, fromPerson, toPerson) {
  if (fromPerson.gender === '男' && toPerson.gender === '男') {
    return '儿子';
  } else if (fromPerson.gender === '男' && toPerson.gender === '女') {
    return '女儿';
  } else if (fromPerson.gender === '女' && toPerson.gender === '男') {
    return '儿子';
  } else {
    return '女儿';
  }
}

router.get('/search', async (req, res, next) => {
  try {
    const { name } = req.query;
    
    if (!name) {
      return res.status(400).json({ error: '请输入搜索关键词' });
    }
    
    const persons = await query(`
      SELECT * FROM persons 
      WHERE name LIKE ? 
      ORDER BY name
    `, [`%${name}%`]);
    
    res.json(persons);
  } catch (err) {
    next(err);
  }
});

router.get('/relationship-path', async (req, res, next) => {
  try {
    const { person1_id, person2_id } = req.query;
    
    if (!person1_id || !person2_id) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    if (person1_id == person2_id) {
      return res.json({ path: [person1_id], description: '同一个人', relationship: '本人' });
    }
    
    const p1 = await queryOne('SELECT * FROM persons WHERE id = ?', [person1_id]);
    const p2 = await queryOne('SELECT * FROM persons WHERE id = ?', [person2_id]);
    
    if (!p1 || !p2) {
      return res.status(404).json({ error: '人员不存在' });
    }
    
    const path = await findPathBFS(parseInt(person1_id), parseInt(person2_id));
    
    if (!path) {
      return res.json({ path: null, description: '未找到关系路径' });
    }
    
    const personsMap = {};
    for (const id of path) {
      const person = await queryOne('SELECT * FROM persons WHERE id = ?', [id]);
      personsMap[id] = person;
    }
    
    const pathDetails = [];
    for (let i = 0; i < path.length - 1; i++) {
      const fromId = path[i];
      const toId = path[i + 1];
      const fromPerson = personsMap[fromId];
      const toPerson = personsMap[toId];
      
      const relType = await queryOne(`
        SELECT * FROM relationships 
        WHERE ((parent_id = ? AND child_id = ?) OR (parent_id = ? AND child_id = ?)
        AND relationship_type IN ('父子', '母子', '收养父子', '收养母子')
      `, [fromId, toId, toId, fromId]);
      
      const marriage = await queryOne(`
        SELECT * FROM marriages 
        WHERE (husband_id = ? AND wife_id = ?) OR (husband_id = ? AND wife_id = ?)
      `, [fromId, toId, toId, fromId]);
      
      let relationship = '';
      let direction = '';
      
      if (relType) {
        if (relType.parent_id == fromId) {
          relationship = relType.relationship_type;
          direction = 'parent_to_child';
        } else {
          if (relType.relationship_type.includes('父子')) {
            relationship = fromPerson.gender === '男' ? '父子' : '母子';
          } else {
            relationship = fromPerson.gender === '男' ? '母子' : '父子';
          }
          direction = 'child_to_parent';
        }
      } else if (marriage) {
        relationship = '夫妻';
        direction = 'spouse';
      }
      
      pathDetails.push({
        from: fromPerson,
        to: toPerson,
        relationship,
        direction
      });
    }
    
    let finalRelationship = '';
    const gender1 = p1.gender;
    const gender2 = p2.gender;
    
    const pathLength = path.length - 1;
    
    if (pathLength === 1) {
      const firstRel = pathDetails[0];
      if (firstRel.relationship === '夫妻') {
        finalRelationship = gender1 === '男' ? '妻子' : '丈夫';
      } else if (firstRel.direction === 'parent_to_child') {
        finalRelationship = gender2 === '男' ? '儿子' : '女儿';
      } else {
        finalRelationship = gender1 === '男' ? '父亲' : '母亲';
      }
    } else if (pathLength === 2) {
      const rel1 = pathDetails[0];
      const rel2 = pathDetails[1];
      
      if (rel1.direction === 'child_to_parent' && rel2.direction === 'parent_to_child') {
        if (rel2.to.gender === '男') {
          finalRelationship = '兄弟';
        } else {
          finalRelationship = '姐妹';
        }
        if (rel1.to.gender === '男' && rel2.to.gender !== rel1.to.gender) {
          finalRelationship = '兄弟姐妹';
        }
      } else if (rel1.direction === 'child_to_parent' && rel2.direction === 'child_to_parent') {
        finalRelationship = gender2 === '男' ? '祖父' : '祖母';
      } else if (rel1.direction === 'parent_to_child' && rel2.direction === 'parent_to_child') {
        finalRelationship = gender2 === '男' ? '孙子' : '孙女';
      } else if (rel1.direction === 'parent_to_child' && rel2.direction === 'child_to_parent') {
        finalRelationship = gender2 === '男' ? '岳父/公公' : '岳母/婆婆';
      } else if (rel1.relationship === '夫妻') {
        if (rel2.direction === 'parent_to_child') {
          finalRelationship = gender2 === '男' ? '继子' : '继女';
        } else {
            finalRelationship = gender2 === '男' ? '继父' : '继母';
          }
      }
    } else if (pathLength === 3) {
      const firstUp = pathDetails.filter(r => r.direction === 'child_to_parent').length;
      const firstDown = pathDetails.filter(r => r.direction === 'parent_to_child').length;
      
      if (firstUp === 2 && firstDown === 1) {
        finalRelationship = gender2 === '男' ? '叔叔/舅舅' : '姑姑/阿姨';
      } else if (firstUp === 1 && firstDown === 2) {
        finalRelationship = gender2 === '男' ? '侄子' : '侄女';
      } else if (firstUp === 3) {
        finalRelationship = gender2 === '男' ? '曾祖父' : '曾祖母';
      } else if (firstDown === 3) {
        finalRelationship = gender2 === '男' ? '曾孙' : '曾孙女';
      }
    } else {
      const upCount = pathDetails.filter(r => r.direction === 'child_to_parent').length;
      const downCount = pathDetails.filter(r => r.direction === 'parent_to_child').length;
      
      if (upCount > 0 && downCount > 0) {
        if (Math.abs(upCount - downCount) === 1) {
          const cousinLevel = Math.min(upCount, downCount) - 1;
          const suffix = gender2 === '男' ? '表兄' : '表姐';
          if (cousinLevel === 0) {
            finalRelationship = gender2 === '男' ? '表兄' : '表姐';
          } else if (cousinLevel === 1) {
            finalRelationship = '远房表亲';
          }
        }
      } else if (upCount > 0) {
          if (upCount === 4) finalRelationship = gender2 === '男' ? '高祖父' : '高祖母';
          else finalRelationship = `${upCount}代祖先`;
        } else if (downCount > 0) {
          if (downCount === 4) finalRelationship = gender2 === '男' ? '玄孙' : '玄孙女';
          else finalRelationship = `${downCount}代后代`;
        }
    }
    
    if (!finalRelationship) {
      const relDescriptions = pathDetails.map(d => {
        if (d.direction === 'parent_to_child') return d.to.gender === '男' ? '子' : '女';
        if (d.direction === 'child_to_parent') return d.to.gender === '男' ? '父' : '母';
        if (d.direction === 'spouse') return '配偶';
        return '';
      }).join('的');
      finalRelationship = relDescriptions;
    }
    
    res.json({
      path,
      pathDetails,
      persons: personsMap,
      relationship: finalRelationship,
      description: `${p1.name}是${p2.name}的${finalRelationship}`
    });
  } catch (err) {
    next(err);
  }
});

router.get('/descendants/:id', async (req, res, next) => {
  try {
    const personId = req.params.id;
    const { include_self = 'false' } = req.query;
    
    const person = await queryOne('SELECT * FROM persons WHERE id = ?', [personId]);
    if (!person) {
      return res.status(404).json({ error: '人员不存在' });
    }
    
    const visited = new Set();
    const descendants = [];
    const queue = [{ id: personId, generation: 0 }];
    
    while (queue.length > 0) {
      const { id, generation } = queue.shift();
      
      if (visited.has(id)) continue;
      visited.add(id);
      
      const children = await getPersonChildren(id);
      for (const child of children) {
        if (!visited.has(child.child_id)) {
          const childPerson = await queryOne('SELECT * FROM persons WHERE id = ?', [child.child_id]);
          descendants.push({
            ...childPerson,
            generation: generation + 1,
            relationship_type: child.relationship_type
          });
          queue.push({ id: child.child_id, generation: generation + 1 });
        }
      }
    }
    
    const generations = {};
    descendants.forEach(d => {
      if (!generations[d.generation]) {
        generations[d.generation] = [];
      }
      generations[d.generation].push(d);
    });
    
    let result = descendants;
    if (include_self === 'true') {
      result = [{ ...person, generation: 0 }, ...descendants];
    }
    
    res.json({
      total: result.length,
      data: result,
      generations,
      max_generation: Math.max(...Object.keys(generations).map(Number), 0)
    });
  } catch (err) {
    next(err);
  }
});

router.get('/ancestors/:id', async (req, res, next) => {
  try {
    const personId = req.params.id;
    const { include_self = 'false' } = req.query;
    
    const person = await queryOne('SELECT * FROM persons WHERE id = ?', [personId]);
    if (!person) {
      return res.status(404).json({ error: '人员不存在' });
    }
    
    const visited = new Set();
    const ancestors = [];
    const queue = [{ id: personId, generation: 0 }];
    
    while (queue.length > 0) {
      const { id, generation } = queue.shift();
      
      if (visited.has(id)) continue;
      visited.add(id);
      
      const parents = await getPersonParents(id);
      for (const parent of parents) {
        if (!visited.has(parent.parent_id)) {
          const parentPerson = await queryOne('SELECT * FROM persons WHERE id = ?', [parent.parent_id]);
          ancestors.push({
            ...parentPerson,
            generation: generation + 1,
            relationship_type: parent.relationship_type
          });
          queue.push({ id: parent.parent_id, generation: generation + 1 });
        }
      }
    }
    
    const generations = {};
    ancestors.forEach(a => {
      if (!generations[a.generation]) {
        generations[a.generation] = [];
      }
      generations[a.generation].push(a);
    });
    
    let result = ancestors;
    if (include_self === 'true') {
      result = [{ ...person, generation: 0 }, ...ancestors];
    }
    
    res.json({
      total: result.length,
      data: result,
      generations,
      max_generation: Math.max(...Object.keys(generations).map(Number), 0)
    });
  } catch (err) {
    next(err);
  }
});

router.get('/generation-stats', async (req, res, next) => {
  try {
    const allPersons = await query('SELECT * FROM persons');
    
    const personGenerations = {};
    const visited = new Set();
    
    async function findGeneration(personId, currentGen) {
      if (visited.has(personId)) return;
      visited.add(personId);
      
      personGenerations[personId] = Math.max(personGenerations[personId] || 0, currentGen);
      
      const children = await getPersonChildren(personId);
      for (const c of children) {
        await findGeneration(c.child_id, currentGen + 1);
      }
    }
    
    const rootPersons = [];
    for (const person of allPersons) {
      const parents = await getPersonParents(person.id);
      if (parents.length === 0) {
        rootPersons.push(person);
      }
    }
    
    for (const root of rootPersons) {
      await findGeneration(root.id, 1);
    }
    
    const genStats = {};
    for (const [id, gen] of Object.entries(personGenerations)) {
      if (!genStats[gen]) genStats[gen] = 0;
      genStats[gen]++;
    }
    
    const sortedGens = Object.entries(genStats)
      .map(([gen, count]) => ({ generation: parseInt(gen), count }))
      .sort((a, b) => a.generation - b.generation);
    
    res.json(sortedGens);
  } catch (err) {
    next(err);
  }
});

router.get('/longest-chain', async (req, res, next) => {
  try {
    const allPersons = await query('SELECT * FROM persons ORDER BY birth_date');
    
    let longestPath = [];
    let longestLength = 0;
    
    async function dfs(personId, path) {
      const children = await getPersonChildren(personId);
      if (children.length === 0) {
        if (path.length > longestLength) {
          longestLength = path.length;
          longestPath = [...path];
        }
        return;
      }
      
      for (const child of children) {
        if (!path.includes(child.child_id)) {
          dfs(child.child_id, [...path, child.child_id]);
        }
      }
    }
    
    const rootPersons = [];
    for (const person of allPersons) {
      const parents = await getPersonParents(person.id);
      if (parents.length === 0) {
        rootPersons.push(person);
      }
    }
    
    for (const root of rootPersons) {
      await dfs(root.id, [root.id]);
    }
    
    const chainPersons = [];
    for (const id of longestPath) {
      const p = await queryOne('SELECT * FROM persons WHERE id = ?', [id]);
      chainPersons.push(p);
    }
    
    res.json({
      length: longestLength,
      path: longestPath,
      persons: chainPersons
    });
  } catch (err) {
    next(err);
  }
});

router.get('/family-stats', async (req, res, next) => {
  try {
    const totalResult = await queryOne('SELECT COUNT(*) as total FROM persons');
    const aliveResult = await queryOne('SELECT COUNT(*) as alive FROM persons WHERE is_deceased = 0');
    const deceasedResult = await queryOne('SELECT COUNT(*) as deceased FROM persons WHERE is_deceased = 1');
    
    const genStats = await query(`
      WITH RECURSIVE
      roots AS (
        SELECT id, 1 as generation
        FROM persons p
        WHERE NOT EXISTS (
          SELECT 1 FROM relationships r 
          WHERE r.child_id = p.id 
            AND r.relationship_type IN ('父子', '母子', '收养父子', '收养母子')
        )
      ),
      gen AS (
        SELECT id, generation FROM roots
        UNION ALL
        SELECT r.child_id, g.generation + 1
        FROM gen g
        JOIN relationships r ON r.parent_id = g.id
        WHERE r.relationship_type IN ('父子', '收养父子')
      )
      SELECT generation, COUNT(*) as count
      FROM gen
      GROUP BY generation
      ORDER BY generation
    `);
    
    const deceasedPersons = await query(`
      SELECT birth_date, death_date FROM persons WHERE is_deceased = 1 AND birth_date IS NOT NULL AND death_date IS NOT NULL
    `);
    
    let totalLifespan = 0;
    let lifespanCount = 0;
    
    deceasedPersons.forEach(p => {
      const birth = new Date(p.birth_date);
      const death = new Date(p.death_date);
      const years = (death - birth) / (1000 * 60 * 60 * 24 * 365.25);
      totalLifespan += years;
      lifespanCount++;
    });
    
    const avgLifespan = lifespanCount > 0 ? (totalLifespan / lifespanCount).toFixed(1) : 0;
    
    const surnameStats = await query(`
      SELECT SUBSTR(name, 1, 1) as surname, COUNT(*) as count
      FROM persons
      GROUP BY surname
      ORDER BY count DESC
    `);
    
    const hometownStats = await query(`
      SELECT hometown, COUNT(*) as count
      FROM persons
      WHERE hometown IS NOT NULL AND hometown != ''
      GROUP BY hometown
      ORDER BY count DESC
    `);
    
    const marriedInSurnames = [];
    const marriages = await query('SELECT * FROM marriages');
    for (const m of marriages) {
      const wife = await queryOne('SELECT * FROM persons WHERE id = ?', [m.wife_id]);
      const husband = await queryOne('SELECT * FROM persons WHERE id = ?', [m.husband_id]);
      
      if (wife && husband && wife.name[0] !== husband.name[0]) {
        const wifeSurname = wife.name[0];
        const existing = marriedInSurnames.find(s => s.surname === wifeSurname);
        if (existing) {
          existing.count++;
        } else {
          marriedInSurnames.push({ surname: wifeSurname, count: 1 });
        }
      }
    }
    
    res.json({
      total: totalResult.total,
      alive: aliveResult.alive,
      deceased: deceasedResult.deceased,
      generations: genStats,
      average_lifespan: parseFloat(avgLifespan),
      surname_distribution: surnameStats,
      married_in_surnames: marriedInSurnames.sort((a, b) => b.count - a.count),
      hometown_distribution: hometownStats
    });
  } catch (err) {
    next(err);
  }
});

router.get('/timeline', async (req, res, next) => {
  try {
    const events = await query(`
      SELECT fe.*, p.name as person_name
      FROM family_events fe
      LEFT JOIN persons p ON fe.person_id = p.id
      ORDER BY fe.event_date
    `);
    
    const yearGroups = {};
    events.forEach(e => {
      const year = e.event_date.substring(0, 4);
      if (!yearGroups[year]) {
        yearGroups[year] = [];
      }
      yearGroups[year].push(e);
    });
    
    const timeline = Object.entries(yearGroups)
      .map(([year, events]) => ({
        year: parseInt(year),
        events: events.sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
      }))
      .sort((a, b) => a.year - b.year);
    
    res.json(timeline);
  } catch (err) {
    next(err);
  }
});

router.get('/tree-data', async (req, res, next) => {
  try {
    const allPersons = await query('SELECT * FROM persons');
    const allRels = await query(`
      SELECT * FROM relationships 
      WHERE relationship_type IN ('父子', '母子', '收养父子', '收养母子')
    `);
    const allMarriages = await query('SELECT * FROM marriages');
    
    const personsMap = {};
    allPersons.forEach(p => {
      personsMap[p.id] = { ...p, children: [], parents: [], spouses: [] };
    });
    
    allRels.forEach(r => {
      if (r.parent_id && personsMap[r.parent_id]) {
        personsMap[r.child_id]?.parents.push({
          id: r.parent_id,
          relationship_type: r.relationship_type
        });
      }
      if (r.child_id && personsMap[r.child_id]) {
        personsMap[r.parent_id]?.children.push({
          id: r.child_id,
          relationship_type: r.relationship_type
        });
      }
    });
    
    allMarriages.forEach(m => {
      if (personsMap[m.husband_id]) {
        personsMap[m.husband_id].spouses.push({
          id: m.wife_id,
          marriage_order: m.marriage_order,
          marriage_date: m.marriage_date,
          is_active: m.is_active
        });
      }
      if (personsMap[m.wife_id]) {
        personsMap[m.wife_id].spouses.push({
          id: m.husband_id,
          marriage_order: m.marriage_order,
          marriage_date: m.marriage_date,
          is_active: m.is_active
        });
      }
    });
    
    const rootNodes = allPersons.filter(p => {
      const hasParent = allRels.some(r => r.child_id === p.id);
      return !hasParent;
    });
    
    function buildTree(personId, visited = new Set()) {
      if (visited.has(personId)) return null;
      visited.add(personId);
      
      const person = personsMap[personId];
      if (!person) return null;
      
      const node = {
        id: person.id,
        name: person.name,
        gender: person.gender,
        birth_date: person.birth_date,
        death_date: person.death_date,
        photo_url: person.photo_url,
        hometown: person.hometown,
        occupation: person.occupation,
        is_deceased: person.is_deceased,
        spouses: person.spouses.map(s => ({
          ...personsMap[s.id],
          marriage_order: s.marriage_order,
          marriage_date: s.marriage_date,
          is_active: s.is_active
        })),
        children: []
      };
      
      const childIds = new Set();
      person.children.forEach(c => {
        childIds.add(c.id);
      });
      
      person.spouses.forEach(spouse => {
        const spousePerson = personsMap[spouse.id];
        if (spousePerson) {
          spousePerson.children.forEach(c => {
            childIds.add(c.id);
          });
        }
      });
      
      for (const childId of childIds) {
          const childNode = buildTree(childId, new Set(visited));
          if (childNode) {
            node.children.push(childNode);
          }
        }
      
      return node;
    }
    
    const trees = [];
    for (const root of rootNodes) {
      const tree = buildTree(root.id);
      if (tree) {
        trees.push(tree);
      }
    }
    
    res.json({
      trees,
      persons: personsMap,
      relationships: allRels,
      marriages: allMarriages
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
