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

    Variables/Objects:
    - client
    - server
    - channel
    - config
    - ranks
    - maxPlayers
    - playerCount
    - onlineList
    - queuedCount
    - queuedList
    - lastServerInfoTime

    API Methods:
    - UpdateWebsocket
    - UpdateRanks

    Commandline Commands Handlers:
    - CommandHelp
    - CommandInfo
    - CommandDebug
    - CommandListAll
    - CommandListPlayers
    - CommandListQueued
    - CommandDropId
    - CommandForceDrop
    - CommandPlayer

    Discord Methods:
    - DiscordSendChannelNotification
    - DiscordSendChannelValidNotification
    - DiscordSendChannelErrorNotification
    - DiscordSendChannelWarningNotification
    - DiscordSendChannelInfoNotification
    - DiscordGetUserById
    - DiscordGetDisplayNameById
    - DiscordGetIdByDisplayName
    - DiscordGetUserRoles
    - DiscordUserHasRole

    Miscs Methods:
    - GetPlayerIsOnline
    - GetPlayerRank
    - GetPlayerRankPriority

    Server Event Handlers:
    - HandleOnPlayerConnecting
    - HandleOnAuthenticationTimeOut
    - HandleOnAuthenticationQueuedCompleted
    - HandleOnPlayerJoining
    - HandleOnPlayerDropped
    - HandleGetServerInfo
    
    Server Action Methods:
    - DoValid
    - DoInvalid
    - DoAddQueue
    - DoUpdateQueue
    - DoRemoveQueue
    - DoRequestPlayerDrop
    - DoRequestServerInfo
*/

const Discord = require('discord.js');
const text = require('stringinject').default;

class API
{
    constructor(client, server, channel, config, ranks, ws, locale)
    {
        this.client = client;
        this.server = server;
        this.channel = channel;
        this.config = config;
        this.ranks = ranks;
        this.ws = ws;
        this.locale = locale;

        this.maxPlayers = 0;
        this.playerCount = 0;
        this.onlineList = {};
        this.queuedCount = 0;
        this.queuedList = {};
        this.lastServerInfoTime = null;
    }

    // API Methods

    UpdateWebsocket(ws)
    {
        this.ws = ws;
    }

    UpdateRanks(ranks)
    {
        this.ranks = ranks;
    }

    UpdateLocale(locale)
    {
        this.locale = locale;
    }

    // Commandline Commands Handlers

    CommandHelp()
    {
        console.log(`---------------------------------------
info                         ${text(this.locale.commands_description_info)}
debug on/off                 ${text(this.locale.commands_description_debug)}
player idOrName              ${text(this.locale.commands_description_player)}
players                      ${text(this.locale.commands_description_players)}
queued                       ${text(this.locale.commands_description_queued)}
all                          ${text(this.locale.commands_description_all)}
drop idOrName "reason"       ${text(this.locale.commands_description_drop)}
forcedrop idOrName "reason"  ${text(this.locale.commands_description_forcedrop)}
ranks                        ${text(this.locale.commands_description_ranks)}
reloadranks                  ${text(this.locale.commands_description_reload_ranks)}
reloadlocale                 ${text(this.locale.commands_description_reload_locale)}
---------------------------------------`);
    }

    CommandInfo()
    {
        console.log("---------------------------------------");
        console.log(text(this.locale.command_info_debug, [this.config.debug]));
        console.log(text(this.locale.command_info_port, [this.config.port]));
        console.log(text(this.locale.command_info_total_ranks, [this.ranks.length]));
        console.log(text(this.locale.command_info_max_players, [this.maxPlayers]));
        console.log(text(this.locale.command_info_online_count, [this.playerCount]));
        console.log(text(this.locale.command_info_queued_count, [this.queuedCount]));
        console.log(text(this.locale.command_info_info_time, [this.lastServerInfoTime]));
        console.log("---------------------------------------");
    }

    CommandDebug(enabled)
    {
        this.config.debug = enabled;
        var string = (enabled) ? text(this.locale.command_debug_enabled) : text(this.locale.command_debug_disabled);
        console.log(text(this.locale.command_debug_toggled, [string]));
    }

    CommandListAll()
    {
        this.CommandListPlayers();
        console.log("");
        this.CommandListQueued();
    }

