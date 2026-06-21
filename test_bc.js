require('dotenv').config();
const BrowserClientService = require('./src/services/BrowserClientService.js');

(async () => {
    try {
        console.log("Testing BrowserClientService...");
        const link = await BrowserClientService.createDuelRoom("DUMMY_ECP");
        console.log("Success! Link:", link);
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
})();
