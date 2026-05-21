const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const isPostgres = !!process.env.DATABASE_URL;
let db;

if (isPostgres) {
  console.log('Using PostgreSQL database client...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  db = {
    isPostgres: true,
    query: async (text, params) => {
      const res = await pool.query(text, params);
      return res;
    }
  };
} else {
  console.log('Using SQLite local database client...');
  const dbPath = path.resolve(process.cwd(), 'database.sqlite');
  const sqliteDb = new sqlite3.Database(dbPath);
  db = {
    isPostgres: false,
    query: (text, params = []) => {
      // Find all matches for numbered placeholders (e.g. $1, $2)
      const matches = [...text.matchAll(/\$(\d+)/g)];
      let mappedParams = params;
      if (matches.length > 0) {
        mappedParams = matches.map(match => params[parseInt(match[1]) - 1]);
      }
      const sql = text.replace(/\$(\d+)/g, '?');
      return new Promise((resolve, reject) => {
        const cleanedSql = sql.trim().toUpperCase();
        if (cleanedSql.startsWith('SELECT')) {
          sqliteDb.all(sql, mappedParams, (err, rows) => {
            if (err) reject(err);
            else resolve({ rows });
          });
        } else {
          sqliteDb.run(sql, mappedParams, function(err) {
            if (err) reject(err);
            else resolve({ rows: [], lastID: this.lastID, changes: this.changes });
          });
        }
      });
    }
  };
}