    CommandListPlayers()
    {
        console.log(`${text(this.locale.general_online_players)}: ${this.playerCount}/${this.maxPlayers}`);
        Object.keys(this.onlineList).forEach((discordid, i) => {
            var rank = this.GetPlayerRank(discordid);
            var displayName = this.DiscordGetDisplayNameById(discordid)
            console.log(`(${rank.name}) @${displayName} [${this.onlineList[discordid].Username}] ${text(this.locale.general_connection_time)} ${this.onlineList[discordid].Time}`);
        });
    }

    CommandListQueued()
    {
        console.log(`${text(this.locale.general_queued_players)}: ${this.queuedCount}`);
        Object.keys(this.queuedList).forEach((discordid, i) => {
            var rank = this.GetPlayerRank(discordid);
            var displayName = this.DiscordGetDisplayNameById(discordid)
            console.log(`(${rank.name}) @${displayName} [${this.queuedList[discordid].Username}] ${text(this.locale.general_priority)} ${this.queuedList[discordid].Priority}`);
        });
    }

    CommandDropId(discordIdOrDisplayName, reason, force = false)
    {
        reason = (reason && reason != "") ? reason : text(this.locale.command_drop_default_reason);

        var discordIdFound = this.DiscordGetUserById(discordIdOrDisplayName).size === 1;
        var discordDisplayNameFound = this.DiscordGetUserByDisplayName(discordIdOrDisplayName).size === 1;
        if (discordIdFound || discordDisplayNameFound)
        {
            var discordId = (!discordIdFound) ? this.DiscordGetIdByDisplayName(discordIdOrDisplayName) : discordIdOrDisplayName;
            var displayName = this.DiscordGetDisplayNameById(discordId);
            var rank = this.GetPlayerRank(discordId);

            if (!this.GetPlayerIsOnline(discordId))
            {
                console.log(text(this.locale.command_drop_cannot_not_online, [displayName]));
            }
            else if (rank.admin)
            {
                console.log(text(this.locale.command_drop_cannot_admin_rank, [displayName]));
            }
            else if (rank.important && !force)
            {
                console.log(text(this.locale.command_drop_cannot_important_rank, [displayName]));
            }
            else
            {
                console.log(text(this.locale.command_drop_success, { discordname: displayName, reason: reason }));
                this.DoRequestPlayerDrop(discordId, reason);
            }
        }
        else console.log(text(this.locale.command_drop_cannot_not_found, [discordIdOrDisplayName]));
    }

    CommandForceDrop(discordIdOrDisplayName, reason)
    {
        this.CommandDropId(discordIdOrDisplayName, reason, true);
    }

    CommandPlayer(discordIdOrDisplayName)
    {
        var discordIdFound = this.DiscordGetUserById(discordIdOrDisplayName).size === 1;
        var discordDisplayNameFound = this.DiscordGetUserByDisplayName(discordIdOrDisplayName).size === 1;
        if (discordIdFound || discordDisplayNameFound)
        {
            var discordId = (!discordIdFound) ? this.DiscordGetIdByDisplayName(discordIdOrDisplayName) : discordIdOrDisplayName;
            var displayName = this.DiscordGetDisplayNameById(discordId);
            var rank = this.GetPlayerRank(discordId);
            var isOnline = this.GetPlayerIsOnline(discordId);
            console.log("---------------------------------------");
            console.log(`Discord ID:   '${discordId}'`);
            console.log(`Display Name: '${displayName}'`);
            console.log(`Rank:         '${rank.name}'`, (rank.admin) ? "[Admin]" : (rank.important) ? "[Important]" : "");
            console.log(`Online:       '${isOnline}'`);
            console.log("---------------------------------------");
        }
        else console.log(text(this.locale.command_player_not_found, [discordIdOrDisplayName]));
    }

    // Discord Methods

    DiscordSendChannelNotification(color = "#fff", text = "", timestamp = true)
    {
        var embed = new Discord.RichEmbed();
        embed.setColor(color).setDescription(text);
        if (timestamp) embed.setTimestamp();
        this.channel.send(embed).catch(console.log);
    }

    DiscordSendChannelValidNotification(text = "")
    {
        this.DiscordSendChannelNotification("#63ff66", text);
    }

    DiscordSendChannelErrorNotification(text = "")
    {
        this.DiscordSendChannelNotification("#ff3d3d", text);
    }

