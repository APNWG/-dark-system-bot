const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('clientReady', () => {
  console.log(`Dark System Bot is online as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
