/*
,---.  ,---..-./`) ,---.   .--.   ____     
|   /  |   |\ .-.')|    \  |  | .'  __ `.  
|  |   |  .'/ `-' \|  ,  \ |  |/   '  \  \ 
|  | _ |  |  `-'`"`|  |\_ \|  ||___|  /  | 
|  _( )_  |  .---. |  _( )_\  |   _.-`   | 
\ (_ o._) /  |   | | (_ o _)  |.'   _    | 
 \ (_,_) /   |   | |  (_,_)\  ||  _( )_  | 
  \     /    |   | |  |    |  |\ (_ o _) / 
   `---`     '---' '--'    '--' '.(_,_).'  
   Vina Discord Authenticator v2.0
   https://github.com/VinaStar
   https://vinasky.online/
*/

// Console process
const readline = require('readline');
process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
});
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Process Args
let configPath = "config.json";
let ranksPath = "ranks.json";
process.argv.forEach((a, i) => {
    if (a.includes("--config=")) {
        configPath = process.argv[i].split("=")[1];
        console.log("Loading config file ->", configPath);
    }
    if (a.includes("--ranks=")) {
        ranksPath = process.argv[i].split("=")[1];
        console.log("Loading ranks file ->", ranksPath);
    }
});

// Initialize
const text = require('stringinject').default;
const WebSocket = require('ws');
const Discord = require('discord.js');
const client = new Discord.Client();
const API = require('./api.js');
let locale;
let Config;
let Ranks;
try {
    Config = require(`./configs/${configPath}`);
}
catch(ex) {
    throw `The config 'configs/${configPath}' file doesn't exist or is invalid.`;
}
try {
    Ranks = require(`./configs/${ranksPath}`);
}
catch(ex) {
    throw `The ranks 'configs/${ranksPath}' file doesn't exist or is invalid.`;
}
try {
    locale = require(`./configs/locale-${Config.locale}.json`);
}
catch(ex) {
    throw `The locale 'configs/locale-${Config.locale}.json' file doesn't exist or is invalid.`;
}

// Intro
const line = '--------------------------------------------';
console.log(line);
console.log(text(locale.intro_starting, [Config.port]));

// On Discord Bot Connected
client.on('ready', () => {
    console.log(text(locale.discord_logged_in, [client.user.tag]));

    let ws = null; // websocket instance
    let rlPaused = false; // commandline paused

    const server = client.guilds.get(Config.server_id);
    const channel = client.channels.get(Config.channel_id);
    const api = new API(client, server, channel, Config, Ranks, ws, locale);

    if (!server) {
        throw text(locale.discord_invalid_server_id);
    }
    if (!channel) console.log(text(locale.discord_invalid_channel_id));

    console.log(line);

    // Command Line
    if (Config.commandline) {
        // Command line command received
        rl.on('line', (input) => {
            if (input == "" || rlPaused) return;
            let params = input.split(/ +(?=(?:(?:[^"]*"){2})*[^"]*$)/g);
            let command = params[0].toLowerCase();
            params.shift();
            params.forEach((e, i) => params[i] = e.split('"').join(''));
            if (Config.debug) console.log(text(locale.commandline_debug_running_command, [command]), params, "\n");

            switch(command) {
                case "?":
                case "help":
                    api.CommandHelp();
                    break;

                case "debug":
                    if (!params[0]) return;
                    Config.debug = (params[0] === "on") ? true : false;
                    api.CommandDebug(Config.debug);
                    break;

                case "info":
                    api.CommandInfo();
                    break;

                case "p":
                case "player":
                    api.CommandPlayer(params[0]);
                    break;

                case "players":
                case "online":
                    api.CommandListPlayers();
                    break;

                case "queue":
                case "queued":
                    api.CommandListQueued();
                    break;

                case "all":
                    api.CommandListAll();
                    break;

                case "d":
                case "drop":
                    api.CommandDropId(params[0], params[1]);
                    break;

                case "forcedrop":
                    api.CommandForceDrop(params[0], params[1]);
                    break;

                case "r":
                case "rank":
                case "ranks":
                    console.log(Ranks);
                    break;

                case "reloadranks":
                    delete require.cache[require.resolve(`./configs/${ranksPath}`)]
                    Ranks = require(`./configs/${ranksPath}`);
                    api.UpdateRanks(Ranks);
                    console.log(text(locale.commandline_reloaded_ranks), Ranks);
                    break;

                case "reloadlocale":
                    delete require.cache[require.resolve(`./configs/locale-${Config.locale}.json`)]
                    locale = require(`./configs/locale-${Config.locale}.json`);
                    api.UpdateLocale(locale);
                    console.log(text(locale.commandline_reloaded_locale));
                    break;

                default:
                    console.log(text(locale.commandline_command_not_found, [command]));
                    break;
            }
        });
    }

    // Socket Function
    const startSocket = () => {
        ws = new WebSocket(`ws://127.0.0.1:${Config.port}/auth`);

        // Websocket connected
        ws.on('open', function open() {
            api.UpdateWebsocket(ws);
            console.log(text(locale.websocket_connected_to_port, [Config.port]));

            // Start commandline
            if (Config.commandline) console.log(text(locale.commandline_is_running));
            rlPaused = false;
        });

        // Websocket receive
        ws.on('message', function incoming(_data) {
            const data = JSON.parse(_data);
            if (Config.debug)  console.log(text(locale.websocket_message_received), data);

            switch(data.action) {
                case "OnPlayerConnecting":
                    api.HandleOnPlayerConnecting(data.username, data.discordId, data.time);
                    break;

                case "OnAuthenticationTimeOut":
                    api.HandleOnAuthenticationTimeOut(data.username, data.discordId, data.time);
                    break;

                case "OnAuthenticationQueuedCompleted":
                    api.HandleOnAuthenticationQueuedCompleted(data.username, data.discordId, data.time);
                    break;

                case "OnPlayerJoining":
                    api.HandleOnPlayerJoining(data.username, data.discordId, data.time);
                    break;

                case "OnPlayerDropped":
                    api.HandleOnPlayerDropped(data.username, data.discordId, data.reason, data.time);
                    break;

                case "GetServerInfo":
                    api.HandleGetServerInfo(data.maxPlayers, data.playerCount, data.onlineList, data.queuedCount, data.queuedList, data.time);
                    break;
            }
        });

        // Websocket disconnected
        ws.on('close', function close() {
            if (rl && !rlPaused) console.log(text(locale.commandline_is_paused));
            rlPaused = true;
            
            setTimeout(() => {
                console.log(text(locale.websocket_retry_connection));
                startSocket();
            }, Config.reconnectDelay);
        });

        // Websocket error
        ws.on('error', function error() {
            console.log(text(locale.websocket_error_connection));
        });
    };

    // Start the socket
    startSocket();

});

// Start bot client
client.login(Config.bot_token).catch((e) => {
    console.log(text(locale.discord_error_message, [e.message]));
});