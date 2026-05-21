require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, initDb } = require('./db');

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtsecretkeychangeinproduction';

// Initialize Database on startup
initDb().then(() => {
  console.log('Database initialized successfully.');
}).catch(err => {
  console.error('Database initialization error:', err);
});

// Middleware for serving static files in production / Vercel
// Vercel routes non-API requests to /public directly, but this is a fallback for local use
app.use(express.static(path.join(__dirname, '../public')));

// Authentication Middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Tizimga kirilmagan. Kirish Bearer token orqali bo\'lishi shart.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Yaroqsiz token.' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    return res.status(403).json({ error: 'Taqqiqlangan. Faqat admin kirishi mumkin.' });
  }
}

function judgeMiddleware(req, res, next) {
  if (req.user && req.user.role === 'JUDGE') {
    next();
  } else {
    return res.status(403).json({ error: 'Taqqiqlangan. Faqat hakam kirishi mumkin.' });
  }
}

// ---------------------------------------------------------
// AUTHENTICATION ENDPOINTS
// ---------------------------------------------------------

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Foydalanuvchi nomi va parol kiritilishi shart.' });
  }

  try {
    const userRes = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: 'Foydalanuvchi nomi yoki parol xato.' });
    }

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Foydalanuvchi nomi yoki parol xato.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, first_name: user.first_name, last_name: user.last_name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Tizim xatoligi yuz berdi.' });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// ---------------------------------------------------------
// ADMIN ENDPOINTS
// ---------------------------------------------------------

// 1. Dashboard stats
app.get('/api/admin/dashboard-stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const classCount = await db.query('SELECT COUNT(*) as count FROM school_classes');
    const groupCount = await db.query('SELECT COUNT(*) as count FROM groups');
    const judgeCount = await db.query('SELECT COUNT(*) as count FROM users WHERE role = $1', ['JUDGE']);
    const evalCount = await db.query('SELECT COUNT(*) as count FROM evaluations');

    const totalScoreRes = await db.query(
      'SELECT SUM(score_functionality + score_architecture + score_performance + score_security + score_ui_ux) as sum, COUNT(*) as count FROM evaluations'
    );

    let avgScore = 0.0;
    const sum = parseFloat(totalScoreRes.rows[0].sum || 0);
    const count = parseInt(totalScoreRes.rows[0].count || 0);
    if (count > 0) {
      avgScore = parseFloat((sum / (count * 5)).toFixed(2));
    }

    // Recent evaluations (last 5)
    const recentEvals = await db.query(`
      SELECT e.id, g.name as group_name, g.project_name, u.first_name, u.last_name, 
             e.score_functionality, e.score_architecture, e.score_performance, e.score_security, e.score_ui_ux, 
             e.comment, e.created_at
      FROM evaluations e
      JOIN groups g ON e.group_id = g.id
      JOIN users u ON e.judge_id = u.id
      ORDER BY e.created_at DESC
      LIMIT 5
    `);

    res.json({
      classes: parseInt(classCount.rows[0].count || 0),
      groups: parseInt(groupCount.rows[0].count || 0),
      judges: parseInt(judgeCount.rows[0].count || 0),
      evaluations: parseInt(evalCount.rows[0].count || 0),
      average_score: avgScore,
      recent_evaluations: recentEvals.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ma\'lumotlarni olishda xatolik yuz berdi.' });
  }
});

// 2. Classes
app.get('/api/admin/classes', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const classes = await db.query(`
      SELECT c.id, c.name, COUNT(g.id) as group_count, c.created_at
      FROM school_classes c
      LEFT JOIN groups g ON g.school_class_id = c.id
      GROUP BY c.id, c.name, c.created_at
      ORDER BY c.name
    `);
    res.json(classes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sinflarni olishda xatolik yuz berdi.' });
  }
});

