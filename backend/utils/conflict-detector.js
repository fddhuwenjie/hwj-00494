const { query, queryOne } = require('./db-helpers');

function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function getAgeInYears(birthDate, refDate) {
  const birth = parseDate(birthDate);
  const ref = parseDate(refDate) || new Date();
  if (!birth) return null;
  const ms = ref - birth;
  return ms / (1000 * 60 * 60 * 24 * 365.25);
}

async function detectPersonConflicts(personData, excludeId = null) {
  const conflicts = [];

  const { birth_date, death_date, id } = personData;
  const personId = excludeId || id;

  if (birth_date && death_date) {
    const birth = parseDate(birth_date);
    const death = parseDate(death_date);
    if (birth && death && birth > death) {
      conflicts.push({
        type: 'date_order',
        severity: 'error',
        message: `出生日期 (${birth_date}) 晚于去世日期 (${death_date})`
      });
    }
  }

  if (birth_date) {
    const birth = parseDate(birth_date);
    const now = new Date();
    if (birth && birth > now) {
      conflicts.push({
        type: 'future_date',
        severity: 'warning',
        message: `出生日期 (${birth_date}) 在未来`
      });
    }
  }

  if (personId) {
    const parents = await query(`
      SELECT p.* FROM relationships r
      JOIN persons p ON r.parent_id = p.id
      WHERE r.child_id = ? AND r.relationship_type IN ('父子', '母子', '收养父子', '收养母子')
    `, [personId]);

    for (const parent of parents) {
      if (parent.birth_date && birth_date) {
        const parentAgeAtBirth = getAgeInYears(parent.birth_date, birth_date);
        if (parentAgeAtBirth !== null && parentAgeAtBirth < 12) {
          conflicts.push({
            type: 'parent_age',
            severity: 'error',
            message: `父/母 ${parent.name} 出生于 ${parent.birth_date}，在孩子出生时仅 ${parentAgeAtBirth.toFixed(1)} 岁（小于12岁）`
          });
        }
      }
    }

    const children = await query(`
      SELECT p.* FROM relationships r
      JOIN persons p ON r.child_id = p.id
      WHERE r.parent_id = ? AND r.relationship_type IN ('父子', '母子', '收养父子', '收养母子')
    `, [personId]);

    for (const child of children) {
      if (birth_date && child.birth_date) {
        const parentAgeAtBirth = getAgeInYears(birth_date, child.birth_date);
        if (parentAgeAtBirth !== null && parentAgeAtBirth < 12) {
          conflicts.push({
            type: 'child_age',
            severity: 'error',
            message: `该人物在子女 ${child.name} 出生时仅 ${parentAgeAtBirth.toFixed(1)} 岁（小于12岁）`
          });
        }
      }
      if (death_date && child.birth_date) {
        const death = parseDate(death_date);
        const childBirth = parseDate(child.birth_date);
        if (death && childBirth && death < childBirth) {
          conflicts.push({
            type: 'posthumous_child',
            severity: 'warning',
            message: `该人物去世日期 (${death_date}) 早于子女 ${child.name} 出生日期 (${child.birth_date})`
          });
        }
      }
    }

    const marriages = await query(`
      SELECT m.*,
             CASE WHEN m.husband_id = ? THEN w.name ELSE h.name END as spouse_name,
             CASE WHEN m.husband_id = ? THEN w.birth_date ELSE h.birth_date END as spouse_birth
      FROM marriages m
      LEFT JOIN persons h ON m.husband_id = h.id
      LEFT JOIN persons w ON m.wife_id = w.id
      WHERE m.husband_id = ? OR m.wife_id = ?
    `, [personId, personId, personId, personId]);

    for (const m of marriages) {
      if (m.marriage_date && birth_date) {
        const ageAtMarriage = getAgeInYears(birth_date, m.marriage_date);
        if (ageAtMarriage !== null && ageAtMarriage < 12) {
          conflicts.push({
            type: 'marriage_age',
            severity: 'error',
            message: `该人物与 ${m.spouse_name} 结婚时仅 ${ageAtMarriage.toFixed(1)} 岁（小于12岁）`
          });
        }
      }
      if (m.marriage_date && birth_date) {
        const marriage = parseDate(m.marriage_date);
        const birth = parseDate(birth_date);
        if (marriage && birth && marriage < birth) {
          conflicts.push({
            type: 'marriage_before_birth',
            severity: 'error',
            message: `与 ${m.spouse_name} 的婚期 (${m.marriage_date}) 早于该人物出生日期 (${birth_date})`
          });
        }
      }
      if (m.marriage_date && m.spouse_birth) {
        const marriage = parseDate(m.marriage_date);
        const spouseBirth = parseDate(m.spouse_birth);
        if (marriage && spouseBirth && marriage < spouseBirth) {
          conflicts.push({
            type: 'spouse_marriage_before_birth',
            severity: 'error',
            message: `与 ${m.spouse_name} 的婚期 (${m.marriage_date}) 早于配偶出生日期 (${m.spouse_birth})`
          });
        }
      }
    }
  }

  return conflicts;
}

