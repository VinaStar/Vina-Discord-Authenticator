using System;
using System.Collections.Generic;
using System.Threading.Tasks;

using WebSocketSharp;
using WebSocketSharp.Server;

using CitizenFX.Core;
using CitizenFX.Core.Native;

namespace VinaDiscordAuthenticator.WebSocket
{
    public class AuthResult
    {
        public bool Valid { get; set; }
        public bool Queued { get; private set; }
        public string Reason { get; private set; }
        public DateTime Time { get; private set; }

        public AuthResult(bool valid, bool queued, string reason)
        {
            Valid = valid;
            Queued = queued;
            Reason = reason;
            Time = DateTime.Now;
        }
    }

    public class DiscordAuthSocket : WebSocketBehavior
    {
        private static DiscordAuthSocket SingleInstance;
        private Dictionary<string, AuthResult> AuthResults = new Dictionary<string, AuthResult>();
        private string CurrentInQueue = "";
        private bool Stopped = false;

        public DiscordAuthSocket()
        {
            
        }

        protected override void OnOpen()
        {
            if (SingleInstance == null)
            {
                SingleInstance = this;
                Debug.WriteLine($"VinaDiscordAuthenticator: {ID} connected!");
            }
        }

        protected override void OnMessage(MessageEventArgs e)
        {
            if (e.Data.Contains(":"))
            {
                string[] response = e.Data.Split(':');

                if (response.Length == 1)
                {
                    int playerCount = API.GetNumPlayerIndices();

                    if (response[0] == "count")
                    {
                        this.Send($"count:{playerCount}");
                        return;
                    }

                    else if (response[0] == "list")
                    {
                        string list = "[";
                        int i = 0;
                        foreach (Player player in Server.Instance.GetPlayers())
                        {
                            list += $"\"{player.Identifiers["discord"]}\"";
                            if (i < playerCount - 1) list += ",";
                            i++;
                        }
                        list += "]";
                        this.Send($"list:{list}");
                    }
                }

                else if (response.Length == 3)
                {
                    // Drop a player
                    // drop:discordId:reason
                    if (response[0] == "drop")
                    {
                        string discordId = response[1];
                        string reason = response[2];

                        Player player = GetPlayerByDiscordId(discordId);
                        if (player != null)
                        {
                            Debug.WriteLine($"VinaDiscordAuthenticator: Dropping player {player.Name}({discordId})! -> Reason: {reason}");
                            player.Drop(reason);
                            return;
                        }
                    }
                    // Update Queue
                    else if (response[0] == "queue")
                    {
                        string discordId = response[2];
                        CurrentInQueue = discordId;
                    }
                }

                else if (response.Length == 4)
                {
                    // Auth a player
                    // auth:valid|invalid:discordId:reason
                    if (response[0] == "auth")
                    {
                        bool valid = (response[1] == "valid");
                        bool queued = (response[1] == "queued");
                        string discordId = response[2];
                        string reason = response[3];

                        if (!AuthResults.ContainsKey(discordId))
                        {
                            AuthResults.Add(discordId, new AuthResult(valid, queued, reason));
                            return;
                        }
                    }
                }
            }

            Debug.WriteLine($"VinaDiscordAuthenticator: Received unknown response {e.Data}");
        }

        protected override void OnClose(CloseEventArgs e)
        {
            if (SingleInstance != null)
            {
                SingleInstance = null;
                Debug.WriteLine($"VinaDiscordAuthenticator: {ID} disconnected!");
            }
        }

        protected override void OnError(ErrorEventArgs e)
        {
            //Debug.WriteLine($"VinaDiscordAuthenticator: Error -> {e.Message}\n{e.Exception.StackTrace}");
        }

        public static Player GetPlayerByDiscordId(string discordId)
        {
            if (Server.Instance != null)
            {
                foreach(Player player in Server.Instance.GetPlayers())
                {
                    if (player.Identifiers["discord"] == discordId)
                    {
                        return player;
                    }
                }
            }

            return null;
        }

        public static async Task<AuthResult> Authenticate(dynamic deferrals, string discordId)
        {
            bool expired = false;
            DateTime responseStart = DateTime.Now;


            // Await for server connection
            deferrals.update("Connecting to authentication server...");
            while (!expired && SingleInstance == null)
            {
                await Server.Delay(100);
                expired = (DateTime.Now.Subtract(responseStart).TotalSeconds > 5);
            }

            if (expired)
            {
                return new AuthResult(false, false, "Authentication server is down, please try again in a few minutes!");
            }

            try
            {
                SingleInstance.Send($"auth:{discordId}");
            }
            catch (Exception ex)
            {

            }


            // Await for node response or expired
            AuthResult result;
            responseStart = DateTime.Now;
            deferrals.update("Authenticating...");
            while (!expired && !SingleInstance.AuthResults.ContainsKey(discordId))
            {
                await Server.Delay(100);
                expired = (DateTime.Now.Subtract(responseStart).TotalSeconds > 5);
            }

            if (expired)
            {
                result = new AuthResult(false, false, "Authentication request expired, please try again!");
            }
            else
            {
                // Get and remove result
                result = SingleInstance.AuthResults[discordId];

                if (result.Queued)
                {
                    bool test = false;
                    while (SingleInstance.CurrentInQueue != discordId)
                    {
                        deferrals.update($"Waiting in queue...");
                        await Server.Delay(1000);

                        if (!test)
                        {
                            await Server.Delay(10000);
                            test = true;
                            try
                            {
                                SingleInstance.Send($"dropped:646907767466229762");
                            }
                            catch(Exception ex)
                            {

                            }
                        }
                    }
                    result.Valid = true;
                }

                SingleInstance.AuthResults.Remove(discordId);
            }

            return result;
        }

        public static void PlayerDropped(Player player, string reason)
        {
            try
            {
                SingleInstance.Send($"dropped:{player.Identifiers["discord"]}");
            }
            catch(Exception ex)
            {

            }
        }
    }
}
