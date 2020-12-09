using System;
using System.Threading.Tasks;
using System.Collections.Generic;

using WebSocketSharp;
using WebSocketSharp.Server;

using CitizenFX.Core;
using CitizenFX.Core.Native;

using VinaFrameworkServer.Core;

namespace Vina_DiscordAuth2.WebSocket
{
    public class DiscordAuthSocket : WebSocketBehavior
    {
        internal static DiscordAuthSocket socket;
        internal static BaseServer server;

        bool isOpen
        {
            get
            {
                return this.State == WebSocketState.Open;
            }
        }

        int maxPlayers;
        List<string> validAuths;
        Dictionary<string, string> invalidAuths;
        Dictionary<string, OnlinePlayerInfo> onlinePlayers;
        Dictionary<string, QueuePlayerInfo> queuedPlayers;

        public DiscordAuthSocket()
        {
            validAuths = new List<string>();
            invalidAuths = new Dictionary<string, string>();
            onlinePlayers = new Dictionary<string, OnlinePlayerInfo>();
            queuedPlayers = new Dictionary<string, QueuePlayerInfo>();
        }

        protected override void OnOpen()
        {
            if (socket != null) return;

            maxPlayers = API.GetConvarInt("sv_maxclients", 32);

            Debug.WriteLine("DiscordAuthSocket connection opened!");
            socket = this;

            foreach(Player player in server.GetPlayers())
            {
                onlinePlayers.Add(player.Identifiers["discord"], new OnlinePlayerInfo(player.Name));
            }

            SendServerInfo();
        }

        protected override void OnMessage(MessageEventArgs e)
        {
            SocketMessage Data = SocketMessage.FromJson(e.Data);
            string action = Data.action;
            string username = Data.username;
            string discordId = Data.discordId;

            if (action == "valid")
            {
                validAuths.Add(discordId);
            }

            else if (action == "invalid")
            {
                invalidAuths.Add(discordId, Data.reason);
            }

            else if (action == "addQueue")
            {
                queuedPlayers.Add(discordId, new QueuePlayerInfo(username, Data.priority));
            }

            else if (action == "updateQueue")
            {
                queuedPlayers[discordId].Priority = Data.priority;
            }

            else if (action == "removeQueue")
            {
                queuedPlayers.Remove(discordId);
            }

            else if (action == "requestPlayerDrop")
            {
                DropPlayer(discordId, Data.reason);
            }

            else if (action == "requestServerInfo")
            {
                SendServerInfo();
            }
        }

        protected override void OnClose(CloseEventArgs e)
        {
            Debug.WriteLine("DiscordAuthSocket connection closed!");
            socket = null;
        }

        protected override void OnError(ErrorEventArgs e)
        {
            Debug.WriteLine($"[ERROR] DiscordAuthSocket: {e.Message}\n{e.Exception.StackTrace}");
        }

        internal async Task<string> OnPlayerConnecting(Player player, dynamic deferrals)
        {
            DateTime now = DateTime.Now;

            SendServerInfo();
            await Server.Delay(500);

            string message = "";
            string username = player.Name;
            string discordId = player.Identifiers["discord"];

            SocketMessage socketMessage = new SocketMessage();
            socketMessage.action = "OnPlayerConnecting";
            socketMessage.username = username;
            socketMessage.discordId = discordId;
            socketMessage.time = now;
            if (isOpen) Send(socketMessage.ToJson());

            Debug.WriteLine($"{now.ToShortTimeString()} [AUTH] DiscordAuthSocket: {username} authentication starting...");

            // Wait for reply
            while (!validAuths.Contains(discordId) && !invalidAuths.ContainsKey(discordId) && !queuedPlayers.ContainsKey(discordId))
            {
                deferrals.update($"Authentication in progress... [Players: {API.GetNumPlayerIndices()}/{maxPlayers}]");
                await Server.Delay(100);

                if (DateTime.Now > now.AddSeconds(10))
                {
                    Debug.WriteLine($"{now.ToShortTimeString()} [AUTH] DiscordAuthSocket: {username} authentication timed out!");

                    SocketMessage timeoutMessage = new SocketMessage();
                    timeoutMessage.action = "OnAuthenticationTimeOut";
                    timeoutMessage.username = username;
                    timeoutMessage.discordId = discordId;
                    timeoutMessage.time = now;
                    if (isOpen) Send(timeoutMessage.ToJson());

                    deferrals.done("Authentication timed out!");
                    break;
                }
            }

            // Valid Authentication
            if (validAuths.Contains(discordId))
            {
                message = "";
                validAuths.Remove(discordId);
                Debug.WriteLine($"{now.ToShortTimeString()} [AUTH] DiscordAuthSocket: {username} authentication success!");
            }

            // Invalid Authentication
            else if (invalidAuths.ContainsKey(discordId))
            {
                message = invalidAuths[discordId];
                invalidAuths.Remove(discordId);
                Debug.WriteLine($"{now.ToShortTimeString()} [AUTH] DiscordAuthSocket: {username} authentication failed!\nReason: {message}");
            }

            // Queued Authentication
            else if (queuedPlayers.ContainsKey(discordId))
            {
                Debug.WriteLine($"{now.ToShortTimeString()} [AUTH] DiscordAuthSocket: {username} authentication queued [{queuedPlayers[discordId]}/{queuedPlayers.Count}]");
                while (queuedPlayers.ContainsKey(discordId))
                {
                    UpdateQueue();
                    deferrals.update($"Waiting for a player to leave... [Priority: {queuedPlayers[discordId]} | Total queued: {queuedPlayers.Count}]...");
                    await Server.Delay(1000);
                }

                SocketMessage queuedCompletedMessage = new SocketMessage();
                queuedCompletedMessage.action = "OnAuthenticationQueuedCompleted";
                queuedCompletedMessage.username = username;
                queuedCompletedMessage.discordId = discordId;
                queuedCompletedMessage.time = now;
                if (isOpen) Send(queuedCompletedMessage.ToJson());

                Debug.WriteLine($"{now.ToShortTimeString()} [AUTH] DiscordAuthSocket: {username} authentication completed!");
            }

            return message;
        }

