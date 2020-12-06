using CitizenFX.Core;
using System;

using static CitizenFX.Core.Native.API;
using VinaDiscordAuthenticator.WebSocket;

namespace VinaDiscordAuthenticator
{
    public class Server : BaseScript
    {
        private string ResourceName;

        public Server()
        {
            ResourceName = GetCurrentResourceName();

            EventHandlers["onResourceStop"] += new Action<string>(OnResourceStop);
            EventHandlers["playerConnecting"] += new Action<Player, string, dynamic, dynamic>(OnPlayerConnecting);

            SocketManager.Start(GetConvarInt("vina_discord_auth_port", 8085));
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
            bool authenticated = discordId != "" && await DiscordAuthSocket.Authenticate(discordId);
            if (authenticated)
            {
                Debug.WriteLine($"VinaDiscordAuthenticator: Player {playerName} authenticated with Discord successfully!");
            }
            else
            {
                if (discordId == "")
                {
                    Debug.WriteLine($"VinaDiscordAuthenticator: Player {playerName} did not authenticate with Discord!");
                    deferrals.done(GetConvar("vina_discord_auth_drop_notbinded_message", "You must bind your Discord account in FiveM settings to join this server."));
                }
                else
                {
                    Debug.WriteLine($"VinaDiscordAuthenticator: Player {playerName} did not authenticate with Discord!");
                    deferrals.done(GetConvar("vina_discord_auth_drop_notmember_message", "You must be a member of our Discord channel to join this server."));
                }

                return;
            }

            deferrals.done();
        }
    }
}
