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
    - DiscordSendChannelJoinNotification
    - DiscordSendChannelKickNotification
    - DiscordSendChannelDropNotification
    - DiscordSendChannelQueuedNotification
    - DiscordGetUserById
    - DiscordGetDisplayNameById
    - DiscordGetIdByDisplayName
    - DiscordGetUserRoles
    - DiscordUserHasRole

    Miscs Methods:
    - GetPlayerIsOnline
    - GetPlayerRank
    - GetPlayerRankPriority
    - GetLowestRankPriorityOnlinePlayer

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
player discordId             ${text(this.locale.commands_description_player)}
players                      ${text(this.locale.commands_description_players)}
queued                       ${text(this.locale.commands_description_queued)}
all                          ${text(this.locale.commands_description_all)}
drop discordId "reason"      ${text(this.locale.commands_description_drop)}
forcedrop discordId "reason" ${text(this.locale.commands_description_forcedrop)}
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
        console.log("---------------------------------------");
        console.log(`${text(this.locale.general_online_players)}: ${this.playerCount}/${this.maxPlayers}`);
        Object.keys(this.onlineList).forEach((discordId, i) => {
            console.log(`${discordId} [${this.onlineList[discordId].Username}] ${text(this.locale.general_connection_time)} ${this.onlineList[discordId].Time}`);
        });
    }

    CommandListQueued()
    {
        console.log("---------------------------------------");
        console.log(`${text(this.locale.general_queued_players)}: ${this.queuedCount}`);
        Object.keys(this.queuedList).forEach((discordId, i) => {
            console.log(`${discordId} [${this.queuedList[discordId].Username}] ${text(this.locale.general_priority)} ${this.queuedList[discordId].Priority}`);
        });
    }

    CommandDropId(discordId, reason, force = false)
    {
        reason = (reason && reason != "") ? reason : text(this.locale.command_drop_default_reason);

        this.DiscordGetUserById(discordId)
        .then(user => {
            return this.GetPlayerRank(rank => {
                var isOnline = this.GetPlayerIsOnline(discordId);
                if (!isOnline)
                {
                    console.log(text(this.locale.command_drop_cannot_not_online, [user.displayName]));
                }
                else if (rank.admin)
                {
                    console.log(text(this.locale.command_drop_cannot_admin_rank, [user.displayName]));
                }
                else if (rank.important && !force)
                {
                    console.log(text(this.locale.command_drop_cannot_important_rank, [user.displayName]));
                }
                else
                {
                    console.log(text(this.locale.command_drop_success, { discordname: user.displayName, reason: reason }));
                    this.DoRequestPlayerDrop(discordId, reason);
                }
            });
        })
        .catch(() => {
            console.log(text(this.locale.command_drop_cannot_not_found, [discordId]));
        });
    }

    CommandForceDrop(discordId, reason)
    {
        this.CommandDropId(discordId, reason, true);
    }

    CommandPlayer(discordId)
    {
        this.DiscordGetUserById(discordId)
        .then(user => {
            return this.GetPlayerRank(rank => {
                var isOnline = this.GetPlayerIsOnline(discordId);
                console.log("---------------------------------------");
                console.log(`Discord ID:   '${discordId}'`);
                console.log(`Display Name: '${user.displayName}'`);
                console.log(`Rank:         '${rank.name}'`, (rank.admin) ? "[Admin]" : (rank.important) ? "[Important]" : "");
                console.log(`Online:       '${isOnline}'`);
                console.log("---------------------------------------");
            });
        })
        .catch(() => {
            console.log(text(this.locale.command_player_not_found, [discordId]));
        });
    }

    // Discord Methods

    DiscordSendChannelNotification(color = "#fff", text = "", timestamp = true)
    {
        var embed = new Discord.RichEmbed();
        embed.setColor(color).setDescription(text);
        if (timestamp) embed.setTimestamp();
        this.channel.send(embed).catch(console.log);
    }

    DiscordSendChannelJoinNotification(text = "")
    {
        if (this.config.send_join_notification === true)
            this.DiscordSendChannelNotification(this.config.notification_join_color, text);
    }

    DiscordSendChannelKickNotification(text = "")
    {
        if (this.config.send_kick_notification === true)
            this.DiscordSendChannelNotification(this.config.notification_kick_color, text);
    }

    DiscordSendChannelDropNotification(text = "")
    {
        if (this.config.send_drop_notification === true)
            this.DiscordSendChannelNotification(this.config.notification_drop_color, text);
    }

    DiscordSendChannelQueuedNotification(text = "")
    {
        if (this.config.send_queued_notification === true)
            this.DiscordSendChannelNotification(this.config.notification_queued_color, text);
    }

    DiscordGetUserById(discordId)
    {
		return this.server.fetchMember(discordId).catch(console.log);
    }

    DiscordGetDisplayNameById(discordId)
    {
        return this.DiscordGetUserById(discordId)
            .then(user => user.displayName)
            .catch(console.log);
    }

    DiscordGetUserRoles(discordId)
    {
        return this.DiscordGetUserById(discordId)
            .then(user => {
                return user.roles.map(role => role.id);
            })
            .catch(console.log);
    }

    DiscordUserHasRole(discordId, roleId)
    {
        return this.DiscordGetUserRoles(discordId)
            .then(roles => {
                return roles.includes(roleId);
            })
            .catch(console.log);
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
        return this.DiscordGetUserRoles(discordId)
            .then(roles => {
                for(var i = 0; i < this.ranks.length; i++)
                {
                    if (roles.includes(this.ranks[i].roleId))
                    {
                        return this.ranks[i];
                    }
                }
                return null;
            })
            .catch(console.log);
    }

    GetPlayerRankPriority(discordId)
    {
        return this.DiscordGetUserRoles(discordId)
            .then(roles => {
                for(var i = 0; i < this.ranks.length; i++)
                {
                    if (roles.includes(this.ranks[i].roleId))
                    {
                        return i;
                    }
                }
                return this.ranks.length + 1;
            })
            .catch(console.log);
    }

    GetLowestRankPriorityOnlinePlayer()
    {
        // Get the player to be kicked with the lowest ranks possible ordered by last joined.
    }

    // Server Event Handlers

    HandleOnPlayerConnecting(username, discordId, time)
    {
        this.DiscordGetUserById(discordId)
        // Found
        .then(user => {
            
            return this.GetPlayerRank(discordId)
            // has a rank
            .then(rank => {

                // Server not full
                if (this.playerCount < this.maxPlayers)
                {
                    this.DoValid(discordId);

                    this.DiscordSendChannelJoinNotification(text(this.locale.discord_notification_player_has_joined, { rank: rank.name, discordname: user.displayName, gamename: username }));
                    
                    console.log(time, text(this.locale.discord_notification_player_has_joined, { rank: rank.name, discordname: user.displayName, gamename: username }));
                }
                // Server is full
                else 
                {
                    // get priority
                    this.GetPlayerRankPriority(discordId)
                    .then(priority => {
                        // This rank kick lower (for now it just add to queue)
                        if (rank.admin)
                        {
                            this.DoAddQueue(discordId, priority);
                            
                            this.DiscordSendChannelQueuedNotification(text(this.locale.discord_notification_player_added_to_queue, { rank: rank.name, discordname: user.displayName, gamename: username }));
                            
                            console.log(time, text(this.locale.discord_notification_player_added_to_queue, { rank: rank.name, discordname: user.displayName, gamename: username }));
                        }
                        // This rank must wait
                        else
                        {
                            this.DoAddQueue(discordId, priority);
                            
                            this.DiscordSendChannelQueuedNotification(text(this.locale.discord_notification_player_added_to_queue, { rank: rank.name, discordname: user.displayName, gamename: username }));
                            
                            console.log(time, text(this.locale.discord_notification_player_added_to_queue, { rank: rank.name, discordname: user.displayName, gamename: username }));
                        }
                    })
                    .catch(console.log);
                }

            })
            // doesnt have a rank
            .catch(() => {

                this.DoInvalid(discordId, text(this.locale.popup_player_invalid_rank_to_join));
        
                this.DiscordSendChannelJoinNotification(text(this.locale.discord_notification_player_invalid_rank_to_join, { discordname: user.displayName, gamename: username }));
                
                console.log(time, text(this.locale.discord_notification_player_invalid_rank_to_join, { discordname: user.displayName, gamename: username }));

            });

        })
        // Not found
        .catch(() => {

            this.DoInvalid(discordId, text(this.locale.popup_player_not_member_of_discord_server));
        
            this.DiscordSendChannelJoinNotification(text(this.locale.discord_notification_player_not_member_of_discord_server, { gamename: username }));
            
            console.log(time, text(this.locale.discord_notification_player_not_member_of_discord_server, { gamename: username }));

        });
    }

    HandleOnAuthenticationTimeOut(username, discordId, time)
    {
        this.DiscordGetUserById(discordId)
        .then(user => {
            console.log(time, text(this.locale.event_log_authentication_timed_out, { discordname: user.displayName, gamename: username }));
        })
        .catch(console.log);
    }

    HandleOnAuthenticationQueuedCompleted(username, discordId, time)
    {
        this.DiscordGetUserById(discordId)
        .then(user => {
            return this.GetPlayerRank(discordId)
            .then(rank => {
                this.DiscordSendChannelJoinNotification(text(this.locale.discord_notification_player_joined_after_queue, { rank: rank.name, discordname: user.displayName, gamename: username }));
                
                console.log(time, text(this.locale.discord_notification_player_joined_after_queue, { rank: rank.name, discordname: user.displayName, gamename: username }));
            });
        })
        .catch(console.log);
    }

    HandleOnPlayerJoining(username, discordId, time)
    {
        this.DiscordGetUserById(discordId)
        .then(user => {
            console.log(time, text(this.locale.event_log_player_joined_completed, { discordname: user.displayName, gamename: username }));
        })
        .catch(console.log);
    }

    HandleOnPlayerDropped(username, discordId, reason, time)
    {
        this.DiscordGetUserById(discordId)
        .then(user => {
            return this.GetPlayerRank(discordId)
            .then(rank => {
                this.DiscordSendChannelDropNotification(text(this.locale.discord_notification_player_left_game, { rank: rank.name, discordname: user.displayName, gamename: username }));
        
                console.log(time, text(this.locale.discord_notification_player_left_game, { rank: rank.name, discordname: user.displayName, gamename: username }));
            });
        })
        .catch(console.log);
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

        this.DiscordGetUserById(discordId)
        .then(user => {
            this.DiscordSendChannelKickNotification(text(this.locale.discord_notification_player_dropped_on_command, { discordname: user.displayName, reason: reason }));
        })
        .catch(console.log);
    }

    DoRequestServerInfo()
    {
        var data = {};
        data.action = "requestServerInfo";
        this.ws.send(JSON.stringify(data));
    }
}

module.exports = API;