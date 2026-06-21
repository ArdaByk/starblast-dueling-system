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
        const db = getDB();
        
        // Invalidate previous codes for this user for this event (optional, but good practice)
        db.prepare(`UPDATE AccessCodes SET expiresAt = CURRENT_TIMESTAMP WHERE discordId = ? AND eventId = ? AND used = 0`).run(discordId, eventId);

        let code;
        let isUnique = false;
        while (!isUnique) {
            code = CodeService.generateRandomCode();
            const existing = db.prepare(`SELECT * FROM AccessCodes WHERE code = ?`).get(code);
            if (!existing) {
                isUnique = true;
            }
        }

        // Set expiration (e.g., 2 hours from now)
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

        db.prepare(`INSERT INTO AccessCodes (discordId, eventId, code, expiresAt) VALUES (?, ?, ?, ?)`).run(discordId, eventId, code, expiresAt);

        return code;
    }

    static async generateManualCode(eventId) {
        const db = getDB();
        
        let code;
        let isUnique = false;
        while (!isUnique) {
            code = CodeService.generateRandomCode();
            const existing = db.prepare(`SELECT * FROM AccessCodes WHERE code = ?`).get(code);
            if (!existing) {
                isUnique = true;
            }
        }

        // Set expiration (e.g., 2 hours from now)
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

        // Use 'MANUAL' or a specific string for discordId to indicate it was manually generated
        db.prepare(`INSERT INTO AccessCodes (discordId, eventId, code, expiresAt) VALUES (?, ?, ?, ?)`).run('MANUAL', eventId, code, expiresAt);

        return code;
    }

    static async checkCode(codeStr) {
        const db = getDB();
        const codeRec = db.prepare(`SELECT * FROM AccessCodes WHERE code = ?`).get(codeStr);

        if (!codeRec) return { valid: false, reason: 'Code not found' };
        if (codeRec.used) return { valid: false, reason: 'Code already used' };
        
        if (new Date() > new Date(codeRec.expiresAt + 'Z')) {
            return { valid: false, reason: 'Code expired' };
        }

        const event = db.prepare(`SELECT * FROM Events WHERE id = ?`).get(codeRec.eventId);
        
        // Mark as used since the user wants it to be consumed upon checking
        db.prepare(`UPDATE AccessCodes SET used = 1 WHERE id = ?`).run(codeRec.id);
        
        return { valid: true, eventId: codeRec.eventId, discordId: codeRec.discordId, expiresAt: codeRec.expiresAt, eventStatus: event ? event.status : 'Unknown' };
    }

    static async validateAndUseCode(codeStr) {
        const db = getDB();
        const codeRec = db.prepare(`SELECT * FROM AccessCodes WHERE code = ?`).get(codeStr);

        if (!codeRec) return { valid: false, reason: 'Code not found' };
        if (codeRec.used) return { valid: false, reason: 'Code already used' };
        
        if (new Date() > new Date(codeRec.expiresAt + 'Z')) { // appending Z if sqlite date is stored as UTC without Z
            return { valid: false, reason: 'Code expired' };
        }

        // Mark as used
        db.prepare(`UPDATE AccessCodes SET used = 1 WHERE id = ?`).run(codeRec.id);
        
        const event = db.prepare(`SELECT * FROM Events WHERE id = ?`).get(codeRec.eventId);
        
        return { valid: true, event };
    }
}

module.exports = CodeService;
