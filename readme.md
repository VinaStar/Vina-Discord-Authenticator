# FiveM Discord Authenticator v1.0
   
### FEATURES
- Localhost WebSocket Communication with FiveM server.
- Discord Bot client connection
- Verify user is member of the Discord server.
- Post authentication (succeed & failed) notification in a Discord channel.
- Standalone Resource
   
---
   
### INSTRUCTIONS:
   
   **1)** Place "fivemdiscordauthenticator" directory inside your server Resources directory.
   
   **2)** Add "ensure fivemdiscordauthenticator" to your server config.
   
   **3)** Open/Edit "Node/config.json"
   
   **4)** Replace "bot_token" with your discord bot token.
   
   **5)** Optionally, replace "auth_channel" with a channel ID from your discord server to recieve live message when authentication occur.
   
   **6)** Run the command "npm install" inside "Node" directory.
   
   **7)** Run the node using "node fivem_discord_authenticator.js", require NodeJS to be installed.
   
   **8)** Start your FiveM server.
   
   
### EXTRA:

You can change the messages and port using convar in your FiveM server config file:
   
*set discord_auth_drop_notbinded_message "You must bind your Discord account in FiveM settings to join this server."*  
**Set the message when someone doesn't have a Discord binded to the fivem launcher**

*set discord_auth_drop_notmember_message "You must be a member of our Discord channel to join this server."*  
**Set the message when someone have a Discord binded to the fivem launcher but is not member of your Discord server**

*set discord_auth_port 8085*  
**Set the port to connect to the websocket server (same as in the convar if you change it)**
   
