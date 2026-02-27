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

        const createTables = `
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                pib_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'expert'
            );

            CREATE TABLE IF NOT EXISTS games (
                id SERIAL PRIMARY KEY,
                title VARCHAR(100) UNIQUE NOT NULL
            );

            CREATE TABLE IF NOT EXISTS votes (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                game_id INT REFERENCES games(id),
                priority INT CHECK (priority IN (1, 2, 3)),
                UNIQUE(user_id, game_id),
                UNIQUE(user_id, priority)
            );
        `;
        await client.query(createTables);
        console.log("✅ Таблиці успішно створено!");

        const gamesList = [
            'The Witcher 3: Wild Hunt', 'Red Dead Redemption 2', 'Half-Life 2', 
            'The Legend of Zelda: Breath of the Wild', 'Grand Theft Auto V', 
            'Minecraft', 'The Elder Scrolls V: Skyrim', 'Super Mario 64', 
            'The Last of Us', 'Resident Evil 4', 'Mass Effect 2', 
            'Dark Souls', 'Tetris', 'Portal 2', 'World of Warcraft', 
            'BioShock', 'Doom (1993)', 'Bloodborne', 'Cyberpunk 2077', 'God of War'
        ];

        for (let game of gamesList) {
            await client.query(
                `INSERT INTO games (title) VALUES ($1) ON CONFLICT (title) DO NOTHING`,
                [game]
            );
        }
        console.log("✅ 20 об'єктів (ігор) додано до бази!");

    } catch (error) {
        console.error("❌ Помилка при налаштуванні:", error);
    } finally {
        await client.end();
        console.log("🔌 З'єднання закрито.");
    }
}

initializeDB();