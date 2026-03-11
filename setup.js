require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initializeDB() {
    try {
        await client.connect();
        console.log("✅ Підключено до бази даних!");

        // Перестворюємо таблиці для підтримки двох лабораторних робіт
        await client.query(`
            DROP TABLE IF EXISTS votes CASCADE;
            DROP TABLE IF EXISTS items CASCADE;
            DROP TABLE IF EXISTS action_history CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
            DROP TABLE IF EXISTS games CASCADE;
            
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                pib_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'expert'
            );

            CREATE TABLE IF NOT EXISTS action_history (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                action_text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE items (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) UNIQUE NOT NULL,
                item_type VARCHAR(20) NOT NULL
            );

            CREATE TABLE votes (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                item_id INT REFERENCES items(id) ON DELETE CASCADE,
                priority INT CHECK (priority IN (1, 2, 3)),
                vote_type VARCHAR(20) NOT NULL,
                UNIQUE(user_id, item_id, vote_type),
                UNIQUE(user_id, priority, vote_type)
            );
        `);
        console.log("✅ Структура таблиць оновлена!");

        // ДАНІ ДЛЯ ЛАБОРАТОРНОЇ 1 (Ігри)
        const gamesList = [
            'The Witcher 3: Wild Hunt', 'Red Dead Redemption 2', 'Half-Life 2', 
            'The Legend of Zelda: Breath of the Wild', 'Grand Theft Auto V', 
            'Minecraft', 'The Elder Scrolls V: Skyrim', 'Super Mario 64', 
            'The Last of Us', 'Resident Evil 4', 'Mass Effect 2', 
            'Dark Souls', 'Tetris', 'Portal 2', 'World of Warcraft', 
            'BioShock', 'Doom (1993)', 'Bloodborne', 'Cyberpunk 2077', 'God of War'
        ];

        for (let game of gamesList) {
            await client.query(`INSERT INTO items (title, item_type) VALUES ($1, 'game') ON CONFLICT DO NOTHING`, [game]);
        }

        // ДАНІ ДЛЯ ЛАБОРАТОРНОЇ 2 (Евристики)
        const heuristicsList = [
            'Е1. Перемога в усіх парних порівняннях',
            'Е2. Відсутність поразок у парних порівняннях',
            'Е3. Участь в одному множинному порівнянні на 1 місці',
            'Е4. Участь в 2х множинних порівняннях на 3 місці',
            'Е5. Участь в 1 множинному порівнянні на 3 і ще одному на 2 місці',
            'Е6. Максимальна сума балів за Борда',
            'Е7. Частота згадування експертами',
            'Е8. Виключення об\'єктів поза топ-5',
            'Е9. Стабільність вибору (мінімальна дисперсія)',
            'Е10. Пріоритет об\'єктів викладача',
            'Е11. Евристика випадкового відбору',
            'Е12. Наявність хоча б однієї перемоги в парі'
        ];

        for (let heur of heuristicsList) {
            await client.query(`INSERT INTO items (title, item_type) VALUES ($1, 'heuristic') ON CONFLICT DO NOTHING`, [heur]);
        }
        
        console.log("✅ Дані для обох лабораторних завантажено!");

    } catch (error) {
        console.error("❌ Помилка при налаштуванні:", error);
    } finally {
        await client.end();
        console.log("🔌 З'єднання закрито.");
    }
}

initializeDB();