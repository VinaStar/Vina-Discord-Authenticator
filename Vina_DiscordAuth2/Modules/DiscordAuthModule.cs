using System;

using CitizenFX.Core;
using CitizenFX.Core.Native;

using WebSocketSharp.Server;

using VinaFrameworkServer.Core;
using Vina_DiscordAuth2.WebSocket;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;

namespace Vina_DiscordAuth2.Modules
{
    public class DiscordAuthModule : Module
    {
        public DiscordAuthModule(Server server) : base(server)
        {
            DiscordAuthSocket.server = server;

            socket = new WebSocketServer(API.GetConvarInt("vina_discord_auth_port", 8085));
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

        protected override async void OnPlayerConnecting(Player player, dynamic deferrals)
        {
            deferrals.defer();

            await Server.Delay(0);

            deferrals.update("Authentication initializing...");

            await Server.Delay(1000);

            while (DiscordAuthSocket.socket == null || DiscordAuthSocket.socket.State != WebSocketSharp.WebSocketState.Open)
            {
                deferrals.update("Authentication system is down please wait or try again later...");
                await Server.Delay(10);
            }

            string message = await DiscordAuthSocket.socket.OnPlayerConnecting(player, deferrals);
            if (message != "") deferrals.done(message);
            else deferrals.done();
        }

        protected override void OnPlayerJoining(Player player)
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