app.post('/api/admin/classes', authMiddleware, adminMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Sinf nomi kiritilishi shart.' });
  }

  try {
    const checkUnique = await db.query('SELECT id FROM school_classes WHERE name = $1', [name.trim()]);
    if (checkUnique.rows.length > 0) {
      return res.status(400).json({ error: 'Ushbu nomli sinf allaqachon mavjud.' });
    }

    const insertRes = await db.query('INSERT INTO school_classes (name) VALUES ($1) RETURNING id', [name.trim()]);
    const id = db.isPostgres ? insertRes.rows[0].id : insertRes.lastID;
    res.status(201).json({ id, name: name.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sinf yaratishda xatolik yuz berdi.' });
  }
});

app.delete('/api/admin/classes/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM school_classes WHERE id = $1', [id]);
    res.json({ message: 'Sinf va uning barcha guruhlari muvaffaqiyatli o\'chirildi.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sinfni o\'chirishda xatolik yuz berdi.' });
  }
});

// 3. Judges
app.get('/api/admin/judges', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const judges = await db.query('SELECT id, username, first_name, last_name FROM users WHERE role = $1 ORDER BY first_name', ['JUDGE']);
    res.json(judges.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Hakamlarni olishda xatolik yuz berdi.' });
  }
});

app.post('/api/admin/judges', authMiddleware, adminMiddleware, async (req, res) => {
  const { username, password, first_name, last_name } = req.body;
  if (!username || !password || !first_name || !last_name) {
    return res.status(400).json({ error: 'Barcha maydonlar to\'ldirilishi shart.' });
  }

  try {
    const checkUnique = await db.query('SELECT id FROM users WHERE username = $1', [username.trim().toLowerCase()]);
    if (checkUnique.rows.length > 0) {
      return res.status(400).json({ error: 'Ushbu foydalanuvchi nomi allaqachon mavjud.' });
    }

    const hashedPw = await bcrypt.hash(password, 10);
    const insertRes = await db.query(
      'INSERT INTO users (username, password, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [username.trim().toLowerCase(), hashedPw, first_name.trim(), last_name.trim(), 'JUDGE']
    );
    const id = db.isPostgres ? insertRes.rows[0].id : insertRes.lastID;
    res.status(201).json({ id, username, first_name, last_name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Hakam yaratishda xatolik yuz berdi.' });
  }
});

app.delete('/api/admin/judges/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM users WHERE id = $1 AND role = $2', [id, 'JUDGE']);
    res.json({ message: 'Hakam muvaffaqiyatli o\'chirildi.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Hakamni o\'chirishda xatolik yuz berdi.' });
  }
});

// 4. Groups
app.get('/api/admin/groups', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // Get groups
    const groupsRes = await db.query(`
      SELECT g.id, g.name, g.project_name, g.school_class_id, c.name as class_name
      FROM groups g
      JOIN school_classes c ON g.school_class_id = c.id
      ORDER BY c.name, g.name
    `);

    const groups = groupsRes.rows;

    // Fetch members and judges for each group
    for (let i = 0; i < groups.length; i++) {
      const membersRes = await db.query('SELECT id, name FROM group_members WHERE group_id = $1', [groups[i].id]);
      const judgesRes = await db.query(`
        SELECT u.id, u.username, u.first_name, u.last_name 
        FROM users u
        JOIN group_judges gj ON gj.user_id = u.id
        WHERE gj.group_id = $1
      `, [groups[i].id]);

      groups[i].members = membersRes.rows;
      groups[i].judges = judgesRes.rows;
    }

    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Guruhlarni olishda xatolik yuz berdi.' });
  }
});

