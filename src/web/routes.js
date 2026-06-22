const express = require('express');
const router = express.Router();
const AuthService = require('../services/AuthService');
const RegistrationService = require('../services/RegistrationService');
const EventService = require('../services/EventService');
const BrowserClientService = require('../services/BrowserClientService');
const CodeService = require('../services/CodeService');
const DiscordService = require('../services/DiscordService');

// Redirect root to dashboard
router.get('/', (req, res) => {
    res.redirect('/dashboard');
});

// Login Page
router.get('/login', (req, res) => {
    if (AuthService.isAuthenticated(req)) {
        return res.redirect('/dashboard');
    }
    res.render('pages/login', { error: null });
});

router.post('/login', (req, res) => {
    const { password } = req.body;
    
    if (AuthService.validateLogin(password)) {
        req.session.authenticated = true;
        return res.redirect('/dashboard');
    }
    
    res.render('pages/login', { error: 'Invalid password' });
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Dashboard (Protected)
router.get('/dashboard', AuthService.requireAuth, async (req, res) => {
    const users = await RegistrationService.getAllRegisteredUsers();
    const activeEvent = await EventService.getActiveEvent();
    const allEvents = await EventService.getAllEvents();
    
    let stats = { participantsCount: 0, codesGenerated: 0, codesUsed: 0 };
    if (activeEvent) {
        stats = await EventService.getEventStats(activeEvent.id);
    }
    
    res.render('pages/dashboard', {
        usersCount: users.length,
        activeEvent: activeEvent || null,
        stats: stats,
        allEvents: allEvents
    });
});

// Create Event API
router.post('/api/events/create', AuthService.requireAuth, async (req, res) => {
    console.log("POST /api/events/create received!");
    const ecpCode = process.env.ECP_KEY;
    if (!ecpCode) {
        return res.status(500).json({ success: false, error: 'ECP_KEY is not defined in .env file.' });
    }

    try {
        // 1. Create Room via BrowserClient
        const roomLink = await BrowserClientService.createDuelRoom(ecpCode);
        
        // 2. Save Event
        const eventId = await EventService.createEvent(roomLink);

        // 3. Generate Codes & Send DMs
        const users = await RegistrationService.getAllRegisteredUsers();
        let dmSuccessCount = 0;
        let dmFailCount = 0;

        // Process in parallel or sequentially. We'll do sequentially to avoid discord rate limits.
        for (const user of users) {
            const code = await CodeService.generateCodeForUser(user.discordId, eventId);
            
            // Build join link (using the host URL, fallback to req.headers.host)
            const protocol = req.protocol || 'http';
            const host = req.get('host');
            const joinLink = `${protocol}://${host}/join/${code}`;

            const msgContent = `🎮 **Moon Duel Event Started!**\n\nRoom Link: ${roomLink}\nYour Access Code: \`${code}\`\n\n*This code can only be used once.*`;
            
            const success = await DiscordService.sendDM(user.discordId, msgContent);
            if (success) dmSuccessCount++;
            else dmFailCount++;
        }

        res.json({
            success: true,
            roomLink,
            stats: {
                totalUsers: users.length,
                dmSuccess: dmSuccessCount,
                dmFail: dmFailCount
            }
        });

    } catch (error) {
        console.error('Create Event Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Resend Code API
router.post('/api/codes/resend', AuthService.requireAuth, async (req, res) => {
    const { discordId } = req.body;
    
    const activeEvent = await EventService.getActiveEvent();
    if (!activeEvent) {
        return res.status(400).json({ success: false, error: 'No active event' });
    }

    try {
        const users = await RegistrationService.getAllRegisteredUsers();
        const user = users.find(u => u.discordId === discordId);
        
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not registered' });
        }

        const newCode = await CodeService.generateCodeForUser(discordId, activeEvent.id);
        
        const protocol = req.protocol || 'http';
        const host = req.get('host');
        const joinLink = `${protocol}://${host}/join/${newCode}`;

        const msgContent = `🔄 **Moon Duel - New Access Code**\n\nRoom Link: ${activeEvent.roomLink}\nYour New Access Code: \`${newCode}\`\n\n*Your old code is now invalid.*`;

        const dmSuccess = await DiscordService.sendDM(discordId, msgContent);

        res.json({ success: true, dmSuccess });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generate Manual Code API
router.post('/api/codes/manual/:eventId', AuthService.requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const code = await CodeService.generateManualCode(eventId);
        
        const protocol = req.protocol || 'http';
        const host = req.get('host');
        const joinLink = `${protocol}://${host}/join/${code}`;
        
        res.json({ success: true, code, joinLink });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Use Code API (consuming, one-time) — called by the in-game mod to verify a player.
// On success the code is marked used and cannot be reused. Returns { valid, reason }.
router.post('/api/codes/use/:code', async (req, res) => {
    try {
        const result = await CodeService.validateAndUseCode(req.params.code);
        res.json({ valid: result.valid, reason: result.reason || null });
    } catch (error) {
        res.status(500).json({ valid: false, reason: error.message });
    }
});


// Delete Event API
router.get('/api/events/delete/:id', AuthService.requireAuth, async (req, res) => {
    console.log(`DELETE /api/events/${req.params.id} received!`);
    try {
        const eventId = req.params.id;
        const event = await EventService.getEventById(eventId);
        if (event) {
            BrowserClientService.stopDuelRoom(event.roomLink);
        }
        await EventService.deleteEvent(eventId);
    } catch (error) {
        console.error('Delete Event Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }

    res.redirect("/dashboard");
});


// ── Live Mod Console ────────────────────────────────────────────────
// Catalog of mod commands shown as quick-buttons in the console UI.
// `args` describes prompts; the UI builds e.g. kick(12,"reason").
const MOD_COMMANDS = [
    { group: 'Duel', cmds: [
        { name: 'rankedDuel',    label: '⚔️ Start Ranked Duel', args: [{ k: 'p1 id', t: 'num' }, { k: 'p2 id', t: 'num' }, { k: 'ship (opt)', t: 'num', opt: true }] },
        { name: 'stopRankedDuel',label: '🛑 Stop Duel',          args: [] },
        { name: 'requireShip',   label: '🚀 Require Ship',       args: [{ k: 'ship code', t: 'num' }] },
    ]},
    { group: 'Moderation', cmds: [
        { name: 'kick',          label: '👢 Kick',          args: [{ k: 'player id', t: 'num' }, { k: 'reason (opt)', t: 'str', opt: true }] },
        { name: 'ban',           label: '🔨 Ban',           args: [{ k: 'player id', t: 'num' }, { k: 'reason (opt)', t: 'str', opt: true }] },
        { name: 'unban',         label: '♻️ Unban',         args: [{ k: 'name', t: 'str' }] },
        { name: 'bruteforceBan', label: '☠️ Bruteforce Ban', args: [{ k: 'player id', t: 'num' }] },
        { name: 'forceSpec',     label: '👁 Force Spec',     args: [{ k: 'player id', t: 'num' }] },
        { name: 'crashGame',     label: '💥 Crash',         args: [{ k: 'player id', t: 'num' }] },
        { name: 'ghostMode',     label: '👻 Ghost',         args: [{ k: 'player id', t: 'num' }] },
    ]},
    { group: 'Admin & ships', cmds: [
        { name: 'giveAdmin',     label: '⭐ Give Admin',       args: [{ k: 'player id', t: 'num' }] },
        { name: 'removeAdmin',   label: '✖ Remove Admin',     args: [{ k: 'player id', t: 'num' }] },
        { name: 'giveAdminShip', label: '🌙 Give Admin Ship',  args: [{ k: 'player id', t: 'num' }, { k: 'ship (opt)', t: 'num', opt: true }] },
    ]},
    { group: 'Messaging', cmds: [
        { name: 'say',  label: '📢 Say (broadcast)', args: [{ k: 'text', t: 'str' }, { k: 'seconds (opt)', t: 'num', opt: true }, { k: 'color (opt)', t: 'str', opt: true }] },
        { name: 'msg',  label: '💬 Private message',  args: [{ k: 'player id', t: 'num' }, { k: 'text', t: 'str' }] },
    ]},
    { group: 'Tuning', cmds: [
        { name: 'setTickThrottle',        label: '⏱ Tick Throttle',  args: [{ k: 'value', t: 'num' }] },
        { name: 'resetRateLimit',         label: '🚦 Click Rate',     args: [{ k: 'value', t: 'num' }] },
        { name: 'resetMinBruteforceSim',  label: '🎚 BF Similarity',  args: [{ k: 'value', t: 'num' }] },
        { name: 'PublishToServerList',    label: '🌐 Publish Server', args: [] },
    ]},
];

router.get('/console', AuthService.requireAuth, (req, res) => {
    res.render('pages/console', { commands: MOD_COMMANDS, roomActive: BrowserClientService.isRoomActive() });
});

// Run a command in the running mod context.
router.post('/api/console/exec', AuthService.requireAuth, async (req, res) => {
    const command = (req.body && req.body.command || '').toString().trim();
    if (!command) return res.status(400).json({ success: false, error: 'Empty command' });
    try {
        const result = await BrowserClientService.execCommand(command);
        res.json({ success: result.success, output: result.output });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Incremental log polling. ?since=<lastSeq>
router.get('/api/console/logs', AuthService.requireAuth, (req, res) => {
    const since = parseInt(req.query.since) || 0;
    res.json(BrowserClientService.getLogs(since));
});


// Public Join Route (Code Validation)
router.get('/join/:code', async (req, res) => {
    const codeStr = req.params.code;
    const result = await CodeService.validateAndUseCode(codeStr);

    if (result.valid) {
        // Redirect to actual Starblast room
        res.redirect(result.event.roomLink);
    } else {
        res.status(403).send(`<h1>Access Denied</h1><p>${result.reason}</p>`);
    }
});

module.exports = router;
