require('dotenv').config();
const { getDB } = require('./src/db');
const setupBot = require('./src/bot/client');
const setupServer = require('./src/web/server');

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

async function startApp() {
    try {
        console.log("Initializing database...");
        getDB();
        console.log("Database initialized successfully.");

        console.log("Starting Discord Bot...");
        const discordClient = setupBot();
        
        if (process.env.DISCORD_TOKEN && process.env.DISCORD_TOKEN !== 'your_discord_bot_token_here') {
            await discordClient.login(process.env.DISCORD_TOKEN);
        } else {
            console.warn("DISCORD_TOKEN is missing or default. Bot will not connect to Discord.");
        }

        console.log("Starting Web Panel...");
        const app = setupServer();
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Web Panel listening on http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error("Failed to start application:", error);
        process.exit(1);
    }
}

startApp();