app.post('/api/admin/groups', authMiddleware, adminMiddleware, async (req, res) => {
  const { name, project_name, school_class_id, judges, members } = req.body;
  if (!name || !project_name || !school_class_id) {
    return res.status(400).json({ error: 'Guruh nomi, loyiha nomi va sinf tanlanishi shart.' });
  }

  try {
    // Check uniqueness within the same class
    const checkUnique = await db.query(
      'SELECT id FROM groups WHERE school_class_id = $1 AND name = $2',
      [school_class_id, name.trim()]
    );
    if (checkUnique.rows.length > 0) {
      return res.status(400).json({ error: 'Ushbu sinfda bu nomli guruh allaqachon mavjud.' });
    }

    // Insert group
    const groupInsert = await db.query(
      'INSERT INTO groups (name, project_name, school_class_id) VALUES ($1, $2, $3) RETURNING id',
      [name.trim(), project_name.trim(), school_class_id]
    );
    const groupId = db.isPostgres ? groupInsert.rows[0].id : groupInsert.lastID;

    // Insert members
    if (members && Array.isArray(members)) {
      for (const mName of members) {
        if (mName && mName.trim()) {
          await db.query('INSERT INTO group_members (name, group_id) VALUES ($1, $2)', [mName.trim(), groupId]);
        }
      }
    }

    // Link judges
    if (judges && Array.isArray(judges)) {
      for (const judgeId of judges) {
        await db.query('INSERT INTO group_judges (group_id, user_id) VALUES ($1, $2)', [groupId, judgeId]);
      }
    }

    res.status(201).json({ id: groupId, name, project_name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Guruh yaratishda xatolik yuz berdi.' });
  }
});

app.delete('/api/admin/groups/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM groups WHERE id = $1', [id]);
    res.json({ message: 'Guruh muvaffaqiyatli o\'chirildi.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Guruhni o\'chirishda xatolik yuz berdi.' });
  }
});

// 5. Leaderboard / Rankings
app.get('/api/admin/rankings', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rankings = await db.query(`
      SELECT g.id, g.name as group_name, g.project_name, c.name as class_name,
             COUNT(e.id) as evaluations_count,
             AVG(e.score_functionality + e.score_architecture + e.score_performance + e.score_security + e.score_ui_ux) as total_avg_score
      FROM groups g
      JOIN school_classes c ON g.school_class_id = c.id
      LEFT JOIN evaluations e ON e.group_id = g.id
      GROUP BY g.id, g.name, g.project_name, c.name
      ORDER BY total_avg_score DESC NULLS LAST, c.name, g.name
    `);

    // Clean averages
    const cleanedRankings = rankings.rows.map(row => ({
      ...row,
      evaluations_count: parseInt(row.evaluations_count || 0),
      total_avg_score: row.total_avg_score ? parseFloat(parseFloat(row.total_avg_score).toFixed(2)) : 0.0,
      avg_score: row.total_avg_score ? parseFloat((parseFloat(row.total_avg_score) / 5).toFixed(2)) : 0.0
    }));

    res.json(cleanedRankings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Reytingni olishda xatolik yuz berdi.' });
  }
});

