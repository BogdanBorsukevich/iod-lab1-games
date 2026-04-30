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
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 5
});

// ==========================================
// РОЗУМНИЙ СТАРТ БАЗИ ДАНИХ
// ==========================================
async function initDB() {
    try {
        console.log(`⏳ Підключення до бази даних...`);
        await pool.query('SELECT 1');
        console.log("✅ З'єднання з базою успішно встановлено!");

        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL, pib_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'expert'
            );
            CREATE TABLE IF NOT EXISTS action_history (
                id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE,
                action_text TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS items (
                id SERIAL PRIMARY KEY, title VARCHAR(255) UNIQUE NOT NULL, item_type VARCHAR(20) NOT NULL
            );
            CREATE TABLE IF NOT EXISTS votes (
                id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE,
                item_id INT REFERENCES items(id) ON DELETE CASCADE, priority INT CHECK (priority IN (1, 2, 3)),
                vote_type VARCHAR(20) NOT NULL, UNIQUE(user_id, item_id, vote_type)
            );
        `);

        const res = await pool.query('SELECT COUNT(*) FROM items');
        if (parseInt(res.rows[0].count) === 0) {
            console.log("⚠️ Завантажую ігри та евристики...");
            const gamesList = [ 'The Witcher 3: Wild Hunt', 'Red Dead Redemption 2', 'Half-Life 2', 'The Legend of Zelda: Breath of the Wild', 'Grand Theft Auto V', 'Minecraft', 'The Elder Scrolls V: Skyrim', 'Super Mario 64', 'The Last of Us', 'Resident Evil 4', 'Mass Effect 2', 'Dark Souls', 'Tetris', 'Portal 2', 'World of Warcraft', 'BioShock', 'Doom (1993)', 'Bloodborne', 'Cyberpunk 2077', 'God of War' ];
            for (let game of gamesList) { await pool.query(`INSERT INTO items (title, item_type) VALUES ($1, 'game') ON CONFLICT DO NOTHING`, [game]); }

            const heuristicsList = [ 'Е1. Перемога в усіх парних порівняннях', 'Е2. Відсутність поразок у парних порівняннях', 'Е3. Участь в одному множинному порівнянні на 1 місці', 'Е4. Участь в 2х множинних порівняннях на 3 місці', 'Е5. Участь в 1 множинному порівнянні на 3 і ще одному на 2 місці', 'Е6. Максимальна сума балів за Борда', 'Е7. Частота згадування експертами', 'Е8. Виключення об\'єктів поза топ-5', 'Е9. Стабільність вибору (мінімальна дисперсія)', 'Е10. Пріоритет об\'єктів викладача', 'Е11. Евристика випадкового відбору', 'Е12. Наявність хоча б однієї перемоги в парі' ];
            for (let heur of heuristicsList) { await pool.query(`INSERT INTO items (title, item_type) VALUES ($1, 'heuristic') ON CONFLICT DO NOTHING`, [heur]); }
            console.log("✅ Ігри та евристики успішно завантажено!");
        }
    } catch (err) { console.error(`❌ Помилка бази даних: ${err.message}`); }
}

// ==========================================
// ЛОГІКА ДОДАТКА (АВТОРИЗАЦІЯ І ГОЛОСИ)
// ==========================================
async function logAction(userId, text) { try { await pool.query('INSERT INTO action_history (user_id, action_text) VALUES ($1, $2)', [userId, text]); } catch (err) { } }

app.get('/api/items/:type', async (req, res) => {
    try { res.json((await pool.query('SELECT * FROM items WHERE item_type = $1 ORDER BY id', [req.params.type])).rows); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/register', async (req, res) => {
    const { username, password, pib } = req.body;
    try {
        const role = ['admin_student', 'admin_teacher'].includes(username) ? 'admin' : 'expert';
        const result = await pool.query('INSERT INTO users (username, password_hash, pib_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, role', [username, await bcrypt.hash(password, 10), await bcrypt.hash(pib, 10), role]);
        await logAction(result.rows[0].id, `Реєстрація: ${username}`);
        res.json({ success: true, user: result.rows[0] });
    } catch (err) { res.status(400).json({ error: 'Логін вже існує.' }); }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0 || !(await bcrypt.compare(password, result.rows[0].password_hash))) return res.status(401).json({ error: 'Невірні дані' });
        await logAction(result.rows[0].id, 'Вхід в систему');
        res.json({ success: true, user: { id: result.rows[0].id, username: result.rows[0].username, role: result.rows[0].role } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/vote', async (req, res) => {
    const { userId, votes, type } = req.body;
    try {
        if ((await pool.query('SELECT * FROM votes WHERE user_id = $1 AND vote_type = $2', [userId, type])).rows.length > 0) return res.status(400).json({ error: 'Ви вже проголосували!' });
        for (let vote of votes) await pool.query('INSERT INTO votes (user_id, item_id, priority, vote_type) VALUES ($1, $2, $3, $4)', [userId, vote.itemId, vote.priority, type]);
        await logAction(userId, `Голосування збережено [${type === 'game' ? 'ЛР1' : 'ЛР2'}]`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/results/:type', async (req, res) => {
    try {
        const query = req.params.type === 'game' 
            ? `SELECT i.title, SUM(CASE WHEN v.priority = 1 THEN 3 WHEN v.priority = 2 THEN 2 WHEN v.priority = 3 THEN 1 ELSE 0 END) as score FROM items i LEFT JOIN votes v ON i.id = v.item_id AND v.vote_type = $1 WHERE i.item_type = $1 GROUP BY i.id, i.title ORDER BY score DESC NULLS LAST`
            : `SELECT i.title, COUNT(v.id) as score FROM items i LEFT JOIN votes v ON i.id = v.item_id AND v.vote_type = $1 WHERE i.item_type = $1 GROUP BY i.id, i.title ORDER BY score DESC, i.title ASC`;
        res.json((await pool.query(query, [req.params.type])).rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const compareExpert = (expert, itemA, itemB, type) => {
    const rankA = expert[itemA] || 999; const rankB = expert[itemB] || 999;
    if (type === 'game') return rankA < rankB ? 1 : (rankA > rankB ? -1 : 0);
    const selA = rankA !== 999; const selB = rankB !== 999;
    return (selA && !selB) ? 1 : (!selA && selB ? -1 : 0);
};

// ==========================================
// ЛР2: ПОСЛІДОВНЕ (КАСКАДНЕ) ВІДСІЮВАННЯ (НА 10 ЕЛЕМЕНТІВ)
// ==========================================
async function getFilteredItems(type = 'game', finalLimit = 10) {
    const heurRes = await pool.query(`
        SELECT i.title FROM items i JOIN votes v ON i.id = v.item_id 
        WHERE i.item_type = 'heuristic' AND v.vote_type = 'heuristic' 
        GROUP BY i.id, i.title ORDER BY COUNT(v.id) DESC LIMIT 2
    `);
    
    let topHeuristics = heurRes.rows.map(r => r.title);
    if (topHeuristics.length === 0) {
        topHeuristics = ['Е7. Частота згадування експертами', 'Е6. Максимальна сума балів за Борда'];
    }

    const itemsRes = await pool.query(`SELECT id, title FROM items WHERE item_type = $1`, [type]);
    const votesRes = await pool.query(`SELECT item_id, priority FROM votes WHERE vote_type = $1`, [type]);
    
    let items = itemsRes.rows.map(i => {
        let itemVotes = votesRes.rows.filter(v => v.item_id === i.id);
        let borda = 0; let p1 = 0; let p2 = 0; let p3 = 0;
        itemVotes.forEach(v => {
            if(v.priority === 1) { borda += 3; p1++; }
            if(v.priority === 2) { borda += 2; p2++; }
            if(v.priority === 3) { borda += 1; p3++; }
        });
        return { ...i, borda, p1, p2, p3, total: itemVotes.length };
    });

    items = items.filter(i => i.total > 0);

    let stepsLog = [];
    let currentItems = [...items];
    let remaining = currentItems.length;
    if(remaining < finalLimit) finalLimit = remaining;
    
    let stepSizes = [
        Math.max(finalLimit, Math.floor((remaining + finalLimit) / 2)),
        finalLimit
    ];

    topHeuristics.forEach((heur, index) => {
        let limit = stepSizes[index] || finalLimit;

        if (heur.includes('Борда') || heur.includes('Е6')) {
            currentItems.sort((a,b) => b.borda - a.borda || b.total - a.total);
        } else if (heur.includes('1 місці') || heur.includes('Е3')) {
            currentItems.sort((a,b) => b.p1 - a.p1 || b.borda - a.borda);
        } else if (heur.includes('3 місці') || heur.includes('Е4')) {
            currentItems.sort((a,b) => b.p3 - a.p3 || b.borda - a.borda);
        } else if (heur.includes('2 місці') || heur.includes('Е5')) {
            currentItems.sort((a,b) => b.p2 - a.p2 || b.borda - a.borda);
        } else {
            currentItems.sort((a,b) => b.total - a.total || b.borda - a.borda);
        }

        currentItems = currentItems.slice(0, limit);
        
        stepsLog.push({
            step: index + 1,
            heuristic: heur,
            count: currentItems.length,
            items: currentItems.map(i => i.title)
        });
    });

    return { items: currentItems, steps: stepsLog };
}

app.get('/api/lab2/filter/:type', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const data = await getFilteredItems(req.params.type, limit);
        res.json({ success: true, steps: data.steps, items: data.items });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// ЛАБОРАТОРНА 3: АНАЛІЗ (МАТРИЦІ ТА ВІДПАЛ)
// ==========================================
app.get('/api/lab3/matrices/:type', async (req, res) => {
    try {
        const type = req.params.type;
        const limit = parseInt(req.query.limit) || 10;
        const filteredData = await getFilteredItems(type, limit); 
        const items = filteredData.items;
        if(items.length < 2) return res.json({ success: false, error: "Недостатньо голосів експертів" });

        const votesRes = await pool.query('SELECT user_id, item_id, priority FROM votes WHERE vote_type = $1', [type]);
        const experts = {};
        votesRes.rows.forEach(v => { if (!experts[v.user_id]) experts[v.user_id] = {}; experts[v.user_id][v.item_id] = v.priority; });

        const statMatrix = []; const signMatrix = [];
        for (let i = 0; i < items.length; i++) {
            statMatrix[i] = []; signMatrix[i] = [];
            for (let j = 0; j < items.length; j++) {
                if (i === j) { statMatrix[i][j] = '-'; signMatrix[i][j] = '-'; continue; }
                let prefersI = 0; let prefersJ = 0;
                Object.values(experts).forEach(exp => {
                    const cmp = compareExpert(exp, items[i].id, items[j].id, type);
                    if (cmp === 1) prefersI++; if (cmp === -1) prefersJ++;
                });
                statMatrix[i][j] = prefersI;
                signMatrix[i][j] = prefersI > prefersJ ? 1 : (prefersI < prefersJ ? -1 : 0);
            }
        }
        res.json({ success: true, items: items.map(i=>i.title), statMatrix, signMatrix });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/lab3/bruteforce/:type', async (req, res) => {
    try {
        const type = req.params.type;
        const limit = parseInt(req.query.limit) || 10;
        const filteredData = await getFilteredItems(type, limit);
        const items = filteredData.items;
        if(items.length < 2) return res.json({ success: false, error: "Мало даних" });

        const votesRes = await pool.query('SELECT user_id, item_id, priority FROM votes WHERE vote_type = $1', [type]);
        const experts = {};
        votesRes.rows.forEach(v => { if (!experts[v.user_id]) experts[v.user_id] = {}; experts[v.user_id][v.item_id] = v.priority; });

        const permute = (arr) => {
            if (arr.length === 0) return [[]];
            let result = [];
            for (let i = 0; i < arr.length; i++) {
                let rest = permute(arr.slice(0, i).concat(arr.slice(i + 1)));
                for(let j=0; j < rest.length; j++) {
                    result.push([arr[i]].concat(rest[j]));
                }
            }
            return result;
        };
        
        const permutations = permute(items.map(i => i.id));
        let minSumDist = Infinity; let bestSumPerm = null;

        permutations.forEach((perm) => {
            let totalSum = 0;
            Object.values(experts).forEach(expert => {
                for (let i = 0; i < perm.length; i++) for (let j = i + 1; j < perm.length; j++) totalSum += Math.abs(1 - compareExpert(expert, perm[i], perm[j], type));
            });
            if (totalSum < minSumDist) { minSumDist = totalSum; bestSumPerm = perm; }
        });

        res.json({ success: true, total: permutations.length, medianSum: { distance: minSumDist, ranking: bestSumPerm.map((id, i) => `${i+1}. ${items.find(it=>it.id===id).title}`) } });
    } catch (err) { res.status(500).json({ error: 'Сервер не зміг опрацювати 3.6 млн варіантів. Використайте Відпал. ' + err.message }); }
});

// НОВИЙ МАРШРУТ: МУЛЬТИКРИТЕРІАЛЬНИЙ ВІДПАЛ (K1 та K2)
app.get('/api/lab3/annealing/:type', async (req, res) => {
    try {
        const type = req.params.type;
        const limit = parseInt(req.query.limit) || 10;
        const filteredData = await getFilteredItems(type, limit);
        const items = filteredData.items;
        if(items.length < 2) return res.json({ success: false, error: "Мало даних" });

        const votesRes = await pool.query('SELECT user_id, item_id, priority FROM votes WHERE vote_type = $1', [type]);
        const experts = Object.values(votesRes.rows.reduce((acc, v) => { if (!acc[v.user_id]) acc[v.user_id] = {}; acc[v.user_id][v.item_id] = v.priority; return acc; }, {}));

        // Функція, яка рахує відразу дві метрики: K1 (сума) і K2 (максимум)
        const calcMetrics = (perm) => {
            let sum = 0; let max = 0;
            experts.forEach(exp => {
                let dist = 0;
                for(let i=0; i<perm.length; i++) {
                    for(let j=i+1; j<perm.length; j++) {
                        dist += Math.abs(1 - compareExpert(exp, perm[i], perm[j], type));
                    }
                }
                sum += dist;
                if(dist > max) max = dist;
            });
            return { sum, max };
        };

        const isUnique = (arr, perm) => !arr.some(sol => sol.perm.join(',') === perm.join(','));

        const coolingRate = 0.95;

        // ===============================================
        // RUN 1: МІНІМІЗАЦІЯ К1 (Сума відстаней)
        // ===============================================
        let currentPerm1 = items.map(i=>i.id).sort(() => Math.random() - 0.5);
        let currentMetrics1 = calcMetrics(currentPerm1);
        let bestK1 = currentMetrics1.sum;
        let k1Solutions = [{ perm: [...currentPerm1], k1: currentMetrics1.sum, k2: currentMetrics1.max }];
        
        let temp1 = 1000.0;
        while (temp1 > 0.1) {
            for(let i = 0; i < 30; i++) { 
                let neighbor = [...currentPerm1];
                let idx1 = Math.floor(Math.random() * neighbor.length); let idx2 = Math.floor(Math.random() * neighbor.length);
                [neighbor[idx1], neighbor[idx2]] = [neighbor[idx2], neighbor[idx1]];

                let newMetrics = calcMetrics(neighbor);
                let deltaE = newMetrics.sum - currentMetrics1.sum;

                if (deltaE < 0 || Math.random() < Math.exp(-deltaE / temp1)) {
                    currentPerm1 = neighbor; currentMetrics1 = newMetrics;
                    if (newMetrics.sum < bestK1) {
                        bestK1 = newMetrics.sum;
                        k1Solutions = [{ perm: [...currentPerm1], k1: newMetrics.sum, k2: newMetrics.max }];
                    } else if (newMetrics.sum === bestK1) {
                        if (isUnique(k1Solutions, currentPerm1)) k1Solutions.push({ perm: [...currentPerm1], k1: newMetrics.sum, k2: newMetrics.max });
                    }
                }
            }
            temp1 *= coolingRate;
        }

        // ===============================================
        // RUN 2: МІНІМІЗАЦІЯ К2 (Максимальна відстань)
        // ===============================================
        let currentPerm2 = items.map(i=>i.id).sort(() => Math.random() - 0.5);
        let currentMetrics2 = calcMetrics(currentPerm2);
        let bestK2 = currentMetrics2.max;
        let k2Solutions = [{ perm: [...currentPerm2], k1: currentMetrics2.sum, k2: currentMetrics2.max }];
        
        let temp2 = 1000.0;
        while (temp2 > 0.1) {
            for(let i = 0; i < 30; i++) { 
                let neighbor = [...currentPerm2];
                let idx1 = Math.floor(Math.random() * neighbor.length); let idx2 = Math.floor(Math.random() * neighbor.length);
                [neighbor[idx1], neighbor[idx2]] = [neighbor[idx2], neighbor[idx1]];

                let newMetrics = calcMetrics(neighbor);
                // Для К2 додаємо мікро-штраф за К1, щоб при однакових максимумах обирало кращу суму
                let deltaE = (newMetrics.max - currentMetrics2.max) + (newMetrics.sum - currentMetrics2.sum) * 0.001;

                if (deltaE < 0 || Math.random() < Math.exp(-deltaE / temp2)) {
                    currentPerm2 = neighbor; currentMetrics2 = newMetrics;
                    if (newMetrics.max < bestK2) {
                        bestK2 = newMetrics.max;
                        k2Solutions = [{ perm: [...currentPerm2], k1: newMetrics.sum, k2: newMetrics.max }];
                    } else if (newMetrics.max === bestK2) {
                        if (isUnique(k2Solutions, currentPerm2)) k2Solutions.push({ perm: [...currentPerm2], k1: newMetrics.sum, k2: newMetrics.max });
                    }
                }
            }
            temp2 *= coolingRate;
        }

        // Повертаємо до 4 кращих унікальних розв'язків для кожної колонки
        res.json({ 
            success: true, 
            k1Solutions: k1Solutions.slice(0, 4).sort((a,b)=>a.k2 - b.k2).map(s => ({ ranking: s.perm.map(id => items.find(it=>it.id===id).title), k1: s.k1, k2: s.k2 })),
            k2Solutions: k2Solutions.slice(0, 4).sort((a,b)=>a.k1 - b.k1).map(s => ({ ranking: s.perm.map(id => items.find(it=>it.id===id).title), k1: s.k1, k2: s.k2 }))
        });

    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/lab3/simulate', (req, res) => {
    const { itemsCount, expertsCount } = req.query;
    const N = parseInt(itemsCount); const E = parseInt(expertsCount);
    
    const experts = Array.from({length: E}, () => {
        let exp = {}; Array.from({length: N}, (_, i)=>i).sort(()=>Math.random()-0.5).slice(0, 5).forEach((item, idx) => exp[item] = idx+1); return exp;
    });

    const start = Date.now();
    const calcDist = (perm) => {
        let sum = 0;
        experts.forEach(exp => {
            for(let i=0; i<perm.length; i++){
                for(let j=i+1; j<perm.length; j++){
                    let rankA = exp[perm[i]] || 99; let rankB = exp[perm[j]] || 99;
                    sum += Math.abs(1 - (rankA < rankB ? 1 : (rankA > rankB ? -1 : 0)));
                }
            }
        });
        return sum;
    };

    let currentPerm = Array.from({length: N}, (_, i)=>i).sort(()=>Math.random()-0.5);
    let currentDist = calcDist(currentPerm);
    let bestDist = currentDist;
    let temp = 1000.0; 

    while (temp > 0.1) {
        for(let i=0; i<10; i++) {
            let neighbor = [...currentPerm];
            let idx1 = Math.floor(Math.random() * N); let idx2 = Math.floor(Math.random() * N);
            [neighbor[idx1], neighbor[idx2]] = [neighbor[idx2], neighbor[idx1]];
            let deltaE = calcDist(neighbor) - currentDist;
            if (deltaE < 0 || Math.random() < Math.exp(-deltaE / temp)) {
                currentPerm = neighbor; currentDist = currentDist + deltaE;
                if (currentDist < bestDist) bestDist = currentDist;
            }
        }
        temp *= 0.90;
    }

    res.json({ success: true, items: N, experts: E, timeMs: Date.now() - start, bestDistance: bestDist });
});

// ==========================================
// ЛАБОРАТОРНА 4: ІНДЕКС ЗАДОВОЛЕНОСТІ ТА ШТРАФИ
// ==========================================
app.get('/api/lab4/satisfaction/:type', async (req, res) => {
    try {
        const type = req.params.type;
        const limit = parseInt(req.query.limit) || 10;
        const filteredData = await getFilteredItems(type, limit);
        const topItems = filteredData.items;
        const n = topItems.length;
        if(n < 3) return res.json({ success: false, error: "Недостатньо об'єктів для аналізу (мінімум 3)" });

        const votes = await pool.query('SELECT u.username, v.user_id, v.item_id, v.priority FROM votes v JOIN users u ON v.user_id = u.id WHERE v.vote_type = $1', [type]);
        const expertVotes = {};
        votes.rows.forEach(v => {
            if (!expertVotes[v.user_id]) expertVotes[v.user_id] = { name: v.username, votes: {} };
            expertVotes[v.user_id].votes[v.item_id] = v.priority;
        });

        const calcDist = (perm, expVotes) => {
            let sum = 0;
            Object.values(expVotes).forEach(exp => {
                for(let i=0; i<perm.length; i++) for(let j=i+1; j<perm.length; j++) sum += Math.abs(1 - compareExpert(exp.votes, perm[i], perm[j], type));
            });
            return sum;
        };

        let bestPerm = topItems.map(i=>i.id).sort(() => Math.random() - 0.5);
        let bestDist = calcDist(bestPerm, expertVotes);
        let currentPerm = [...bestPerm];
        let currentDist = bestDist;
        let temp = 1000.0;
        
        while (temp > 0.1) {
            for(let i = 0; i < 30; i++) {
                let neighbor = [...currentPerm];
                let idx1 = Math.floor(Math.random() * neighbor.length); let idx2 = Math.floor(Math.random() * neighbor.length);
                [neighbor[idx1], neighbor[idx2]] = [neighbor[idx2], neighbor[idx1]];
                let neighborDist = calcDist(neighbor, expertVotes);
                let deltaE = neighborDist - currentDist;
                if (deltaE < 0 || Math.random() < Math.exp(-deltaE / temp)) {
                    currentPerm = neighbor; currentDist = neighborDist;
                    if (currentDist < bestDist) { bestDist = currentDist; bestPerm = [...currentPerm]; }
                }
            }
            temp *= 0.95;
        }

        const compRankMap = {};
        bestPerm.forEach((id, index) => compRankMap[id] = index + 1);

        const results = [];
        let sumSatisfaction = 0;

        Object.values(expertVotes).forEach(exp => {
            let dj = 0;
            let droppedCount = 0;
            
            Object.keys(exp.votes).forEach(itemId => {
                const rj = exp.votes[itemId];
                const rStar = compRankMap[itemId];
                
                if (rStar !== undefined) {
                    dj += Math.abs(rj - rStar);
                } else {
                    droppedCount++;
                }
            });

            if (droppedCount > 0) {
                dj += droppedCount * (n - 3);
            }

            let denominator = (n - 3) * 3;
            if (denominator <= 0) denominator = 1;
            
            let sj = (1 - (dj / denominator)) * 100;
            if (sj < 0) sj = 0;

            results.push({ name: exp.name, dj: dj, dropped: droppedCount, sj: sj.toFixed(1) });
            sumSatisfaction += sj;
        });

        results.sort((a,b) => b.sj - a.sj);
        
        const avg = results.length > 0 ? (sumSatisfaction / results.length) : 0;
        const variance = results.reduce((acc, val) => acc + Math.pow(val.sj - avg, 2), 0) / (results.length || 1);

        res.json({ success: true, experts: results, average: avg.toFixed(1), variance: variance.toFixed(1), n: n });

    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// АДМІН-ІНСТРУМЕНТИ
// ==========================================
app.get('/api/users', async (req, res) => {
    const result = await pool.query('SELECT id, username, role FROM users ORDER BY id');
    res.json(result.rows);
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
app.put('/api/users/:id/role', async (req, res) => {
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [req.body.role, req.params.id]); res.json({ success: true });
});
app.delete('/api/users/:id', async (req, res) => {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]); res.json({ success: true });
});
app.delete('/api/votes/:userId/:type', async (req, res) => {
    await pool.query('DELETE FROM votes WHERE user_id = $1 AND vote_type = $2', [req.params.userId, req.params.type]); res.json({ success: true });
});
app.delete('/api/history', async (req, res) => {
    await pool.query('DELETE FROM action_history'); res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`=================================`);
        console.log(`🚀 Сервер успішно запущено!`);
        console.log(`👉 Перейдіть за посиланням: http://localhost:${PORT}`);
        console.log(`=================================`);
    });
});