async function detectMarriageConflicts(marriageData, excludeId = null) {
  const conflicts = [];
  const { husband_id, wife_id, marriage_date, divorce_date, id } = marriageData;
  const marriageId = excludeId || id;

  const husband = await queryOne('SELECT * FROM persons WHERE id = ?', [husband_id]);
  const wife = await queryOne('SELECT * FROM persons WHERE id = ?', [wife_id]);

  if (!husband) {
    conflicts.push({ type: 'not_found', severity: 'error', message: '丈夫不存在' });
  }
  if (!wife) {
    conflicts.push({ type: 'not_found', severity: 'error', message: '妻子不存在' });
  }

  if (husband && wife && husband.id === wife.id) {
    conflicts.push({ type: 'self_marriage', severity: 'error', message: '不能与自己结婚' });
  }

  if (husband && husband.gender !== '男') {
    conflicts.push({ type: 'gender_mismatch', severity: 'error', message: `丈夫必须为男性，${husband.name} 为女性` });
  }
  if (wife && wife.gender !== '女') {
    conflicts.push({ type: 'gender_mismatch', severity: 'error', message: `妻子必须为女性，${wife.name} 为男性` });
  }

  if (marriage_date && husband?.birth_date) {
    const marriage = parseDate(marriage_date);
    const hBirth = parseDate(husband.birth_date);
    if (marriage && hBirth && marriage < hBirth) {
      conflicts.push({
        type: 'marriage_before_birth',
        severity: 'error',
        message: `婚期 (${marriage_date}) 早于丈夫 ${husband.name} 出生日期 (${husband.birth_date})`
      });
    }
    const husbandAge = getAgeInYears(husband.birth_date, marriage_date);
    if (husbandAge !== null && husbandAge < 12) {
      conflicts.push({
        type: 'marriage_age',
        severity: 'error',
        message: `丈夫 ${husband.name} 结婚时仅 ${husbandAge.toFixed(1)} 岁（小于12岁）`
      });
    }
  }

  if (marriage_date && wife?.birth_date) {
    const marriage = parseDate(marriage_date);
    const wBirth = parseDate(wife.birth_date);
    if (marriage && wBirth && marriage < wBirth) {
      conflicts.push({
        type: 'marriage_before_birth',
        severity: 'error',
        message: `婚期 (${marriage_date}) 早于妻子 ${wife.name} 出生日期 (${wife.birth_date})`
      });
    }
    const wifeAge = getAgeInYears(wife.birth_date, marriage_date);
    if (wifeAge !== null && wifeAge < 12) {
      conflicts.push({
        type: 'marriage_age',
        severity: 'error',
        message: `妻子 ${wife.name} 结婚时仅 ${wifeAge.toFixed(1)} 岁（小于12岁）`
      });
    }
  }

  if (marriage_date && divorce_date) {
    const marriage = parseDate(marriage_date);
    const divorce = parseDate(divorce_date);
    if (marriage && divorce && marriage > divorce) {
      conflicts.push({
        type: 'divorce_before_marriage',
        severity: 'error',
        message: `离婚日期 (${divorce_date}) 早于结婚日期 (${marriage_date})`
      });
    }
  }

  if (husband && wife) {
    const existingActive = await queryOne(`
      SELECT * FROM marriages 
      WHERE ((husband_id = ? AND wife_id = ?) OR (husband_id = ? AND wife_id = ?))
        AND is_active = 1
        ${marriageId ? 'AND id != ' + marriageId : ''}
    `, [husband_id, wife_id, wife_id, husband_id]);

    if (existingActive) {
      conflicts.push({
        type: 'duplicate_marriage',
        severity: 'warning',
        message: `${husband.name} 与 ${wife.name} 已存在有效婚姻关系`
      });
    }

    const husbandMarriages = await query(`
      SELECT * FROM marriages WHERE husband_id = ? ${marriageId ? 'AND id != ' + marriageId : ''}
      ORDER BY marriage_order
    `, [husband_id]);

    const orders = husbandMarriages.map(m => m.marriage_order).sort((a, b) => a - b);
    for (let i = 0; i < orders.length - 1; i++) {
      if (orders[i] === orders[i + 1]) {
        conflicts.push({
          type: 'duplicate_order',
          severity: 'error',
          message: `丈夫 ${husband.name} 存在重复的婚姻顺序 ${orders[i]}`
        });
        break;
      }
    }

    const wifeMarriages = await query(`
      SELECT * FROM marriages WHERE wife_id = ? ${marriageId ? 'AND id != ' + marriageId : ''}
      ORDER BY marriage_order
    `, [wife_id]);

    const wOrders = wifeMarriages.map(m => m.marriage_order).sort((a, b) => a - b);
    for (let i = 0; i < wOrders.length - 1; i++) {
      if (wOrders[i] === wOrders[i + 1]) {
        conflicts.push({
          type: 'duplicate_order',
          severity: 'error',
          message: `妻子 ${wife.name} 存在重复的婚姻顺序 ${wOrders[i]}`
        });
        break;
      }
    }
  }

  return conflicts;
}