// 6. Statistics
app.get('/api/admin/statistics', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // Averages per category
    const categoryAvgs = await db.query(`
      SELECT AVG(score_functionality) as functionality,
             AVG(score_architecture) as architecture,
             AVG(score_performance) as performance,
             AVG(score_security) as security,
             AVG(score_ui_ux) as ui_ux
      FROM evaluations
    `);

    const avgs = {
      functionality: categoryAvgs.rows[0].functionality ? parseFloat(parseFloat(categoryAvgs.rows[0].functionality).toFixed(2)) : 0.0,
      architecture: categoryAvgs.rows[0].architecture ? parseFloat(parseFloat(categoryAvgs.rows[0].architecture).toFixed(2)) : 0.0,
      performance: categoryAvgs.rows[0].performance ? parseFloat(parseFloat(categoryAvgs.rows[0].performance).toFixed(2)) : 0.0,
      security: categoryAvgs.rows[0].security ? parseFloat(parseFloat(categoryAvgs.rows[0].security).toFixed(2)) : 0.0,
      ui_ux: categoryAvgs.rows[0].ui_ux ? parseFloat(parseFloat(categoryAvgs.rows[0].ui_ux).toFixed(2)) : 0.0
    };

    // Group-wise scores
    const groupScores = await db.query(`
      SELECT g.name as group_name, c.name as class_name,
             AVG(e.score_functionality) as functionality,
             AVG(e.score_architecture) as architecture,
             AVG(e.score_performance) as performance,
             AVG(e.score_security) as security,
             AVG(e.score_ui_ux) as ui_ux,
             AVG(e.score_functionality + e.score_architecture + e.score_performance + e.score_security + e.score_ui_ux) as total_avg
      FROM groups g
      JOIN school_classes c ON g.school_class_id = c.id
      JOIN evaluations e ON e.group_id = g.id
      GROUP BY g.id, g.name, c.name
      ORDER BY total_avg DESC
    `);

    const cleanedGroupScores = groupScores.rows.map(g => ({
      group_name: g.group_name,
      class_name: g.class_name,
      functionality: g.functionality ? parseFloat(parseFloat(g.functionality).toFixed(2)) : 0.0,
      architecture: g.architecture ? parseFloat(parseFloat(g.architecture).toFixed(2)) : 0.0,
      performance: g.performance ? parseFloat(parseFloat(g.performance).toFixed(2)) : 0.0,
      security: g.security ? parseFloat(parseFloat(g.security).toFixed(2)) : 0.0,
      ui_ux: g.ui_ux ? parseFloat(parseFloat(g.ui_ux).toFixed(2)) : 0.0,
      total_avg: g.total_avg ? parseFloat(parseFloat(g.total_avg).toFixed(2)) : 0.0
    }));

    res.json({
      averages: avgs,
      group_scores: cleanedGroupScores
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Statistikani olishda xatolik yuz berdi.' });
  }
});

// 7. Evaluations history list
app.get('/api/admin/evaluations', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const evals = await db.query(`
      SELECT e.id, g.name as group_name, g.project_name, c.name as class_name,
             u.first_name, u.last_name, u.username as judge_username,
             e.score_functionality, e.score_architecture, e.score_performance, e.score_security, e.score_ui_ux,
             e.comment, e.created_at
      FROM evaluations e
      JOIN groups g ON e.group_id = g.id
      JOIN school_classes c ON g.school_class_id = c.id
      JOIN users u ON e.judge_id = u.id
      ORDER BY e.created_at DESC
    `);
    res.json(evals.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Baholashlarni olishda xatolik yuz berdi.' });
  }
});

// ---------------------------------------------------------
// JUDGE ENDPOINTS
// ---------------------------------------------------------

// 1. Judge Dashboard
app.get('/api/judge/dashboard', authMiddleware, judgeMiddleware, async (req, res) => {
  try {
    // Get groups assigned to this judge
    const assignedGroups = await db.query(`
      SELECT g.id, g.name as group_name, g.project_name, c.name as class_name,
             EXISTS(SELECT 1 FROM evaluations e WHERE e.group_id = g.id AND e.judge_id = $1) as is_evaluated
      FROM groups g
      JOIN school_classes c ON g.school_class_id = c.id
      JOIN group_judges gj ON gj.group_id = g.id
      WHERE gj.user_id = $1
      ORDER BY c.name, g.name
    `, [req.user.id]);

    // Format is_evaluated to boolean
    const groups = assignedGroups.rows.map(row => ({
      ...row,
      is_evaluated: !!(row.is_evaluated === true || row.is_evaluated === 1 || row.is_evaluated === 't')
    }));

    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Hakam boshqaruv panelini yuklashda xatolik.' });
  }
});

