const { BrowserClient } = require('starblast-modding');

class BrowserClientService {
    static async createDuelRoom(ecpKey) {
        console.log('Starting BrowserClient...');

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
                    await container.loadCodeFromExternal("https://starblast.data.neuronality.com/mods/sdc.js");
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
