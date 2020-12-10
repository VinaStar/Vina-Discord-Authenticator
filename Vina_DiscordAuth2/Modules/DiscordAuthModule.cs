using System;

using CitizenFX.Core;
using CitizenFX.Core.Native;

using WebSocketSharp.Server;

using VinaFrameworkServer.Core;
using Vina_DiscordAuth2.WebSocket;

namespace Vina_DiscordAuth2.Modules
{
    public class DiscordAuthModule : Module
    {
        public DiscordAuthModule(Server server) : base(server)
        {
            DiscordAuthSocket.server = server;

            socket = new WebSocketServer(API.GetConvarInt("vina_discord_auth_port", 8085));

            script.AddEvent("playerConnecting", new Action<Player, string, dynamic, dynamic>(OnPlayerConnecting));
            script.AddEvent("playerJoining", new Action<Player>(OnPlayerJoining));
        }

        #region VARIABLES

        WebSocketServer socket { get; }

        #endregion
        #region BASE EVENTS

        protected override void OnModuleInitialized()
        {
            socket.AddWebSocketService<DiscordAuthSocket>("/auth");
            socket.Start();
        }

        protected async void OnPlayerConnecting([FromSource] Player player, string playerName, dynamic setKickReason, dynamic deferrals)
        {
            deferrals.defer();

            await Server.Delay(0);

            deferrals.update("Authentication initializing...");

            while (DiscordAuthSocket.socket == null || DiscordAuthSocket.socket.State != WebSocketSharp.WebSocketState.Open)
            {
                deferrals.update("Authentication system is down please wait or try again later...");
                await Server.Delay(10);
            }

            string message = await DiscordAuthSocket.socket.OnPlayerConnecting(player, deferrals);
            if (message != "") deferrals.done(message);
            else deferrals.done();
        }

        protected void OnPlayerJoining([FromSource] Player player)
        {
            DiscordAuthSocket.socket.OnPlayerJoining(player);
        }

        protected override void OnPlayerDropped([FromSource] Player player, string reason)
        {
            DiscordAuthSocket.socket.OnPlayerDropped(player, reason);
        }

        #endregion
    }
}
