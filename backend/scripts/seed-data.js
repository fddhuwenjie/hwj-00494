const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'family_tree.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`PRAGMA foreign_keys = ON`);
  db.run('BEGIN TRANSACTION');

  const persons = [
    { id: 1, name: '张大山', gender: '男', birth_date: '1935-03-15', death_date: '2015-08-20', hometown: '北京市海淀区', occupation: '退休教师', bio: '家族第一代，从事教育工作40年，育有4个子女。', is_deceased: 1 },
    { id: 2, name: '李秀兰', gender: '女', birth_date: '1938-07-22', death_date: '2012-11-10', hometown: '北京市朝阳区', occupation: '退休医生', bio: '家族第一代，从医35年，仁心仁术。', is_deceased: 1 },
    { id: 3, name: '张明', gender: '男', birth_date: '1960-05-10', death_date: null, hometown: '北京市海淀区', occupation: '工程师', bio: '家族第二代长子，高级工程师，在建筑设计领域有卓越贡献。', is_deceased: 0 },
    { id: 4, name: '刘芳', gender: '女', birth_date: '1962-11-08', death_date: null, hometown: '上海市浦东新区', occupation: '会计师', bio: '张明的妻子，注册会计师，热爱家庭。', is_deceased: 0 },
    { id: 5, name: '张辉', gender: '男', birth_date: '1963-09-15', death_date: null, hometown: '北京市海淀区', occupation: '大学教授', bio: '家族第二代次子，物理学教授，博士生导师。', is_deceased: 0 },
    { id: 6, name: '张敏', gender: '女', birth_date: '1966-02-28', death_date: null, hometown: '北京市海淀区', occupation: '律师', bio: '家族第二代长女，知名律师，专注于公益法律服务。', is_deceased: 0 },
    { id: 7, name: '张军', gender: '男', birth_date: '1968-12-03', death_date: null, hometown: '北京市海淀区', occupation: '企业家', bio: '家族第二代三子，创办了多家科技企业。', is_deceased: 0 },
    { id: 8, name: '张燕', gender: '女', birth_date: '1970-06-18', death_date: null, hometown: '北京市海淀区', occupation: '医生', bio: '家族第二代次女，心血管科专家，救死扶伤。', is_deceased: 0 },
    { id: 9, name: '张伟', gender: '男', birth_date: '1985-04-20', death_date: null, hometown: '北京市海淀区', occupation: '软件工程师', bio: '家族第三代长子，互联网公司技术总监。', is_deceased: 0 },
    { id: 10, name: '张娜', gender: '女', birth_date: '1987-08-12', death_date: null, hometown: '北京市海淀区', occupation: '设计师', bio: '家族第三代长女，知名室内设计师。', is_deceased: 0 },
    { id: 11, name: '张磊', gender: '男', birth_date: '1989-01-25', death_date: null, hometown: '北京市海淀区', occupation: '医生', bio: '家族第三代次子，外科医生，医术精湛。', is_deceased: 0 },
    { id: 12, name: '张婷', gender: '女', birth_date: '1991-05-30', death_date: null, hometown: '北京市海淀区', occupation: '教师', bio: '家族第三代次女，中学英语教师。', is_deceased: 0 },
    { id: 13, name: '张浩', gender: '男', birth_date: '1993-10-15', death_date: null, hometown: '北京市海淀区', occupation: '创业者', bio: '家族第三代三子，创办了一家人工智能公司。', is_deceased: 0 },
    { id: 14, name: '张雪', gender: '女', birth_date: '1995-03-08', death_date: null, hometown: '北京市海淀区', occupation: '摄影师', bio: '家族第三代三女，自由摄影师，作品多次获奖。', is_deceased: 0 },
    { id: 15, name: '张峰', gender: '男', birth_date: '1997-07-22', death_date: null, hometown: '北京市海淀区', occupation: '学生', bio: '家族第四子，在读研究生，专业为计算机科学。', is_deceased: 0 },
    { id: 16, name: '张琳', gender: '女', birth_date: '1999-12-01', death_date: null, hometown: '北京市海淀区', occupation: '学生', bio: '家族第三代小女儿，在读大学生，学习音乐表演。', is_deceased: 0 }
  ];

  const stmt = db.prepare(`INSERT INTO persons (id, name, gender, birth_date, death_date, hometown, occupation, bio, is_deceased) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  persons.forEach(p => {
    stmt.run(p.id, p.name, p.gender, p.birth_date, p.death_date, p.hometown, p.occupation, p.bio, p.is_deceased);
  });
  stmt.finalize();

  const marriages = [
    { id: 1, husband_id: 1, wife_id: 2, marriage_order: 1, marriage_date: '1958-10-01', divorce_date: null, is_active: 1 },
    { id: 2, husband_id: 3, wife_id: 4, marriage_order: 1, marriage_date: '1984-05-20', divorce_date: null, is_active: 1 }
  ];

  const marriageStmt = db.prepare(`INSERT INTO marriages (id, husband_id, wife_id, marriage_order, marriage_date, divorce_date, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  marriages.forEach(m => {
    marriageStmt.run(m.id, m.husband_id, m.wife_id, m.marriage_order, m.marriage_date, m.divorce_date, m.is_active);
  });
  marriageStmt.finalize();

  const relationships = [
    { parent_id: 1, child_id: 3, relationship_type: '父子' },
    { parent_id: 2, child_id: 3, relationship_type: '母子' },
    { parent_id: 1, child_id: 5, relationship_type: '父子' },
    { parent_id: 2, child_id: 5, relationship_type: '母子' },
    { parent_id: 1, child_id: 6, relationship_type: '父子' },
    { parent_id: 2, child_id: 6, relationship_type: '母子' },
    { parent_id: 1, child_id: 7, relationship_type: '父子' },
    { parent_id: 2, child_id: 7, relationship_type: '母子' },
    { parent_id: 1, child_id: 8, relationship_type: '父子' },
    { parent_id: 2, child_id: 8, relationship_type: '母子' },
    { parent_id: 3, child_id: 9, relationship_type: '父子' },
    { parent_id: 4, child_id: 9, relationship_type: '母子' },
    { parent_id: 3, child_id: 10, relationship_type: '父子' },
    { parent_id: 4, child_id: 10, relationship_type: '母子' },
    { parent_id: 3, child_id: 11, relationship_type: '父子' },
    { parent_id: 4, child_id: 11, relationship_type: '母子' },
    { parent_id: 3, child_id: 12, relationship_type: '父子' },
    { parent_id: 4, child_id: 12, relationship_type: '母子' },
    { parent_id: 3, child_id: 13, relationship_type: '父子' },
    { parent_id: 4, child_id: 13, relationship_type: '母子' },
    { parent_id: 3, child_id: 14, relationship_type: '父子' },
    { parent_id: 4, child_id: 14, relationship_type: '母子' },
    { parent_id: 3, child_id: 15, relationship_type: '父子' },
    { parent_id: 4, child_id: 15, relationship_type: '母子' },
    { parent_id: 3, child_id: 16, relationship_type: '父子' },
    { parent_id: 4, child_id: 16, relationship_type: '母子' },
    { parent_id: null, child_id: null, relationship_type: '兄弟姐妹' }
  ];

  const relStmt = db.prepare(`INSERT INTO relationships (parent_id, child_id, relationship_type) VALUES (?, ?, ?)`);
  relationships.forEach(r => {
    if (r.relationship_type === '兄弟姐妹') {
      const siblings = [9, 10, 11, 12, 13, 14, 15, 16];
      for (let i = 0; i < siblings.length; i++) {
        for (let j = i + 1; j < siblings.length; j++) {
          relStmt.run(siblings[i], siblings[j], '兄弟姐妹');
        }
      }
      const olderSiblings = [3, 5, 6, 7, 8];
      for (let i = 0; i < olderSiblings.length; i++) {
        for (let j = i + 1; j < olderSiblings.length; j++) {
          relStmt.run(olderSiblings[i], olderSiblings[j], '兄弟姐妹');
        }
      }
    } else {
      relStmt.run(r.parent_id, r.child_id, r.relationship_type);
    }
  });
  relStmt.finalize();

  const events = [
    { event_type: '出生', event_date: '1935-03-15', description: '张大山出生', person_id: 1 },
    { event_type: '出生', event_date: '1938-07-22', description: '李秀兰出生', person_id: 2 },
    { event_type: '结婚', event_date: '1958-10-01', description: '张大山与李秀兰结婚', person_id: 1, related_person_ids: '[2]' },
    { event_type: '出生', event_date: '1960-05-10', description: '张明出生', person_id: 3 },
    { event_type: '出生', event_date: '1962-11-08', description: '刘芳出生', person_id: 4 },
    { event_type: '出生', event_date: '1963-09-15', description: '张辉出生', person_id: 5 },
    { event_type: '出生', event_date: '1966-02-28', description: '张敏出生', person_id: 6 },
    { event_type: '出生', event_date: '1968-12-03', description: '张军出生', person_id: 7 },
    { event_type: '出生', event_date: '1970-06-18', description: '张燕出生', person_id: 8 },
    { event_type: '结婚', event_date: '1984-05-20', description: '张明与刘芳结婚', person_id: 3, related_person_ids: '[4]' },
    { event_type: '出生', event_date: '1985-04-20', description: '张伟出生', person_id: 9 },
    { event_type: '出生', event_date: '1987-08-12', description: '张娜出生', person_id: 10 },
    { event_type: '出生', event_date: '1989-01-25', description: '张磊出生', person_id: 11 },
    { event_type: '出生', event_date: '1991-05-30', description: '张婷出生', person_id: 12 },
    { event_type: '出生', event_date: '1993-10-15', description: '张浩出生', person_id: 13 },
    { event_type: '出生', event_date: '1995-03-08', description: '张雪出生', person_id: 14 },
    { event_type: '出生', event_date: '1997-07-22', description: '张峰出生', person_id: 15 },
    { event_type: '出生', event_date: '1999-12-01', description: '张琳出生', person_id: 16 },
    { event_type: '去世', event_date: '2012-11-10', description: '李秀兰逝世，享年74岁', person_id: 2 },
    { event_type: '去世', event_date: '2015-08-20', description: '张大山逝世，享年80岁', person_id: 1 }
  ];

  const eventStmt = db.prepare(`INSERT INTO family_events (event_type, event_date, description, person_id, related_person_ids) VALUES (?, ?, ?, ?, ?)`);
  events.forEach(e => {
    eventStmt.run(e.event_type, e.event_date, e.description, e.person_id, e.related_person_ids || null);
  });
  eventStmt.finalize();

  db.run('COMMIT', (err) => {
    if (err) {
      console.error('数据插入失败:', err);
      db.run('ROLLBACK');
    } else {
      console.log('预置数据插入成功！');
      console.log('共插入人员:', persons.length, '人');
      console.log('共插入婚姻关系:', marriages.length, '段');
    }
    db.close();
  });
});
