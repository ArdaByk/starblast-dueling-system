const { getDB } = require('../db');

class RegistrationService {
    static async registerUser(discordId, username) {
        const db = getDB();
        try {
            db.prepare(`INSERT INTO Users (discordId, username) VALUES (?, ?)`).run(discordId, username);
            return true;
        } catch (e) {
            // better-sqlite3 throws SqliteError with code 'SQLITE_CONSTRAINT_PRIMARYKEY' or similar
            if (e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || e.code === 'SQLITE_CONSTRAINT') {
                return false; // Already registered
            }
            throw e;
        }
    }

    static async unregisterUser(discordId) {
        const db = getDB();
        db.prepare(`DELETE FROM Users WHERE discordId = ?`).run(discordId);
    }

    static async getAllRegisteredUsers() {
        const db = getDB();
        return db.prepare(`SELECT * FROM Users`).all();
    }
}

module.exports = RegistrationService;
