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

        bool updatingQueue = false; // The queue is being updated
        DateTime lastQueuedPlayerJoiningTime; // The time a queued slot freed
        Dictionary<long, string> queueProcess; // storing each auth process

        int maxPlayers;

        List<string> validAuthResponses;
        Dictionary<string, string> invalidAuthResponses;

        Dictionary<string, OnlinePlayerInfo> onlinePlayers;
        Dictionary<string, QueuePlayerInfo> queuedPlayers;

        public DiscordAuthSocket()
        {
            lastQueuedPlayerJoiningTime = DateTime.Now;
            queueProcess = new Dictionary<long, string>();

            validAuthResponses = new List<string>();
            invalidAuthResponses = new Dictionary<string, string>();
            onlinePlayers = new Dictionary<string, OnlinePlayerInfo>();
            queuedPlayers = new Dictionary<string, QueuePlayerInfo>();
        }

        protected override void OnOpen()
        {
            if (socket != null) return;
            Debug.WriteLine("DiscordAuthSocket connection opened!");
            socket = this;

            // Get max players
            maxPlayers = API.GetConvarInt("sv_maxclients", 32);

            // Add currently connected player
            onlinePlayers.Clear();
            foreach (Player player in server.GetPlayers())
            {
                onlinePlayers.Add(player.Identifiers["discord"], new OnlinePlayerInfo(player.Name));
            }

            // Inform node
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
                validAuthResponses.Add(discordId);
            }

            else if (action == "invalid")
            {
                invalidAuthResponses.Add(discordId, Data.reason);
            }

            else if (action == "addQueue")
            {
                if (!queuedPlayers.ContainsKey(discordId))
                    queuedPlayers.Add(discordId, new QueuePlayerInfo(username, Data.priority));
            }

            else if (action == "updateQueue")
            {
                if (queuedPlayers.ContainsKey(discordId))
                    queuedPlayers[discordId].Priority = Data.priority;
            }

            else if (action == "removeQueue")
            {
                if (queuedPlayers.ContainsKey(discordId))
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
            while (!validAuthResponses.Contains(discordId) && !invalidAuthResponses.ContainsKey(discordId) && !queuedPlayers.ContainsKey(discordId))
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
            if (validAuthResponses.Contains(discordId))
            {
                message = ""; // no message = valid
                validAuthResponses.Remove(discordId);
                Debug.WriteLine($"{now.ToShortTimeString()} [AUTH] DiscordAuthSocket: {username} authentication success!");
            }

            // Invalid Authentication
            else if (invalidAuthResponses.ContainsKey(discordId))
            {
                message = invalidAuthResponses[discordId];
                invalidAuthResponses.Remove(discordId);
                Debug.WriteLine($"{now.ToShortTimeString()} [AUTH] DiscordAuthSocket: {username} authentication failed!\nReason: {message}");
            }

            // Queued Authentication
            else if (queuedPlayers.ContainsKey(discordId))
            {
                // Handle multiple attempts
                bool canceled = false;
                long processId = DateTime.Now.Ticks;

                // Verify if there isa already a queue process for this user
                if (queueProcess.ContainsValue(discordId))
                {
                    Dictionary<long, string> temp = new Dictionary<long, string>(queueProcess);
                    foreach (KeyValuePair<long, string> pair in temp)
                    {
                        if (pair.Value == discordId)
                        {
                            Debug.WriteLine($"Canceling a previous queue process {pair.Key} for {pair.Value}");
                            queueProcess.Remove(pair.Key);
                            break;
                        }
                    }
                    temp = null;
                }
                queueProcess.Add(processId, discordId);
                Debug.WriteLine($"Starting a queue process {processId} for {discordId}");
                
                SendServerInfo();

                // Start this queue process
                Debug.WriteLine($"{now.ToShortTimeString()} [AUTH] DiscordAuthSocket: {username} authentication queued [{queuedPlayers[discordId].Priority}/{queuedPlayers.Count}]");
                while (!canceled && queuedPlayers.ContainsKey(discordId))
                {
                    // Check if this current process has been removed by a new process
                    if (!queueProcess.ContainsKey(processId))
                    {
                        canceled = true;
                        break;
                    }

                    await UpdateQueue(); // Update the queue

                    // If we still in queue update popup message
                    if (queuedPlayers.ContainsKey(discordId))
                    {
                        deferrals.update($"Waiting for a player to leave... [Priority: {queuedPlayers[discordId].Priority} | Total queued: {queuedPlayers.Count}]...");
                    }

                    await Server.Delay(1000);
                }

                // If this process loop completed and it wasnt canceled then this player can join
                if (!canceled)
                {
                    SocketMessage queuedCompletedMessage = new SocketMessage();
                    queuedCompletedMessage.action = "OnAuthenticationQueuedCompleted";
                    queuedCompletedMessage.username = username;
                    queuedCompletedMessage.discordId = discordId;
                    queuedCompletedMessage.time = now;
                    if (isOpen) Send(queuedCompletedMessage.ToJson());

                    Debug.WriteLine($"{now.ToShortTimeString()} [AUTH] DiscordAuthSocket: {username} authentication completed!");
                }
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
            Player player = server.GetPlayerByIdentifier("discord", discordId);
            if (player != null)
            {
                player.Drop(reason);
            }
        }

        internal async Task UpdateQueue()
        {
            await Server.Delay(0);

            // test
            //return;

            if (updatingQueue) return; // Skip if already being updated
            if (DateTime.Now.Subtract(lastQueuedPlayerJoiningTime).TotalSeconds < 5) return; // Wait till current joining player is in.

            updatingQueue = true;

            // There is room for a queued player to join
            if (API.GetNumPlayerIndices() < maxPlayers)
            {
                // There is at least one queued player
                if (queuedPlayers.Count > 0)
                {
                    string nextUnqueued = "";
                    int lastPriority = 999999999; // start high, lowest priority number is best priority

                    try
                    {
                        // Loop in order of first queued
                        foreach (KeyValuePair<string, QueuePlayerInfo> pair in queuedPlayers)
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

                        if (nextUnqueued != "")
                        {
                            lastQueuedPlayerJoiningTime = DateTime.Now;
                            queuedPlayers.Remove(nextUnqueued);
                        }
                    }
                    catch(Exception exception)
                    {
                        Debug.WriteLine($"EXCEPTION IN UPDATE QUEUE:\n{exception.Message}\n{exception.StackTrace}");
                    }
                }
            }

            updatingQueue = false;
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
