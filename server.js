require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function logAction(userId, text) {
    try {
        await pool.query('INSERT INTO action_history (user_id, action_text) VALUES ($1, $2)', [userId, text]);
    } catch (err) {
        console.error('Помилка запису історії:', err);
    }
}

// 1. Отримання ігор
app.get('/api/games', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM games ORDER BY id');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Реєстрація
app.post('/api/register', async (req, res) => {
    const { username, password, pib } = req.body;
    try {
        const adminAccounts = ['admin_student', 'admin_teacher'];
        const role = adminAccounts.includes(username) ? 'admin' : 'expert';
        const passwordHash = await bcrypt.hash(password, 10);
        const pibHash = await bcrypt.hash(pib, 10);

        const result = await pool.query(
            'INSERT INTO users (username, password_hash, pib_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, role',
            [username, passwordHash, pibHash, role]
        );
        const user = result.rows[0];
        
        await logAction(user.id, `Реєстрація нового користувача, логін: ${user.username}`);
        res.json({ success: true, user });
    } catch (err) {
        res.status(400).json({ error: 'Логін вже існує.' });
    }
});

// 3. Логін
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Користувача не знайдено' });

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (isMatch) {
            await logAction(user.id, 'Користувач увійшов в систему');
            res.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
        } else {
            res.status(401).json({ error: 'Невірний пароль' });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. Голосування
app.post('/api/vote', async (req, res) => {
    const { userId, votes } = req.body;
    try {
        const checkVote = await pool.query('SELECT * FROM votes WHERE user_id = $1', [userId]);
        if (checkVote.rows.length > 0) return res.status(400).json({ error: 'Ви вже проголосували!' });

        for (let vote of votes) {
            await pool.query('INSERT INTO votes (user_id, game_id, priority) VALUES ($1, $2, $3)', [userId, vote.gameId, vote.priority]);
        }
        await logAction(userId, 'Користувач зберіг свій вибір ігор на 1, 2 та 3 місця');
        res.json({ success: true, message: 'Голоси збережено!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. Отримання всіх користувачів
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, role FROM users ORDER BY id');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. Зміна ролі користувача
app.put('/api/users/:id/role', async (req, res) => {
    try {
        const { role } = req.body;
        await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 7. Протокол голосування
app.get('/api/protocol', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.username,
                MAX(CASE WHEN v.priority = 1 THEN g.title END) as first_place,
                MAX(CASE WHEN v.priority = 2 THEN g.title END) as second_place,
                MAX(CASE WHEN v.priority = 3 THEN g.title END) as third_place
            FROM users u
            JOIN votes v ON u.id = v.user_id
            JOIN games g ON v.game_id = g.id
            GROUP BY u.id, u.username ORDER BY u.id
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 8. Історія дій
app.get('/api/history', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, user_id, action_text, created_at FROM action_history ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 9. Видалення користувача за ID
app.delete('/api/users/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.params.id;
        await client.query('BEGIN');
        await client.query('DELETE FROM action_history WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM votes WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

// 10. Видалення результатів голосування конкретного експерта
app.delete('/api/votes/:userId', async (req, res) => {
    try {
        await pool.query('DELETE FROM votes WHERE user_id = $1', [req.params.userId]);
        await logAction(req.params.userId, 'Адміністратор скинув результати голосування користувача');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 11. Очищення всієї історії дій
app.delete('/api/history', async (req, res) => {
    try {
        await pool.query('DELETE FROM action_history');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущено на http://localhost:${PORT}`);
});