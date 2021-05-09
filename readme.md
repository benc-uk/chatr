# Chatr - Azure Web PubSub Sample App

This is a demonstration & sample application designed to be a simple web based chat system.

It provides group and private chats, a persistent user list and several other features.

It is built on several Azure technologies: _Web PubSub, Static Web Apps, Table Storage_ and _Container Instances_

> 👁‍🗨 Note. This is a side project, created to aid learning while building something interesting. The code should not be considered 'best practice' or representing a set of recommendations for using Azure Web PubSub, however it does represent the output of getting something working!

Goals:

- Learn about using websockets
- Write a 'fun' thing
- Try out the new Azure Web PubSub service
- Use the authentication features of Azure Static Web Apps
- Deploy everything using Azure Bicep

Use cases & key features:

- Sign-in with Microsoft, Twitter or GitHub accounts
- Realtime chat with users
- Shared group chats
- Private user to user chats

# Screenshot

![](./etc/screen.png)

---

![](https://img.shields.io/github/license/benc-uk/chatr)
![](https://img.shields.io/github/last-commit/benc-uk/chatr)
![](https://img.shields.io/github/checks-status/benc-uk/chatr/main)
![](https://img.shields.io/github/workflow/status/benc-uk/chatr/Azure%20Static%20Web%20Apps%20CI%2FCD?label=client-deploy)
![](https://img.shields.io/github/workflow/status/benc-uk/chatr/Build%20Server%20Image?label=server-build)

# Architecture

![](./etc/diagram.png)

## Client / Frontend

This is the part used by end users, and is the web frontend.

The source for this is found in **client/** and is a static standalone pure ES6 JS application, no bundling or Node is required. It is written using Vue.js.

Some notes:

- ES6 modules are used so the various JS files can use import/export without the need to bundle.
- Vue.js is used as a browser side library loaded from CDN with `<script>` tag, this is an elegant & lightweight approach supported by modern browsers, rather than the usual vue-cli style app which requires Node and webpack etc.
- `js/app.js` shows how to create a Vue.js app with child components using this approach.
- `client/js/components/chat.js` is a Vue.js component used to host each chat tab in the application
- `config.js` Tries to find out the API endpoint, it does this by calling **_another_** API, `/api/getEndpoint` this is a mini API is hosted by Azure Static Web Apps, and is a trivial single function app, found in **/client-api** folder, it simply returns the value of the environmental variable `API_ENDPOINT` as JSON, therefore allowing for [dynamic configuration using application settings](https://docs.microsoft.com/en-us/azure/static-web-apps/application-settings)
- When hosted in Static Web Apps, the `.auth/` endpoint is used to sign users in and fetch their user details, such as userId. When running locally users are prompted to simply enter a name.

## Server

This is the backend, handling websocket events to and from Azure Web PubSub, and providing REST API for some operations.

The source for this is found in **server/** and is a Node.js Express app. It connects to Azure Table Storage to persist group chat and user data (Table Storage was picked as it's simple & cheap).

The code layout is fairly logical, the REST API is found in `api.js` the pubsub handlers in `pubsub.js` and table storage code in `state.js`, with `server.js` being the entrypoint plus Express code

When running locally the server also acts as a host for the client frontend, serving the **client/** directory as static content, when running in Azure and from a container this is NOT used

### Server REST API

- GET `/api/chats` - Return a JSON object where each key is a chat ID, and each value is an chat object holding name, id, etc
- GET `/api/users` - Return a JSON object where each key is a user ID, and each value is an user object
- GET `/api/getToken?userId={userId}` - Return a token containing a URL so that the client can connect to the PubSub websocket, using `getAuthenticationToken()`

### WebSocket & API Message Flows

There is two way message flow between clients and the server via [Azure Web PubSub and event handlers](https://azure.github.io/azure-webpubsub/concepts/service-internals#event-handler)

[The json.webpubsub.azure.v1 subprotocol is used](https://azure.github.io/azure-webpubsub/references/pubsub-websocket-subprotocol) rather than basic WebSockets, this provides a number of features: users can be added to groups, clients can send custom events (using `type: event`), and also send messages direct to other clients without going via the server (using `type: sendToGroup`)

Notes:

- Chat IDs are simply randomly generated GUIDs, these correspond to the names of "groups" in the subprotocol.
- Private chats are a special case, they are not persisted in state, and they do not trigger **chatCreated** events. Also the user doesn't issue a **joinChat** event to join them, that is handled by the server as a kind og push.
- User IDs are simply strings which are considered to be unique, this could be improved.

#### Client Messaging

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

There are event handlers for each of these user events in `pubsub.js` along with handlers for connection & disconnection system events.

#### Server Messaging

Messages sent from the server have a custom Chatr app specific payload as follows:

```
{
  chatEvent: <eventType>,
  data: <JSON object type dependant>
}
```

Where eventType is one of:

- **chatCreated** - Let all users know a new group chat has been created
- **chatDeleted** - Let all users know a group chat has been removed
- **userOnline** - Let all users know a user has come online
- **userOffline** - Let all users know a user has left
- **joinPrivateChat** - Sent to both the initiator and recipient of a private chat

## Some Notes on Design and Service Choice

The intention was to use _Azure Web PubSub_ and _Azure Static Web Apps_, and to host the server side component as a set of serverless functions in the _Static Web Apps_ API support (which is in fact _Azure Functions_ under the hood). _Azure Static Web Apps_ was selected rather than simply hosting the client static files from the server API component. This was because _Azure Static Web Apps_ has [amazing support for codeless and configless user signin and auth](https://docs.microsoft.com/en-us/azure/static-web-apps/authentication-authorization), which I wanted to leverage. Several issues were found with this initial approach:

- [API support in _Static Web Apps_ is quite limited](https://docs.microsoft.com/en-us/azure/static-web-apps/apis) and can't support the new bindings and triggers for Web PubSub.
- I tried using a standalone _Azure Function App_, however the new bindings and triggers for Web PubSub would still not work, this is hopefully just a bug
- It was decided to write the server component as a containerized Node.js Express app which could be run anywhere, there are some implications to this approach:
  - CORS issues, as the frontend client is making calls to a different domain/host, so CORS had to be set to '\*' on the server
  - The server must expose it's APIs over HTTPS, to prevent mixed content errors and because _Azure Web PubSub_ will only call an upstream event handler over HTTPS. To achieve this a sidecar container is used which runs the [Caddy 2 web server](https://caddyserver.com/), acting as a reverse proxy in front of the real server. See the **deploy/modules/server.bicep** file for details on how this is achieved

# Running and Deploying the App

## Working Locally

See makefile

```text
$ make
help                 💬 This help message
lint                 🔎 Lint & format, will not fix but sets exit code on error
lint-fix             📜 Lint & format, will try to fix errors and modify code
image                🔨 Build server container image from Dockerfile
push                 📤 Push server container image to registry
run                  🏃 Run server locally using Node.js
watch                👀 Watch & hot reload server locally using nodemon
clean                🧹 Clean up project
deploy               🚀 Deploy everything to Azure using Bicep
```

## Deploying to Azure

Deployment is fairly complex due to the number of components and the configuration between them. The makefile target `deploy` should deploy everything for you in a single step using Bicep templates found in the **deploy/** folder

Summary of steps:

- Have Azure CLI, make, git installed
- Fork (not clone!) this repo
- [Create a GitHub PAT](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token) with repo admin rights
- Review `AZURE_` variables in makefile
- Run `make deploy GITHUB_TOKEN={{your-github-token}}`

This will deploy the backend server from a public container image `ghcr.io/benc-uk/chatr/server:latest` which is build from the main branch of the benc-uk/chatr repo. If you want to use your own image, set the make variables: `IMAGE_REG`, `IMAGE_REPO` & `IMAGE_TAG`

## Running Locally

This is possible but it requires some juggling, and some amount of manual config

When running locally the API endpoint used for user sign-in is nto available (it's provided by Azure Static Web App), instead a simple prompt for a user name is used instead.

- Deploy _Azure Storage_ account, get name and access key.
- Deploy _Azure Web Pub Sub_, get connection string.
- Copy `server/.env.sample` to `server/.env` and set the required environmental vars.
- Start local tunnel service such as **ngrok** or **loophole**. The tunnel should expose port 3000 over HTTP. I use [loophole](https://loophole.cloud/) as it allows me to set the hostname, e.g.
  - `loophole http 3000 --hostname chatr`
- In _Azure Web Pub Sub_ settings.
  - Add a hub named **chat**
  - In the URL template put `https://{{hostname-of-tunnel-service}}/pubsub/events`
  - In system events tick **connected** and **disconnected**
- Run `make run` or `make watch`
- Open `http://localhost:3000`
