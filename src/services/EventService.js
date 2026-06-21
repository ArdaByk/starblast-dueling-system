const { getDB } = require('../db');

class EventService {
    static async createEvent(roomLink) {
        const db = getDB();
        const info = db.prepare(`INSERT INTO Events (roomLink, status) VALUES (?, 'Running')`).run(roomLink);
        return info.lastInsertRowid;
    }

    static async getActiveEvent() {
        const db = getDB();
        return db.prepare(`SELECT * FROM Events WHERE status = 'Running' ORDER BY id DESC LIMIT 1`).get();
    }

    static async updateEventStatus(eventId, status) {
        const db = getDB();
        db.prepare(`UPDATE Events SET status = ? WHERE id = ?`).run(status, eventId);
    }

    static async getEventStats(eventId) {
        const db = getDB();
        const codes = db.prepare(`SELECT * FROM AccessCodes WHERE eventId = ?`).all(eventId);
        const participantsCount = codes.length;
        const codesUsed = codes.filter(c => c.used).length;
        
        return {
            participantsCount,
            codesGenerated: participantsCount,
            codesUsed
        };
    }

    static async getAllEvents() {
        const db = getDB();
        return db.prepare(`SELECT * FROM Events ORDER BY createdAt DESC`).all();
    }

    static async deleteEvent(eventId) {
        const db = getDB();
        
        // Find users who participated in this event
        const codes = db.prepare(`SELECT discordId FROM AccessCodes WHERE eventId = ?`).all(eventId);
        const discordIds = codes.map(c => c.discordId);
        
        // Delete AccessCodes
        db.prepare(`DELETE FROM AccessCodes WHERE eventId = ?`).run(eventId);
        
        // Delete those users from the database
        if (discordIds.length > 0) {
            const placeholders = discordIds.map(() => '?').join(',');
            db.prepare(`DELETE FROM Users WHERE discordId IN (${placeholders})`).run(...discordIds);
        }
        
        // Delete Event
        db.prepare(`DELETE FROM Events WHERE id = ?`).run(eventId);
    }
}

module.exports = EventService;
