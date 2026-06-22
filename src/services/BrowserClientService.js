const { BrowserClient } = require('starblast-modding');
const path = require('path');

// Which mod the duel room runs. Configure via .env:
//   MOD_URL  = https URL to a mod file (e.g. a raw.githubusercontent.com link) — auto-reloads on change
//   MOD_PATH = absolute/relative path to a local mod file — auto-reloads on change
// If neither is set, falls back to the default Starblast duel mod (sdc.js).
const MOD_URL = process.env.MOD_URL || null;
const MOD_PATH = process.env.MOD_PATH ? path.resolve(process.env.MOD_PATH) : null;
const DEFAULT_MOD = 'https://starblast.data.neuronality.com/mods/sdc.js';

class BrowserClientService {
    static async createDuelRoom(ecpKey) {
        console.log('Starting BrowserClient...');
        console.log('Mod source:', MOD_URL || MOD_PATH || DEFAULT_MOD);

        return new Promise((resolve, reject) => {
            const container = new BrowserClient({
                cacheECPKey: false
            });

            container.getNode().on('error', (err) => {
                console.error('ModdingClient Error:', err);
            });

            container.getNode().on('log', (msg) => {
                console.log('Starblast:', msg);
            });

            // Handle start event to get the room link
            container.getNode().on('start', (link) => {
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
                    resolve(container.getNode().link);
                } else {
                    reject(new Error('ModdingClient started but room link was not received within 30 seconds.'));
                }
            }, 30000);
        });
    }
}

module.exports = BrowserClientService;
