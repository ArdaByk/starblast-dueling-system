const { getDB } = require('../db');

class RegistrationService {
    static async registerUser(discordId, username) {
        const db = await getDB();
        try {
            await db.run(
                `INSERT INTO Users (discordId, username) VALUES (?, ?)`,
                [discordId, username]
            );
            return true;
        } catch (e) {
            if (e.code === 'SQLITE_CONSTRAINT') {
                return false; // Already registered
            }
            throw e;
        }
    }

    static async unregisterUser(discordId) {
        const db = await getDB();
        await db.run(`DELETE FROM Users WHERE discordId = ?`, [discordId]);
    }

    static async getAllRegisteredUsers() {
        const db = await getDB();
        return await db.all(`SELECT * FROM Users`);
    }
}

module.exports = RegistrationService;
