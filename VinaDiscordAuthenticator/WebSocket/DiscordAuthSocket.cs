using CitizenFX.Core;
using System.Collections.Generic;
using System.Threading.Tasks;

using WebSocketSharp;
using WebSocketSharp.Server;

namespace VinaDiscordAuthenticator.WebSocket
{
    public class DiscordAuthSocket : WebSocketBehavior
    {
        private static DiscordAuthSocket Instance;
        private Dictionary<string, bool> AuthResults = new Dictionary<string, bool>();

        public DiscordAuthSocket()
        {
            
        }

        protected override void OnOpen()
        {
            if (Instance == null)
            {
                Instance = this;
                Debug.WriteLine($"VinaDiscordAuthenticator: {ID} connected!");
            }
        }

        protected override void OnMessage(MessageEventArgs e)
        {
            if (e.Data.Contains(":"))
            {
                string[] response = e.Data.Split(':');
                if (response.Length == 3)
                {
                    switch (response[0])
                    {
                        case "auth":
                            bool valid = (response[1] == "valid");
                            string discordId = response[2];

                            if (!AuthResults.ContainsKey(discordId))
                            {
                                AuthResults.Add(discordId, valid);
                            }
                            else
                            {
                                AuthResults[discordId] = valid;
                            }
                            break;
                    }
                }
            }
        }

        protected override void OnClose(CloseEventArgs e)
        {
            if (Instance != null)
            {
                Instance = null;
                Debug.WriteLine($"VinaDiscordAuthenticator: {ID} disconnected!");
            }
        }

        protected override void OnError(ErrorEventArgs e)
        {
            Debug.WriteLine($"VinaDiscordAuthenticator: Error -> {e.Message}");
        }

        public static async Task<bool> Authenticate(string discordId)
        {
            while (Instance == null)
            {
                await Server.Delay(0);
            }

            Instance.Send($"auth:{discordId}");

            while (!Instance.AuthResults.ContainsKey(discordId))
            {
                await Server.Delay(0);
            }

            bool valid = Instance.AuthResults[discordId];
            Instance.AuthResults.Remove(discordId);

            return valid;
        }
    }
}
