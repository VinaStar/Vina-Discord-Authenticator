using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Vina_DiscordAuth2.WebSocket
{
    public class QueuePlayerInfo
    {
        public string Username { get; set; }
        public int Priority { get; set; }
        public DateTime Time { get; set; }

        public QueuePlayerInfo(string username, int priority)
        {
            Username = username;
            Priority = priority;
            Time = DateTime.Now;
        }
    }
}
