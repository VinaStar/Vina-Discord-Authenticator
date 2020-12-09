using CitizenFX.Core;
using System;

using static CitizenFX.Core.Native.API;
using VinaDiscordAuthenticator.WebSocket;

namespace VinaDiscordAuthenticator
{
    public class Server : BaseScript
    {
        public static Server Instance;
        private string ResourceName;

        public Server()
        {
            ResourceName = GetCurrentResourceName();

            if (Instance == null)
            {
                Instance = this;

                EventHandlers["onResourceStop"] += new Action<string>(OnResourceStop);
                EventHandlers["playerConnecting"] += new Action<Player, string, dynamic, dynamic>(OnPlayerConnecting);
                EventHandlers["playerDropped"] += new Action<Player, string>(OnPlayerDropped);

                SocketManager.Start(GetConvarInt("vina_discord_auth_port", 8085));
            }
        }

        public PlayerList GetPlayers()
        {
            return Players;
        }

        private void OnResourceStop(string resourceName)
        {
            if (ResourceName != resourceName) return;

            SocketManager.Stop();
        }

        private async void OnPlayerConnecting([FromSource] Player player, string playerName, dynamic setKickReason, dynamic deferrals)
        {
            deferrals.defer();

            await Delay(0);

            string discordId = player.Identifiers["discord"];
            AuthResult result = await DiscordAuthSocket.Authenticate(deferrals, discordId);
            if (result.Valid)
            {
                Debug.WriteLine($"VinaDiscordAuthenticator: Player {playerName}({discordId}) authenticated successfully!");
                deferrals.done();
            }
            else
            {
                Debug.WriteLine($"VinaDiscordAuthenticator: Player {playerName}({discordId}) authentication failed! -> Reason: {result.Reason}");
                deferrals.done(result.Reason);

                return;
            }
        }

        private void OnPlayerDropped([FromSource] Player player, string reason)
        {
            DiscordAuthSocket.PlayerDropped(player, reason);
        }
    }
}
