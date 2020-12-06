const WebSocket = require('ws');
const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config.json');

const line = '--------------------------------------------';
console.log(line);
console.log(`Vina Discord Authenticator is starting using port ${config.port}`);

client.on('ready', () => {
    console.log(`Discord: Logged in as ${client.user.tag}!`);

    let ws = null;

    // Auth Channel ID
    // Used to send authentication message
    const authChannel = client.channels.get(config.auth_channel);

    if (!authChannel) {
        console.log('Discord: Auth Channel not found, skipping live authentication messages.');
    }

    console.log(line);

    // Socket Function
    const startSocket = () => {
        ws = new WebSocket(`ws://127.0.0.1:${config.port}/auth`);

        ws.on('open', function open() {
            console.log(`Connected to FiveM server on port ${config.port}`);
        });

        ws.on('message', function incoming(data) {
            let split = data.split(':');
            if (split[0] == 'auth') {
                authenticate(split[1]);
            }
        });

        ws.on('close', function open() {
            setTimeout(() => {
                console.log('Retrying connection to FiveM server...');
                startSocket();
            }, config.reconnectDelay);
        });

        ws.on('error', function open() {
            console.log('Error connecting to FiveM server!');
        });
    };

    // Authenticate Function
    const authenticate = (discordId) => {
        let embed = new Discord.RichEmbed();

        client.fetchUser(discordId).then((user) => {
                console.log(`User '${user.username}' has authenticated! -> ${new Date()}`);

                ws.send(`auth:valid:${discordId}`);

                embed.setColor('#00ff51').setDescription(`User ** ${user.username} ** has authenticated!`).setTimestamp();
                if (authChannel) authChannel.send(embed).catch(console.log);
            })
            .catch(() => {
                console.log(`User id '${discordId}' didn't authenticate! -> ${new Date()}`);

                ws.send(`auth:invalid:${discordId}`);

                embed.setColor('#ff1e00').setDescription(`An invalid authentication using id ** ${discordId} **`).setTimestamp();
                if (authChannel) authChannel.send(embed).catch(console.log);
            });
    };

    // Start the socket
    startSocket();

});

client.login(config.bot_token).catch((e) => {
    console.log(`Discord: ${e.message}`);
});