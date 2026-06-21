const { getDB } = require('../db');

class EventService {
    static async createEvent(roomLink) {
        const db = await getDB();
        const result = await db.run(
            `INSERT INTO Events (roomLink, status) VALUES (?, 'Running')`,
            [roomLink]
        );
        return result.lastID;
    }

    static async getActiveEvent() {
        const db = await getDB();
        return await db.get(`SELECT * FROM Events WHERE status = 'Running' ORDER BY id DESC LIMIT 1`);
    }

    static async updateEventStatus(eventId, status) {
        const db = await getDB();
        await db.run(`UPDATE Events SET status = ? WHERE id = ?`, [status, eventId]);
    }

    static async getEventStats(eventId) {
        const db = await getDB();
        const codes = await db.all(`SELECT * FROM AccessCodes WHERE eventId = ?`, [eventId]);
        const participantsCount = codes.length;
        const codesUsed = codes.filter(c => c.used).length;
        
        return {
            participantsCount,
            codesGenerated: participantsCount,
            codesUsed
        };
    }

    static async getAllEvents() {
        const db = await getDB();
        return await db.all(`SELECT * FROM Events ORDER BY createdAt DESC`);
    }

    static async deleteEvent(eventId) {
        const db = await getDB();
        
        // Find users who participated in this event
        const codes = await db.all(`SELECT discordId FROM AccessCodes WHERE eventId = ?`, [eventId]);
        const discordIds = codes.map(c => c.discordId);
        
        // Delete AccessCodes
        await db.run(`DELETE FROM AccessCodes WHERE eventId = ?`, [eventId]);
        
        // Delete those users from the database
        if (discordIds.length > 0) {
            const placeholders = discordIds.map(() => '?').join(',');
            await db.run(`DELETE FROM Users WHERE discordId IN (${placeholders})`, discordIds);
        }
        
        // Delete Event
        await db.run(`DELETE FROM Events WHERE id = ?`, [eventId]);
    }
}

module.exports = EventService;
