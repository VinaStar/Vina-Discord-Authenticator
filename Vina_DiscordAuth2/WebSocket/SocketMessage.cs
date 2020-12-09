using System;
using System.Collections.Generic;

namespace Vina_DiscordAuth2.WebSocket
{
    public class SocketMessage
    {
        public string action { get; set; }
        public string username { get; set; }
        public string discordId { get; set; }
        public string reason { get; set; }
        public int priority { get; set; }
        public int maxPlayers { get; set; }
        public int playerCount { get; set; }
        public int queuedCount { get; set; }
        public DateTime time { get; set; }
        public Dictionary<string, OnlinePlayerInfo> onlineList { get; set; }
        public Dictionary<string, QueuePlayerInfo> queuedList { get; set; }

        public SocketMessage()
        {

        }

        public static SocketMessage FromJson(string json)
        {
            return Server.DeserializeObject<SocketMessage>(json);
        }

        public string ToJson()
        {
            return Server.SerializeObject(this);
        }
    }
}
