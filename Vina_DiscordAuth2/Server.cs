using VinaFrameworkServer.Core;
using Vina_DiscordAuth2.Modules;

namespace Vina_DiscordAuth2
{
    public class Server : BaseServer
    {
        public Server()
        {
            AddModule(typeof(DiscordAuthModule));
        }
    }
}
