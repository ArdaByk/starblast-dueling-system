const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const RegistrationService = require('../services/RegistrationService');
const DiscordService = require('../services/DiscordService');

function setupBot() {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMessageReactions
        ],
        partials: [Partials.Message, Partials.Channel, Partials.Reaction],
    });

    DiscordService.setClient(client);

    client.once('ready', () => {
        console.log(`Discord bot logged in as ${client.user.tag}`);
    });


    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        if (message.content === '!registerduel') {
            const embed = new EmbedBuilder()
                .setTitle('🎮 Moon Duel Event Registration')
                .setDescription('React with ⚔️ to participate in the next duel event.')
                .setColor('#4CC9F0')
                .setFooter({ text: 'Starblast Moon Dueling' });

            const msg = await message.channel.send({ embeds: [embed] });
            await msg.react('⚔️');
            
            // Set this as the only active registration message
            DiscordService.setActiveRegistrationMessageId(msg.id);
        }
    });

    client.on('messageReactionAdd', async (reaction, user) => {
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Something went wrong when fetching the message:', error);
                return;
            }
        }
        if (user.bot) return;

        // Check if this is a registration message sent by the bot
        if (reaction.message.author.id !== client.user.id) return;
        
        if (reaction.emoji.name === '⚔️') {
            const embed = reaction.message.embeds[0];
            if (embed && embed.title === '🎮 Moon Duel Event Registration') {
                
                // If registration is closed or this is an OLD registration message, invalidate the reaction
                const activeId = DiscordService.getActiveRegistrationMessageId();
                if (!activeId || reaction.message.id !== activeId) {
                    console.log(`User ${user.username} tried to react to an old registration message.`);
                    try {
                        await reaction.users.remove(user.id);
                    } catch (e) {
                        console.error('Failed to remove reaction from old message:', e);
                    }
                    return;
                }

                const registered = await RegistrationService.registerUser(user.id, user.username);
                if (registered) {
                    console.log(`User ${user.username} registered for duel.`);
                }
            }
        }
    });

    client.on('messageReactionRemove', async (reaction, user) => {
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Something went wrong when fetching the message:', error);
                return;
            }
        }
        if (user.bot) return;

        if (reaction.message.author.id !== client.user.id) return;

        if (reaction.emoji.name === '⚔️') {
            const embed = reaction.message.embeds[0];
            if (embed && embed.title === '🎮 Moon Duel Event Registration') {

                // Ignore un-reactions on closed/old messages
                const activeId = DiscordService.getActiveRegistrationMessageId();
                if (!activeId || reaction.message.id !== activeId) {
                    return;
                }

                await RegistrationService.unregisterUser(user.id);
                console.log(`User ${user.username} unregistered from duel.`);
            }
        }
    });

    return client;
}

module.exports = setupBot;
