# FiveM Discord Authenticator v1.0
   
   
### INSTRUCTIONS:
   
   **1)** Place the "fivemdiscordauthenticator" directory inside your server Resources directory.
   
   **2)** Add "ensure fivemdiscordauthenticator" to your server config.
   
   **3)** Open/Edit "fivem_discord_authenticator_node/config.json"
   
   **4)** Set "bot_token" with your discord bot token.
   
   **5)** Optionally, set "auth_channel" with a channel ID from your discord server to recieve live message when authentication occur.
   
   **6)** Run the command "npm install" from within the "fivem_discord_authenticator_node" directory.
   
   **7)** Run the node using "node fivem_discord_authenticator.js" require NodeJS to be installed.
   
   **8)** Start your FiveM server.
   
   
### EXTRA:

You can change the messages and port using convar in your FiveM server config file:
   
   *set discord_auth_drop_notbinded_message "You must bind your Discord account in FiveM settings to join this server."*
   
   *set discord_auth_drop_notmember_message "You must be a member of our Discord channel to join this server."*
   
   *set discord_auth_port 8085*
   