    DiscordSendChannelWarningNotification(text = "")
    {
        this.DiscordSendChannelNotification("#ff913d", text);
    }

    DiscordSendChannelInfoNotification(text = "")
    {
        this.DiscordSendChannelNotification("#3da1ff", text);
    }

    DiscordGetUserById(discordId)
    {
        return this.server.members.filter(user => user.id === discordId);
    }

    DiscordGetUserByDisplayName(displayName)
    {
        return this.server.members.filter(user => user.displayName === displayName);
    }

    DiscordGetDisplayNameById(discordId)
    {
        return this.server.members.filter(user => user.id === discordId).map(user => user.displayName)[0];
    }

    DiscordGetIdByDisplayName(displayName)
    {
        return this.server.members.filter(user => user.displayName === displayName).map(user => user.id)[0];
    }

    DiscordGetUserRoles(discordId)
    {
        return this.DiscordGetUserById(discordId).map(user => user.roles.map(role => role.id))[0] || [];
    }

    DiscordUserHasRole(discordId, roleId)
    {
        return this.DiscordGetUserRoles(discordId).includes(roleId);
    }

    // MISCS

    GetPlayerIsOnline(discordId)
    {
        var isOnline = false;
        Object.keys(this.onlineList).forEach((u, i) => {
            if (u === discordId) {
                isOnline = true;
                return;
            }
        });
        return isOnline;
    }

    GetPlayerRank(discordId)
    {
        for(var i = 0; i < this.ranks.length; i++)
        {
            if (this.DiscordUserHasRole(discordId, this.ranks[i].roleId)) 
            {
                return this.ranks[i];
            }
        }
        return null;
    }

    GetPlayerRankPriority(discordId)
    {
        for(var i = 0; i < this.ranks.length; i++)
        {
            if (this.DiscordUserHasRole(discordId, this.ranks[i].roleId)) 
            {
                return i;
            }
        }
        return this.ranks.length + 1;
    }

    // Server Event Handlers

    HandleOnPlayerConnecting(username, discordId, time)
    {
        var user = this.DiscordGetUserById(discordId);
        var displayName = this.DiscordGetDisplayNameById(discordId);

        // User exist
        if (user.size === 1)
        {
            var rank = this.GetPlayerRank(discordId);
            
            // Has rank to join
            if (rank != null)
            {
				/* test qeue 
				var priority = this.GetPlayerRankPriority(discordId);
				this.DoAddQueue(discordId, username, priority);
				
				this.DiscordSendChannelInfoNotification(text(this.locale.discord_notification_player_added_to_queue, { rank: rank.name, discordname: displayName, gamename: username }));
				
				console.log(time, text(this.locale.discord_notification_player_added_to_queue, { rank: rank.name, discordname: displayName, gamename: username }));
				return;*/

                // Server not full
                if (this.playerCount < this.maxPlayers)
                {
                    this.DoValid(discordId);

                    this.DiscordSendChannelValidNotification(text(this.locale.discord_notification_player_has_joined, { rank: rank.name, discordname: displayName, gamename: username }));
                    
                    console.log(time, text(this.locale.discord_notification_player_has_joined, { rank: rank.name, discordname: displayName, gamename: username }));
                }
                // Server is full
                else 
                {
                    // This rank kick lower
                    if (rank.canKick)
                    {
                        var priority = this.GetPlayerRankPriority(discordId);
                        this.DoAddQueue(discordId, priority);
                        
                        this.DiscordSendChannelInfoNotification(text(this.locale.discord_notification_player_added_to_queue, { rank: rank.name, discordname: displayName, gamename: username }));
                        
                        console.log(time, text(this.locale.discord_notification_player_added_to_queue, { rank: rank.name, discordname: displayName, gamename: username }));
                    }
                    // This rank must wait
                    else
                    {
                        var priority = this.GetPlayerRankPriority(discordId);
                        this.DoAddQueue(discordId, priority);
                        
                        this.DiscordSendChannelInfoNotification(text(this.locale.discord_notification_player_added_to_queue, { rank: rank.name, discordname: displayName, gamename: username }));
                        
                        console.log(time, text(this.locale.discord_notification_player_added_to_queue, { rank: rank.name, discordname: displayName, gamename: username }));
                    }
                }
            }
            // Doesn't have rank to join
            else
            {
                this.DoInvalid(discordId, text(this.locale.popup_player_invalid_rank_to_join));
                
                this.DiscordSendChannelValidNotification(text(this.locale.discord_notification_player_invalid_rank_to_join, { discordname: displayName, gamename: username }));
                
                console.log(time, text(this.locale.discord_notification_player_invalid_rank_to_join, { discordname: displayName, gamename: username }));
            }
        }
        // User doesn't exist
        else
        {
            this.DoInvalid(discordId, text(this.locale.popup_player_not_member_of_discord_server));
            
            this.DiscordSendChannelValidNotification(text(this.locale.discord_notification_player_not_member_of_discord_server, { gamename: username }));
            
            console.log(time, text(this.locale.discord_notification_player_not_member_of_discord_server, { gamename: username }));
        }
    }

