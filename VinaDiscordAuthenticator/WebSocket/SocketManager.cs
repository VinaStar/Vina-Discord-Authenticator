using WebSocketSharp.Server;

namespace VinaDiscordAuthenticator.WebSocket
{
    public static class SocketManager
    {
        private static WebSocketServer server;

        public static void Start(int port)
        {
            if (server == null)
            {
                server = new WebSocketServer(port);
                server.AddWebSocketService<DiscordAuthSocket>("/auth");
                server.Start();
            }
        }

        public static void Stop()
        {
            if (server != null)
            {
                server.Stop();
                server = null;
            }
        }
    }
}