        internal void OnPlayerJoining(Player player)
        {
            DateTime now = DateTime.Now;
            string discordId = player.Identifiers["discord"];

            onlinePlayers.Add(discordId, new OnlinePlayerInfo(player.Name));

            SocketMessage socketMessage = new SocketMessage();
            socketMessage.action = "OnPlayerJoining";
            socketMessage.username = player.Name;
            socketMessage.discordId = discordId;
            socketMessage.time = now;
            if (isOpen) Send(socketMessage.ToJson());

            SendServerInfo();

            Debug.WriteLine($"{now.ToShortTimeString()} [AUTH] DiscordAuthSocket: {player.Name} initialized successfully!");
        }

        internal void OnPlayerDropped(Player player, string reason)
        {
            DateTime now = DateTime.Now;
            string discordId = player.Identifiers["discord"];

            onlinePlayers.Remove(discordId);

            SocketMessage socketMessage = new SocketMessage();
            socketMessage.action = "OnPlayerDropped";
            socketMessage.username = player.Name;
            socketMessage.discordId = discordId;
            socketMessage.reason = reason;
            socketMessage.time = now;
            if (isOpen) Send(socketMessage.ToJson());

            SendServerInfo();

            Debug.WriteLine($"{now.ToShortTimeString()} [AUTH] DiscordAuthSocket: {player.Name} left server!");
        }

        internal void DropPlayer(string discordId, string reason)
        {
            foreach (Player player in server.GetPlayers())
            {
                if (player.Identifiers["discord"] == discordId)
                {
                    player.Drop(reason);
                    return;
                }
            }
        }

        internal void UpdateQueue()
        {
            // There is room for a queued player to join
            if (API.GetNumPlayerIndices() < maxPlayers)
            {
                // There is queued players
                if (queuedPlayers.Count > 0)
                {
                    string nextUnqueued = "";
                    int lastPriority = 999999999;

                    // Loop in order of first queued
                    foreach(KeyValuePair<string, QueuePlayerInfo> pair in queuedPlayers)
                    {
                        string discordId = pair.Key;
                        QueuePlayerInfo queuedInfo = pair.Value;

                        // If this player priority is better
                        if (queuedInfo.Priority < lastPriority)
                        {
                            nextUnqueued = discordId;
                        }

                        lastPriority = queuedInfo.Priority;
                    }

                    queuedPlayers.Remove(nextUnqueued);
                }
            }
        }

        internal void SendServerInfo()
        {
            SocketMessage socketMessage = new SocketMessage();
            socketMessage.action = "GetServerInfo";
            socketMessage.maxPlayers = maxPlayers;
            socketMessage.playerCount = API.GetNumPlayerIndices();
            socketMessage.onlineList = onlinePlayers;
            socketMessage.queuedCount = queuedPlayers.Count;
            socketMessage.queuedList = queuedPlayers;
            socketMessage.time = DateTime.Now;
            if (isOpen) Send(socketMessage.ToJson());
        }
    }
}
