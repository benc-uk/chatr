# Chatr - Azure Web PubSub Sample App

This is a demonstration & sample application designed to be a simple multi-user web based chat system.  
It provides persistent group chats, user to user private chats, a user list, idle (away from keyboard) detection and several other features.

It is built on several Azure technologies, including: _Web PubSub, Static Web Apps and \_Table Storage_

> 👁‍🗨 Note. This is a personal side project, created to aid learning while building something interesting. The code should not be considered 'best practice' or representing a set of recommendations for using Azure Web PubSub, however it does represent the output of getting something working!

![](https://img.shields.io/github/license/benc-uk/chatr)
![](https://img.shields.io/github/last-commit/benc-uk/chatr)
![](https://img.shields.io/github/checks-status/benc-uk/chatr/main)
![](https://img.shields.io/github/workflow/status/benc-uk/chatr/Azure%20Static%20Web%20Apps%20Deploy?label=client-deploy)

Goals:

- Learn about using websockets
- Write a 'fun' thing
- Try out the new _Azure Web PubSub_ service
- Use the authentication features of _Azure Static Web Apps_
- Deploy everything using _Azure Bicep_

Use cases & key features:

- Sign-in with Microsoft, Twitter or GitHub accounts
- Realtime chat with users
- Shared group chats, which have an owner who that delete the chat
- Detects where users are idle and away from keyboard (default is one minute)
- Private user to user chats

# Screenshot

![](./etc/screen.png)

# Architecture

![](./etc/diagram.png)

# Client / Frontend

This is the main web frontend as used by end users via the browser.

The source for this is found in **client/** and consists of a static standalone pure ES6 JS application, no bundling or Node.js is required. It is written using [Vue.js as a supporting framework](https://vuejs.org/), and [Bulma as a CSS framework](https://bulma.io/).

Some notes:

- ES6 modules are used so the various JS files can use import/export without the need to bundle.
- Vue.js is used as a browser side library loaded from CDN with `<script>` tag, this is an elegant & lightweight approach supported by modern browsers, rather than the usual vue-cli style app which requires Node and webpack etc.
- `client/js/app.js` shows how to create a Vue.js app with child components using this approach. The majority of client logic is here.
- `client/js/components/chat.js` is a Vue.js component used to host each chat tab in the application
- The special `.auth/` endpoint provided by Static Web Apps is used to sign users in and fetch their user details, such as userId.

# Server

This is the backend, handling websocket events to and from Azure Web PubSub, and providing REST API for some operations.

The source for this is found in **api/** and consists of a Node.js Azure Function App. It connects to Azure Table Storage to persist group chat and user data (Table Storage was picked as it's simple & cheap). This is not hosted in a standalone Azure Function App but instead [deployed into the Static Web App as part of it's serverless API support](https://docs.microsoft.com/en-us/azure/static-web-apps/apis)

There are four HTTP functions all served from the default `/api/` path

- `eventHandler` - Webhook receiver for "upstream" events sent from Azure Web PubSub service, contains the majority of application logic. Not called by the client.
- `getToken` - Called by the client to get an access token and URL to connect via WebSockets to the Azure Web PubSub service. Must be called with userId in the URL query, e.g. GET `/api/getToken?userId={user}`
- `getUsers` - Returns a list of signed in users, note the route for this function is `/api/users`
- `getChats` - Returns a list of active group chats, note the route for this function is `/api/chats`

State is handled with `state.js` which is an ES6 module exporting functions supporting state CRUD for users and chats. This module carries out all the interaction with Azure Tables, and provides a relatively transparent interface, so a different storage backend could be swapped in.

## WebSocket & API Message Flows

There is two way message flow between clients and the server via [Azure Web PubSub and event handlers](https://azure.github.io/azure-webpubsub/concepts/service-internals#event-handler)

[The json.webpubsub.azure.v1 subprotocol is used](https://azure.github.io/azure-webpubsub/references/pubsub-websocket-subprotocol) rather than basic WebSockets, this provides a number of features: users can be added to groups, clients can send custom events (using `type: event`), and also send messages direct to other clients without going via the server (using `type: sendToGroup`)

Notes:

- Chat IDs are simply randomly generated GUIDs, these correspond to the names of "groups" in the subprotocol.
- Private chats are a special case, they are not persisted in state, and they do not trigger **chatCreated** events. Also the user doesn't issue a **joinChat** event to join them, that is handled by the server as a kind of "push" to the clients.
- User IDs are simply strings which are considered to be unique, this could be improved, e.g. with prefixing.

### Client Messaging

Chat messages sent from the client use `sendToGroup` and a custom JSON payload with two fields `message` and `user`, these messages are relayed client to client, the server is never notified of them:

```
{
  type: 'sendToGroup',
  group: <chatId>,
  dataType: 'json',
  data: {
    message: <message text>,
    user: <userId of sender>,
  },
}
```

Events from the the client are sent as `event` type messages using the _json.webpubsub.azure.v1_ protocol, the events sent are:

- **createChat** - Request the server you want to create a group chat
- **createPrivateChat** - Request the server you want to create a private chat
- **joinChat** - To join a chat, the server will add user to the group for that chatId
- **leaveChat** - To leave a group chat
- **deleteChat** - Called from a chat owner to delete a chat
- **userEnterIdle** - Let the server know user is now idle
- **userExitIdle** - Let the server know user is no longer idle

The `eventHandler` function has cases for each of these user events, along with handlers for connection & disconnection system events.

### Server Messaging

Messages sent from the server have a custom Chatr app specific payload as follows:

```
{
  chatEvent: <eventType>,
  data: <JSON object type dependant>
}
```

Where `eventType` is one of:

- **chatCreated** - Let all users know a new group chat has been created
- **chatDeleted** - Let all users know a group chat has been removed
- **userOnline** - Let all users know a user has come online
- **userOffline** - Let all users know a user has left
- **joinPrivateChat** - Sent to both the initiator and recipient of a private chat
- **userIsIdle** - Sent to all users when a user enters idle state
- **userNotIdle** - Sent to all users when a user exits idle state

The client code in `client/js/app.js` handles these messages as they are received by the client, and reacts accordingly.

# Some Notes on Design and Service Choice

The plan of this project was to use _Azure Web PubSub_ and _Azure Static Web Apps_, and to host the server side component as a set of serverless functions in the _Static Web Apps_ API support (which is in fact _Azure Functions_ under the hood). _Azure Static Web Apps_ was selected because it has [amazing support for codeless and config-less user sign-in and auth](https://docs.microsoft.com/en-us/azure/static-web-apps/authentication-authorization), which I wanted to leverage.

Some comments on this approach:

- [API support in _Static Web Apps_ is quite limited](https://docs.microsoft.com/en-us/azure/static-web-apps/apis) and can't support the new bindings and triggers for Web PubSub. **HOWEVER** You don't need to use these bindings 😂. You can create a standard HTTP function to act as a webhook event handler instead of using the `webPubSubConnection` binding. For sending messages back to Web PubSub, the server SDK can simply be used within the function code rather than using the `webPubSub` output binding.
- Table Storage was picked for persisting state as it has a good JS SDK (the new SDK in @azure/data-table was used), it's extremely lightweight and cheap and was good enough for this project, see deails below

# State & Entity Design

State in Azure Tables consists of two tables (collections) named `chats` and `users`

### Chats Table

As each chat contains nested objects inside the members field, each chat is stored as a JSON string in a field called `data`. The PartitionKey is not used and hardcoded to a string "chatr". The RowKey and the id field inside the data object are the same.

- **PartitionKey**: "chatr"
- **RowKey**: The chatId (random GUID created client side)
- **data**: JSON stringified chat entity

Example of a chat data entity

```json
{
  "id": "eab4b030-1a3d-499a-bd89-191578395910",
  "name": "This is a group chat",
  "members": {
    "0987654321": {
      "userId": "0987654321",
      "userName": "Another Guy"
    },
    "1234567890": {
      "userId": "1234567890",
      "userName": "Ben"
    }
  },
  "owner": "1234567890"
}
```

### Users Table

Users are stored as entities with the fields (columns) described below. As there are no nested fields, there is no need to store a JSON string. The PartitionKey is not used and hardcoded to a string "chatr".

- **PartitionKey**: "chatr"
- **RowKey**: The `userId` field returned from Static Web Apps auth endpoint
- **userName**: The username (could be email address or handle) of the user
- **userProvider**: Which auth provided the user signed in with `twitter`, `aad` or `github`
- **idle**: Boolean, indicating if the user us currently idle

# Running and Deploying the App

## Working Locally

See makefile

```text
$ make
help                 💬 This help message
lint                 🔎 Lint & format, will not fix but sets exit code on error
lint-fix             📜 Lint & format, will try to fix errors and modify code
run                  🏃 Run server locally using Static Web Apps CLI
clean                🧹 Clean up project
deploy               🚀 Deploy everything to Azure using Bicep
tunnel               🚇 Start loophole tunnel to expose localhost
```

## Deploying to Azure

Deployment is slightly complex due to the number of components and the configuration between them. The makefile target `deploy` should deploy everything for you in a single step using Bicep templates found in the **deploy/** folder

[See readme in deploy folder for details and instructions](./deploy)

## Running Locally

This is possible but it requires some juggling, and some amount of manual config

When running locally the Static Web Apps CLI is used and this provides a fake user authentication endpoint for us.

- Deploy _Azure Storage_ account, get name and access key.
- Deploy _Azure Web Pub Sub_, get connection string.
- Copy `api/local.settings.sample.json` to `api/local.settings.json` and edit the required setting values.
- Start a localhost tunnel service such as **ngrok** or **loophole**. The tunnel should expose port 7071 over HTTP.  
  I use [loophole](https://loophole.cloud/) as it allows me to set a custom host & DNS name, e.g.
  - `loophole http 7071 --hostname chatr`
- In _Azure Web Pub Sub_ settings.
  - Add a hub named **chat**
  - In the URL template put `https://{{hostname-of-tunnel-service}}/api/eventHandler`
  - In system events tick **connected** and **disconnected**
- Run `make run`
- Open `http://localhost:4280/index.html`

# Known Issues

- Won't run in Firefox as top level await is not supported
