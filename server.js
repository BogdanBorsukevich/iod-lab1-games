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
    try { await pool.query('INSERT INTO action_history (user_id, action_text) VALUES ($1, $2)', [userId, text]); } 
    catch (err) { console.error(err); }
}

app.get('/api/items/:type', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM items WHERE item_type = $1 ORDER BY id', [req.params.type]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/register', async (req, res) => {
    const { username, password, pib } = req.body;
    try {
        const role = ['admin_student', 'admin_teacher'].includes(username) ? 'admin' : 'expert';
        const passwordHash = await bcrypt.hash(password, 10);
        const pibHash = await bcrypt.hash(pib, 10);
        const result = await pool.query(
            'INSERT INTO users (username, password_hash, pib_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, role',
            [username, passwordHash, pibHash, role]
        );
        await logAction(result.rows[0].id, `Реєстрація: ${username}`);
        res.json({ success: true, user: result.rows[0] });
    } catch (err) { res.status(400).json({ error: 'Логін вже існує.' }); }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Не знайдено' });
        const isMatch = await bcrypt.compare(password, result.rows[0].password_hash);
        if (isMatch) {
            await logAction(result.rows[0].id, 'Вхід в систему');
            res.json({ success: true, user: { id: result.rows[0].id, username: result.rows[0].username, role: result.rows[0].role } });
        } else res.status(401).json({ error: 'Невірний пароль' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/vote', async (req, res) => {
    const { userId, votes, type } = req.body;
    try {
        const checkVote = await pool.query('SELECT * FROM votes WHERE user_id = $1 AND vote_type = $2', [userId, type]);
        if (checkVote.rows.length > 0) return res.status(400).json({ error: 'Ви вже проголосували в цій категорії!' });

        for (let vote of votes) {
            await pool.query('INSERT INTO votes (user_id, item_id, priority, vote_type) VALUES ($1, $2, $3, $4)', [userId, vote.itemId, vote.priority, type]);
        }
        await logAction(userId, `Голосування збережено [${type === 'game' ? 'ЛР1' : 'ЛР2'}]`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/results/:type', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT i.title, 
                SUM(CASE WHEN v.priority = 1 THEN 3 WHEN v.priority = 2 THEN 2 WHEN v.priority = 3 THEN 1 ELSE 0 END) as score
            FROM items i LEFT JOIN votes v ON i.id = v.item_id AND v.vote_type = $1
            WHERE i.item_type = $1 GROUP BY i.id, i.title ORDER BY score DESC NULLS LAST
        `, [req.params.type]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ГЕНЕТИЧНИЙ АЛГОРИТМ (Завдання 9)
app.get('/api/evolution/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const result = await pool.query(`
            SELECT i.id, i.title, 
                COALESCE(SUM(CASE WHEN v.priority = 1 THEN 3 WHEN v.priority = 2 THEN 2 WHEN v.priority = 3 THEN 1 ELSE 0 END), 0) as score
            FROM items i LEFT JOIN votes v ON i.id = v.item_id AND v.vote_type = $1
            WHERE i.item_type = $1 GROUP BY i.id, i.title
        `, [type]);

        const items = result.rows;
        if (items.length === 0) return res.json({ success: false, error: "Немає даних" });

        const POPULATION_SIZE = 50;
        const GENERATIONS = 100;
        const MUTATION_RATE = 0.1;

        const calculateFitness = (chromosome) => {
            let fitness = 0;
            for (let i = 0; i < chromosome.length; i++) fitness += (chromosome.length - i) * chromosome[i].score;
            return fitness;
        };

        let population = Array.from({ length: POPULATION_SIZE }, () => {
            let chromosome = [...items].sort(() => Math.random() - 0.5);
            return { chromosome, fitness: calculateFitness(chromosome) };
        });

        for (let gen = 0; gen < GENERATIONS; gen++) {
            population.sort((a, b) => b.fitness - a.fitness);
            let newPopulation = [...population.slice(0, Math.floor(POPULATION_SIZE * 0.1))]; // Elitism

            while (newPopulation.length < POPULATION_SIZE) {
                const parent1 = population[Math.floor(Math.random() * (POPULATION_SIZE / 2))].chromosome;
                const parent2 = population[Math.floor(Math.random() * (POPULATION_SIZE / 2))].chromosome;

                const crossoverPoint = Math.floor(Math.random() * parent1.length);
                let childGenes = parent1.slice(0, crossoverPoint);
                parent2.forEach(gene => { if (!childGenes.find(g => g.id === gene.id)) childGenes.push(gene); });

                if (Math.random() < MUTATION_RATE) {
                    const idx1 = Math.floor(Math.random() * childGenes.length);
                    const idx2 = Math.floor(Math.random() * childGenes.length);
                    [childGenes[idx1], childGenes[idx2]] = [childGenes[idx2], childGenes[idx1]];
                }

                newPopulation.push({ chromosome: childGenes, fitness: calculateFitness(childGenes) });
            }
            population = newPopulation;
        }

        population.sort((a, b) => b.fitness - a.fitness);
        res.json({ 
            success: true, bestFitness: population[0].fitness,
            ranking: population[0].chromosome.map((item, index) => ({ place: index + 1, title: item.title, score: item.score }))
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users', async (req, res) => {
    const result = await pool.query('SELECT id, username, role FROM users ORDER BY id');
    res.json(result.rows);
});

app.put('/api/users/:id/role', async (req, res) => {
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [req.body.role, req.params.id]);
    res.json({ success: true });
});

app.get('/api/protocol/:type', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.username,
                MAX(CASE WHEN v.priority = 1 THEN i.title END) as first_place,
                MAX(CASE WHEN v.priority = 2 THEN i.title END) as second_place,
                MAX(CASE WHEN v.priority = 3 THEN i.title END) as third_place
            FROM users u LEFT JOIN votes v ON u.id = v.user_id AND v.vote_type = $1
            LEFT JOIN items i ON v.item_id = i.id WHERE u.role != 'admin' OR v.id IS NOT NULL
            GROUP BY u.id, u.username ORDER BY u.id
        `, [req.params.type]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/history', async (req, res) => {
    const result = await pool.query('SELECT id, user_id, action_text, created_at FROM action_history ORDER BY id DESC');
    res.json(result.rows);
});

app.delete('/api/users/:id', async (req, res) => {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

app.delete('/api/votes/:userId/:type', async (req, res) => {
    await pool.query('DELETE FROM votes WHERE user_id = $1 AND vote_type = $2', [req.params.userId, req.params.type]);
    res.json({ success: true });
});

app.delete('/api/history', async (req, res) => {
    await pool.query('DELETE FROM action_history');
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Сервер запущено на порту ${PORT}`));