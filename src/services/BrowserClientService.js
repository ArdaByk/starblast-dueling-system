const { BrowserClient } = require('starblast-modding');
const path = require('path');
const fs = require('fs');

// Which mod the duel room runs. Configure via .env:
//   MOD_URL  = https URL to a mod file (e.g. a raw.githubusercontent.com link) — auto-reloads on change
//   MOD_PATH = absolute/relative path to a local mod file — auto-reloads on change
// If neither is set, it uses the bundled mod (moon-dueling.js at the repo root) when present,
// otherwise the default Starblast duel mod (sdc.js).
const BUNDLED_MOD = path.resolve(__dirname, '../../moon-dueling.js');
const MOD_URL = process.env.MOD_URL || null;
const MOD_PATH = process.env.MOD_PATH
    ? path.resolve(process.env.MOD_PATH)
    : (fs.existsSync(BUNDLED_MOD) ? BUNDLED_MOD : null);
const DEFAULT_MOD = 'https://starblast.data.neuronality.com/mods/sdc.js';

// ── Live console state ──────────────────────────────────────────────
// The currently-running room's BrowserClient, plus a ring buffer of log lines
// so the web console can stream output and run commands in the mod context.
let activeContainer = null;
const LOG_CAP = 500;
let logBuffer = [];   // { seq, t, level, msg }
let logSeq = 0;

function pushLog(level, msg) {
    logSeq += 1;
    logBuffer.push({ seq: logSeq, t: Date.now(), level, msg: String(msg) });
    if (logBuffer.length > LOG_CAP) logBuffer = logBuffer.slice(-LOG_CAP);
}

class BrowserClientService {
    static activeClients = new Map();

    static async createDuelRoom(ecpKey) {
        console.log('Starting BrowserClient...');
        console.log('Mod source:', MOD_URL || MOD_PATH || DEFAULT_MOD);

        return new Promise((resolve, reject) => {
            const container = new BrowserClient({
                cacheECPKey: false
            });
            activeContainer = container;
            logBuffer = [];
            logSeq = 0;
            pushLog('info', 'Room starting…');

            container.getNode().on('error', (err) => {
                console.error('ModdingClient Error:', err);
                pushLog('error', err && err.message ? err.message : err);
            });

            container.getNode().on('log', (msg) => {
                console.log('Starblast:', msg);
                pushLog('log', msg);
            });

            // Handle start event to get the room link
            container.getNode().on('start', (link) => {
                BrowserClientService.activeClients.set(link, container);
                pushLog('info', 'Room ready: ' + link);
                resolve(link);
            });

            (async () => {
                try {
                    if (MOD_PATH) {
                        await container.loadCodeFromLocal(MOD_PATH, { watchChanges: true });
                    } else {
                        await container.loadCodeFromExternal(MOD_URL || DEFAULT_MOD, { watchChanges: true, watchInterval: 5000 });
                    }
                    container.setRegion('Europe');
                    container.setECPKey(ecpKey);

                    console.log("BrowserClient executing...");
                    await container.start();
                } catch (err) {
                    reject(err);
                }
            })();

            // Fallback timeout in case of hanging
            setTimeout(() => {
                if (container.getNode().link) {
                    BrowserClientService.activeClients.set(container.getNode().link, container);
                    resolve(container.getNode().link);
                } else {
                    reject(new Error('ModdingClient started but room link was not received within 30 seconds.'));
                }
            }, 30000);
        });
    }

    static stopDuelRoom(roomLink) {
        if (BrowserClientService.activeClients.has(roomLink)) {
            console.log(`Stopping ModdingClient for room: ${roomLink}`);
            const container = BrowserClientService.activeClients.get(roomLink);
            if (container && typeof container.stop === 'function') {
                container.stop();
            }
            BrowserClientService.activeClients.delete(roomLink);
            if (container === activeContainer) activeContainer = null;
        } else {
            console.log(`No active ModdingClient found for room: ${roomLink}`);
        }
    }

    // ── Console support ──────────────────────────────────────────────
    static isRoomActive() {
        return !!(activeContainer && activeContainer.getNode && activeContainer.getNode().link);
    }

    // Return log lines with seq greater than `since` (for incremental polling).
    static getLogs(since = 0) {
        const lines = logBuffer.filter(l => l.seq > since);
        return { lines, lastSeq: logSeq, active: BrowserClientService.isRoomActive() };
    }

    // Run an arbitrary mod command (kick(1), rankedDuel(1,2), say("hi"), …) in the
    // running mod's context and return its captured output.
    static async execCommand(command) {
        if (!activeContainer) throw new Error('No active room. Create an event first.');
        pushLog('cmd', '> ' + command);
        const res = await activeContainer.execute(command, { allowEval: true, captureOutput: true });
        const out = res && res.output !== undefined ? res.output : '';
        if (out !== undefined && out !== '' && out !== null) {
            pushLog(res && res.success === false ? 'error' : 'out', typeof out === 'string' ? out : JSON.stringify(out));
        }
        return { success: !res || res.success !== false, output: out };
    }
}

module.exports = BrowserClientService;
