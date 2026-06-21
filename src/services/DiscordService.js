let discordClient = null;

class DiscordService {
    static setClient(client) {
        discordClient = client;
    }

    static getClient() {
        return discordClient;
    }

    static async sendDM(discordId, messageContent) {
        if (!discordClient) {
            console.error('Discord client not initialized in DiscordService');
            return false;
        }
        
        try {
            const user = await discordClient.users.fetch(discordId);
            if (user) {
                await user.send(messageContent);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`Failed to send DM to ${discordId}:`, error.message);
            return false;
        }
    }
}

module.exports = DiscordService;