async function detectRelationshipConflicts(relData, excludeId = null) {
  const conflicts = [];
  const { parent_id, child_id, relationship_type, id } = relData;
  const relId = excludeId || id;

  if (!parent_id || !child_id) {
    return conflicts;
  }

  if (parent_id == child_id) {
    conflicts.push({ type: 'self_relation', severity: 'error', message: '不能与自己建立亲子关系' });
    return conflicts;
  }

  const parent = await queryOne('SELECT * FROM persons WHERE id = ?', [parent_id]);
  const child = await queryOne('SELECT * FROM persons WHERE id = ?', [child_id]);

  if (!parent) {
    conflicts.push({ type: 'not_found', severity: 'error', message: '父/母不存在' });
  }
  if (!child) {
    conflicts.push({ type: 'not_found', severity: 'error', message: '子女不存在' });
  }

  if (parent && child && relationship_type) {
    if (parent.gender === '男' && ['母子', '收养母子'].includes(relationship_type)) {
      conflicts.push({
        type: 'gender_mismatch',
        severity: 'error',
        message: `男性 ${parent.name} 不能建立"${relationship_type}"关系`
      });
    }
    if (parent.gender === '女' && ['父子', '收养父子'].includes(relationship_type)) {
      conflicts.push({
        type: 'gender_mismatch',
        severity: 'error',
        message: `女性 ${parent.name} 不能建立"${relationship_type}"关系`
      });
    }
  }

  if (parent?.birth_date && child?.birth_date) {
    const parentAge = getAgeInYears(parent.birth_date, child.birth_date);
    if (parentAge !== null && parentAge < 12) {
      conflicts.push({
        type: 'parent_age',
        severity: 'error',
        message: `父/母 ${parent.name} 在子女 ${child.name} 出生时仅 ${parentAge.toFixed(1)} 岁（小于12岁）`
      });
    }
  }

  if (parent?.death_date && child?.birth_date) {
    const death = parseDate(parent.death_date);
    const birth = parseDate(child.birth_date);
    if (death && birth && death < birth) {
      conflicts.push({
        type: 'posthumous_child',
        severity: 'warning',
        message: `父/母 ${parent.name} 去世日期 (${parent.death_date}) 早于子女 ${child.name} 出生日期 (${child.birth_date})`
      });
    }
  }

  if (child?.birth_date && parent?.birth_date) {
    const childBirth = parseDate(child.birth_date);
    const parentBirth = parseDate(parent.birth_date);
    if (childBirth && parentBirth && childBirth < parentBirth) {
      conflicts.push({
        type: 'child_older_than_parent',
        severity: 'error',
        message: `子女 ${child.name} 出生日期 (${child.birth_date}) 早于父/母 ${parent.name} 出生日期 (${parent.birth_date})`
      });
    }
  }

  if (relationship_type && relationship_type !== '兄弟姐妹') {
    const visited = new Set();
    const queue = [child_id];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (currentId == parent_id) {
        conflicts.push({
          type: 'cycle',
          severity: 'error',
          message: '检测到循环关系：一个人不能是自己的祖先'
        });
        break;
      }
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const children = await query(`
        SELECT child_id FROM relationships
        WHERE parent_id = ? AND relationship_type IN ('父子', '母子', '收养父子', '收养母子')
      `, [currentId]);
      children.forEach(c => queue.push(c.child_id));
    }
  }

  return conflicts;
}

async function detectConflicts(targetType, data, excludeId = null) {
  switch (targetType) {
    case 'person':
      return await detectPersonConflicts(data, excludeId);
    case 'marriage':
      return await detectMarriageConflicts(data, excludeId);
    case 'relationship':
      return await detectRelationshipConflicts(data, excludeId);
    default:
      return [];
  }
}

module.exports = {
  detectConflicts,
  detectPersonConflicts,
  detectMarriageConflicts,
  detectRelationshipConflicts,
  parseDate,
  getAgeInYears
};