    HandleOnAuthenticationTimeOut(username, discordId, time)
    {
        var displayName = this.DiscordGetDisplayNameById(discordId);
        console.log(time, text(this.locale.event_log_authentication_timed_out, { discordname: displayName, gamename: username }));
    }

    HandleOnAuthenticationQueuedCompleted(username, discordId, time)
    {
        var rank = this.GetPlayerRank(discordId);
        var displayName = this.DiscordGetDisplayNameById(discordId);
        
        this.DiscordSendChannelValidNotification(text(this.locale.discord_notification_player_joined_after_queue, { rank: rank.name, discordname: displayName, gamename: username }));
        
        console.log(time, text(this.locale.discord_notification_player_joined_after_queue, { rank: rank.name, discordname: displayName, gamename: username }));
    }

    HandleOnPlayerJoining(username, discordId, time)
    {
        var displayName = this.DiscordGetDisplayNameById(discordId);
        
        console.log(time, text(this.locale.event_log_player_joined_completed, { discordname: displayName, gamename: username }));
    }

    HandleOnPlayerDropped(username, discordId, reason, time)
    {
        var rank = this.GetPlayerRank(discordId);
        var displayName = this.DiscordGetDisplayNameById(discordId);
        
        this.DiscordSendChannelWarningNotification(text(this.locale.discord_notification_player_left_game, { rank: rank.name, discordname: displayName, gamename: username }));
        
        console.log(time, text(this.locale.discord_notification_player_left_game, { rank: rank.name, discordname: displayName, gamename: username }));
    }

    HandleGetServerInfo(maxPlayers, playerCount, onlineList, queuedCount, queuedList, time)
    {
        this.maxPlayers = maxPlayers;
        this.playerCount = playerCount;
        this.onlineList = onlineList;
        this.queuedCount = queuedCount;
        this.queuedList = queuedList;
        this.lastServerInfoTime = time;
    }

    // Server Action Methods

    DoValid(discordId)
    {
        var data = {};
        data.action = "valid";
        data.discordId = discordId;
        this.ws.send(JSON.stringify(data));
    }

    DoInvalid(discordId, reason)
    {
        var data = {};
        data.action = "invalid";
        data.discordId = discordId;
        data.reason = reason;
        this.ws.send(JSON.stringify(data));
    }

    DoAddQueue(discordId, username, priority)
    {
        var data = {};
        data.action = "addQueue";
        data.discordId = discordId;
        data.username = username;
        data.priority = priority;
        this.ws.send(JSON.stringify(data));
    }

    DoUpdateQueue(discordId, priority)
    {
        var data = {};
        data.action = "updateQueue";
        data.discordId = discordId;
        data.priority = priority;
        this.ws.send(JSON.stringify(data));
    }

    DoRemoveQueue(discordId)
    {
        var data = {};
        data.action = "removeQueue";
        data.discordId = discordId;
        this.ws.send(JSON.stringify(data));
    }

    DoRequestPlayerDrop(discordId, reason)
    {
        var data = {};
        data.action = "requestPlayerDrop";
        data.discordId = discordId;
        data.reason = reason;
        this.ws.send(JSON.stringify(data));

        var displayName = this.DiscordGetDisplayNameById(discordId);
        this.DiscordSendChannelErrorNotification(text(this.locale.discord_notification_player_dropped_on_command, { discordname: displayName, reason: reason }));
    }

    DoRequestServerInfo()
    {
        var data = {};
        data.action = "requestServerInfo";
        this.ws.send(JSON.stringify(data));
    }
}

module.exports = API;