using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Vina_DiscordAuth2.WebSocket
{
    public class OnlinePlayerInfo
    {
        public string Username { get; set; }
        public DateTime Time { get; set; }

        public OnlinePlayerInfo(string username)
        {
            Username = username;
            Time = DateTime.Now;
        }
    }
}