async function initDb() {
  const usersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      username VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      first_name VARCHAR(100) DEFAULT '',
      last_name VARCHAR(100) DEFAULT '',
      role VARCHAR(10) DEFAULT 'JUDGE'
    )
  `;

  const classesTable = `
    CREATE TABLE IF NOT EXISTS school_classes (
      id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      name VARCHAR(50) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const groupsTable = `
    CREATE TABLE IF NOT EXISTS groups (
      id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      name VARCHAR(100) NOT NULL,
      project_name VARCHAR(200) NOT NULL,
      school_class_id INTEGER NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_class_group UNIQUE (school_class_id, name)
    )
  `;

  const groupJudgesTable = `
    CREATE TABLE IF NOT EXISTS group_judges (
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (group_id, user_id)
    )
  `;

  const groupMembersTable = `
    CREATE TABLE IF NOT EXISTS group_members (
      id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      name VARCHAR(100) NOT NULL,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE
    )
  `;

  const evaluationsTable = `
    CREATE TABLE IF NOT EXISTS evaluations (
      id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      judge_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      score_functionality INTEGER DEFAULT 1,
      score_architecture INTEGER DEFAULT 1,
      score_performance INTEGER DEFAULT 1,
      score_security INTEGER DEFAULT 1,
      score_ui_ux INTEGER DEFAULT 1,
      comment TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_group_judge UNIQUE (group_id, judge_id)
    )
  `;

  // Create tables in correct dependency order
  await db.query(usersTable);
  await db.query(classesTable);
  await db.query(groupsTable);
  await db.query(groupJudgesTable);
  await db.query(groupMembersTable);
  await db.query(evaluationsTable);

  // Check if seeding is required
  const userCheck = await db.query('SELECT COUNT(*) as count FROM users');
  const count = parseInt(userCheck.rows[0].count || userCheck.rows[0].COUNT || 0);

  if (count === 0) {
    console.log('Seeding initial JudgeHub database...');
    // Seed Users
    const adminHash = await bcrypt.hash('admin123', 10);
    const judge1Hash = await bcrypt.hash('judge123', 10);
    const judge2Hash = await bcrypt.hash('judge123', 10);

    await db.query(
      'INSERT INTO users (username, password, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5)',
      ['admin', adminHash, 'Tizim', 'Administratori', 'ADMIN']
    );
    await db.query(
      'INSERT INTO users (username, password, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5)',
      ['judge1', judge1Hash, 'Dilshod', 'Murodov', 'JUDGE']
    );
    await db.query(
      'INSERT INTO users (username, password, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5)',
      ['judge2', judge2Hash, 'Shahnoza', 'Karimova', 'JUDGE']
    );

    // Seed Classes
    await db.query('INSERT INTO school_classes (name) VALUES ($1)', ['9-A']);
    await db.query('INSERT INTO school_classes (name) VALUES ($1)', ['10-B']);
    await db.query('INSERT INTO school_classes (name) VALUES ($1)', ['11-D']);

    // Get Class IDs
    const classes = await db.query('SELECT id, name FROM school_classes');
    const class9A = classes.rows.find(c => c.name === '9-A').id;
    const class10B = classes.rows.find(c => c.name === '10-B').id;

    // Get Judge IDs
    const judges = await db.query('SELECT id, username FROM users WHERE role = $1', ['JUDGE']);
    const judge1 = judges.rows.find(j => j.username === 'judge1').id;
    const judge2 = judges.rows.find(j => j.username === 'judge2').id;

    // Seed Groups
    // Group 1
    const g1Res = await db.query(
      'INSERT INTO groups (name, project_name, school_class_id) VALUES ($1, $2, $3) RETURNING id',
      ['1-Guruh', 'E-Kutubxona Tizimi', class9A]
    );
    const g1Id = isPostgres ? g1Res.rows[0].id : g1Res.lastID;

    // Group 2
    const g2Res = await db.query(
      'INSERT INTO groups (name, project_name, school_class_id) VALUES ($1, $2, $3) RETURNING id',
      ['2-Guruh', 'Smart Maktab', class9A]
    );
    const g2Id = isPostgres ? g2Res.rows[0].id : g2Res.lastID;

    // Group 3
    const g3Res = await db.query(
      'INSERT INTO groups (name, project_name, school_class_id) VALUES ($1, $2, $3) RETURNING id',
      ['Yulduzlar', 'Sog\'liqni saqlash ilovasi', class10B]
    );
    const g3Id = isPostgres ? g3Res.rows[0].id : g3Res.lastID;

    // Link Judges to Groups
    await db.query('INSERT INTO group_judges (group_id, user_id) VALUES ($1, $2)', [g1Id, judge1]);
    await db.query('INSERT INTO group_judges (group_id, user_id) VALUES ($1, $2)', [g1Id, judge2]);
    await db.query('INSERT INTO group_judges (group_id, user_id) VALUES ($1, $2)', [g2Id, judge1]);
    await db.query('INSERT INTO group_judges (group_id, user_id) VALUES ($1, $2)', [g3Id, judge2]);

    // Seed Members
    await db.query('INSERT INTO group_members (name, group_id) VALUES ($1, $2)', ['Asadbek Alimov', g1Id]);
    await db.query('INSERT INTO group_members (name, group_id) VALUES ($1, $2)', ['Zilola Rustamova', g1Id]);
    await db.query('INSERT INTO group_members (name, group_id) VALUES ($1, $2)', ['Bekzod Tojiyev', g2Id]);
    await db.query('INSERT INTO group_members (name, group_id) VALUES ($1, $2)', ['Madina Shodieva', g2Id]);
    await db.query('INSERT INTO group_members (name, group_id) VALUES ($1, $2)', ['Jasur Ortiqov', g3Id]);

    // Seed some evaluations
    await db.query(
      `INSERT INTO evaluations 
       (group_id, judge_id, score_functionality, score_architecture, score_performance, score_security, score_ui_ux, comment) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [g1Id, judge1, 8, 7, 9, 6, 8, 'Ajoyib interfeys va mukammal funksionallik. Kod sifati yaxshi.']
    );
    await db.query(
      `INSERT INTO evaluations 
       (group_id, judge_id, score_functionality, score_architecture, score_performance, score_security, score_ui_ux, comment) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [g2Id, judge1, 6, 5, 7, 5, 6, 'Loyiha ustida yana ishlash kerak. Dizaynga ko\'proq e\'tibor bering.']
    );

    console.log('Seeding completed successfully.');
  }
}

module.exports = {
  db,
  initDb
};
