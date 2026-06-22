const Database = require('better-sqlite3');
const path = require('path');

let dbInstance = null;

function initDB() {
    const db = new Database(path.join(__dirname, 'database.sqlite'));
    
    // Use WAL mode for better concurrency
    db.pragma('journal_mode = WAL');

    // Create tables
    db.exec(`
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

    // Insert dummy 'MANUAL' user to satisfy foreign key constraints for manual codes
    db.exec(`INSERT OR IGNORE INTO Users (discordId, username) VALUES ('MANUAL', 'System Manual User')`);

    return db;
}

function getDB() {
    if (!dbInstance) {
        dbInstance = initDB();
    }
    return dbInstance;
}

module.exports = {
    initDB,
    getDB
};