// 2. Judge Group detail with evaluations
app.get('/api/judge/groups/:id', authMiddleware, judgeMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    // Check if group is assigned to judge
    const checkAssignment = await db.query(
      'SELECT 1 FROM group_judges WHERE group_id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (checkAssignment.rows.length === 0) {
      return res.status(403).json({ error: 'Sizga ushbu guruh biriktirilmagan.' });
    }

    const groupRes = await db.query(`
      SELECT g.id, g.name, g.project_name, c.name as class_name
      FROM groups g
      JOIN school_classes c ON g.school_class_id = c.id
      WHERE g.id = $1
    `, [id]);

    const group = groupRes.rows[0];

    // Members
    const membersRes = await db.query('SELECT id, name FROM group_members WHERE group_id = $1', [id]);
    group.members = membersRes.rows;

    // Other judges evaluations (comments only)
    const otherEvals = await db.query(`
      SELECT u.first_name, u.last_name, e.comment, e.created_at
      FROM evaluations e
      JOIN users u ON e.judge_id = u.id
      WHERE e.group_id = $1 AND e.judge_id != $2 AND e.comment != ''
    `, [id, req.user.id]);
    group.other_comments = otherEvals.rows;

    // Current judge's evaluation
    const myEval = await db.query(`
      SELECT score_functionality, score_architecture, score_performance, score_security, score_ui_ux, comment
      FROM evaluations
      WHERE group_id = $1 AND judge_id = $2
    `, [id, req.user.id]);

    group.my_evaluation = myEval.rows.length > 0 ? myEval.rows[0] : null;

    res.json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Guruh ma\'lumotlarini olishda xatolik.' });
  }
});

// 3. Post Evaluation
app.post('/api/judge/evaluate', authMiddleware, judgeMiddleware, async (req, res) => {
  const { group_id, score_functionality, score_architecture, score_performance, score_security, score_ui_ux, comment } = req.body;
  if (!group_id) {
    return res.status(400).json({ error: 'Guruh ID kiritilishi shart.' });
  }

  // Validate scores
  const scores = [score_functionality, score_architecture, score_performance, score_security, score_ui_ux];
  for (const s of scores) {
    const val = parseInt(s);
    if (isNaN(val) || val < 1 || val > 10) {
      return res.status(400).json({ error: 'Baholar 1 dan 10 gacha bo\'lishi shart.' });
    }
  }

  try {
    // Check if group is assigned
    const checkAssignment = await db.query(
      'SELECT 1 FROM group_judges WHERE group_id = $1 AND user_id = $2',
      [group_id, req.user.id]
    );

    if (checkAssignment.rows.length === 0) {
      return res.status(403).json({ error: 'Sizga ushbu guruh biriktirilmagan.' });
    }

    // Insert or update evaluation
    const checkExisting = await db.query(
      'SELECT id FROM evaluations WHERE group_id = $1 AND judge_id = $2',
      [group_id, req.user.id]
    );

    if (checkExisting.rows.length > 0) {
      // Update
      await db.query(`
        UPDATE evaluations 
        SET score_functionality = $1, score_architecture = $2, score_performance = $3, 
            score_security = $4, score_ui_ux = $5, comment = $6, updated_at = CURRENT_TIMESTAMP
        WHERE group_id = $7 AND judge_id = $8
      `, [score_functionality, score_architecture, score_performance, score_security, score_ui_ux, comment || '', group_id, req.user.id]);
      res.json({ message: 'Baholash muvaffaqiyatli yangilandi!' });
    } else {
      // Insert
      await db.query(`
        INSERT INTO evaluations 
        (group_id, judge_id, score_functionality, score_architecture, score_performance, score_security, score_ui_ux, comment)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [group_id, req.user.id, score_functionality, score_architecture, score_performance, score_security, score_ui_ux, comment || '']);
      res.json({ message: 'Baholash muvaffaqiyatli saqlandi!' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Baholashni saqlashda xatolik yuz berdi.' });
  }
});

// Fallback to serving public/index.html for any frontend client-side routes (optional SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Server locally
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running locally on http://localhost:${PORT}`);
  });
}

module.exports = app;
