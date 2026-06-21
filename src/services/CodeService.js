const { getDB } = require('../db');
const crypto = require('crypto');

class CodeService {
    static generateRandomCode(length = 6) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(crypto.randomInt(0, chars.length));
        }
        return result;
    }

    static async generateCodeForUser(discordId, eventId) {
        const db = await getDB();
        
        // Invalidate previous codes for this user for this event (optional, but good practice)
        await db.run(
            `UPDATE AccessCodes SET expiresAt = CURRENT_TIMESTAMP WHERE discordId = ? AND eventId = ? AND used = 0`,
            [discordId, eventId]
        );

        let code;
        let isUnique = false;
        while (!isUnique) {
            code = CodeService.generateRandomCode();
            const existing = await db.get(`SELECT * FROM AccessCodes WHERE code = ?`, [code]);
            if (!existing) {
                isUnique = true;
            }
        }

        // Set expiration (e.g., 2 hours from now)
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

        await db.run(
            `INSERT INTO AccessCodes (discordId, eventId, code, expiresAt) VALUES (?, ?, ?, ?)`,
            [discordId, eventId, code, expiresAt]
        );

        return code;
    }

    static async generateManualCode(eventId) {
        const db = await getDB();
        
        let code;
        let isUnique = false;
        while (!isUnique) {
            code = CodeService.generateRandomCode();
            const existing = await db.get(`SELECT * FROM AccessCodes WHERE code = ?`, [code]);
            if (!existing) {
                isUnique = true;
            }
        }

        // Set expiration (e.g., 2 hours from now)
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

        // Use 'MANUAL' or a specific string for discordId to indicate it was manually generated
        await db.run(
            `INSERT INTO AccessCodes (discordId, eventId, code, expiresAt) VALUES (?, ?, ?, ?)`,
            ['MANUAL', eventId, code, expiresAt]
        );

        return code;
    }

    static async checkCode(codeStr) {
        const db = await getDB();
        const codeRec = await db.get(`SELECT * FROM AccessCodes WHERE code = ?`, [codeStr]);

        if (!codeRec) return { valid: false, reason: 'Code not found' };
        if (codeRec.used) return { valid: false, reason: 'Code already used' };
        
        if (new Date() > new Date(codeRec.expiresAt + 'Z')) {
            return { valid: false, reason: 'Code expired' };
        }

        const event = await db.get(`SELECT * FROM Events WHERE id = ?`, [codeRec.eventId]);
        
        // Mark as used since the user wants it to be consumed upon checking
        await db.run(`UPDATE AccessCodes SET used = 1 WHERE id = ?`, [codeRec.id]);
        
        return { valid: true, eventId: codeRec.eventId, discordId: codeRec.discordId, expiresAt: codeRec.expiresAt, eventStatus: event ? event.status : 'Unknown' };
    }

    static async validateAndUseCode(codeStr) {
        const db = await getDB();
        const codeRec = await db.get(`SELECT * FROM AccessCodes WHERE code = ?`, [codeStr]);

        if (!codeRec) return { valid: false, reason: 'Code not found' };
        if (codeRec.used) return { valid: false, reason: 'Code already used' };
        
        if (new Date() > new Date(codeRec.expiresAt + 'Z')) { // appending Z if sqlite date is stored as UTC without Z
            return { valid: false, reason: 'Code expired' };
        }

        // Mark as used
        await db.run(`UPDATE AccessCodes SET used = 1 WHERE id = ?`, [codeRec.id]);
        
        const event = await db.get(`SELECT * FROM Events WHERE id = ?`, [codeRec.eventId]);
        
        return { valid: true, event };
    }
}

module.exports = CodeService;
