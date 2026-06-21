const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

async function initDB() {
    const db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    // Create tables
    await db.exec(`
        CREATE TABLE IF NOT EXISTS Users (
            discordId TEXT PRIMARY KEY,
            username TEXT,
            joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS Events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            roomLink TEXT,
            status TEXT DEFAULT 'Pending',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS AccessCodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            discordId TEXT,
            eventId INTEGER,
            code TEXT UNIQUE,
            used BOOLEAN DEFAULT 0,
            expiresAt DATETIME,
            FOREIGN KEY(discordId) REFERENCES Users(discordId),
            FOREIGN KEY(eventId) REFERENCES Events(id)
        );
    `);

    return db;
}

// Singleton connection
let dbInstance = null;

async function getDB() {
    if (!dbInstance) {
        dbInstance = await initDB();
    }
    return dbInstance;
}

module.exports = {
    initDB,
    getDB
};
