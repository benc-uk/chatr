//
// Chatr - API
// Webhook event handler for receiving upstream events from Azure Web PubSub
//
// NOTE. This function DOES NOT use the Web PubSub Trigger binding as you might expect
// We handle the HTTP webhooks manually, it's not hard :)
// Ben Coleman, 2021 - 2025
//

import { WebPubSubServiceClient } from '@azure/web-pubsub'
import { DefaultAzureCredential } from '@azure/identity'
import { app } from '@azure/functions'
import * as state from '../state.js'
import { validate } from '../entra-jwt-validate.js'

const hubName = process.env.PUBSUB_HUB
const endpoint = process.env.PUBSUB_ENDPOINT

app.http('eventHandler', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',

  handler: async (req, context) => {
    if (!hubName || !endpoint) {
      const errorMsg = 'ERROR! Must set PUBSUB_HUB, PUBSUB_ENDPOINT in app settings / env vars'
      context.log(errorMsg)
      return { status: 500, body: errorMsg }
    }

    // OPTIONAL: Validate the JWT token if TENANT_ID was set
    if (process.env.VALIDATION_TENANT_ID) {
      let accessToken = req.headers.get('authorization')
      if (accessToken && accessToken.startsWith('Bearer ')) {
        accessToken = accessToken.substring(7)
      }
      if (!accessToken) {
        return { status: 401, body: 'Missing authorization header' }
      }

      // Validate the token
      await validate(accessToken, process.env.TENANT_ID)
    }

    // We have to handle cloud event webhook validation
    // https://learn.microsoft.com/en-us/azure/azure-web-pubsub/howto-develop-eventhandler#upstream-and-validation
    if (req.method === 'OPTIONS') {
      context.log(`### Webhook validation was called!`)
      return {
        headers: {
          'webhook-allowed-origin': req.headers.get('webhook-request-origin'),
        },
        status: 200,
      }
    }

    const credentials = new DefaultAzureCredential()
    const serviceClient = new WebPubSubServiceClient(endpoint, credentials, hubName)
    const userId = req.headers.get('ce-userid')
    const eventName = req.headers.get('ce-eventname')

    // System event for disconnected user, logoff or tab closed
    if (eventName === 'disconnected') {
      context.log(`### User ${userId} has disconnected`)
      await removeChatUser(serviceClient, userId)
      await serviceClient.sendToAll({
        chatEvent: 'userOffline',
        data: userId,
      })
    }

    // Use a custom event here rather than the system connected event
    // This means we can pass extra data, not just a userId
    if (eventName === 'userConnected') {
      const body = await req.json()
      const userName = body.userName
      const userProvider = body.userProvider
      console.log(`### User ${userId} ${userName} ${userProvider} connected`)
      state.upsertUser(userId, { userName, userProvider, idle: false })
      await serviceClient.sendToAll({
        chatEvent: 'userOnline',
        data: JSON.stringify({
          userId,
          userName,
          userProvider,
          idle: false,
        }),
      })
    }

    if (eventName === 'createChat') {
      const body = await req.json()
      const chatName = body.name
      const chatId = body.id
      const chatEntity = { id: chatId, name: chatName, members: {}, owner: userId }
      state.upsertChat(chatId, chatEntity)

      serviceClient.sendToAll({
        chatEvent: 'chatCreated',
        data: JSON.stringify(chatEntity),
      })

      context.log(`### New chat ${chatName} was created by ${userId}`)
    }

    if (eventName === 'joinChat') {
      const chatId = await req.text()
      const chat = await state.getChat(chatId)

      if (!chat) {
        context.log(`### Attempt to join chat with ID ${chatId} failed, it doesn't exist`)
        return
      }

      // Chat id used as the group name
      serviceClient.group(chatId).addUser(userId)

      // Need to call state to get the users name
      const user = await state.getUser(userId)

      // Add user to members of the chat (members is a map/dict) and push back into the DB
      chat.members[userId] = { userId, userName: user.userName }
      await state.upsertChat(chatId, chat)
      context.log(`### User ${user.userName} has joined chat ${chat.name}`)

      setTimeout(() => {
        serviceClient.group(chatId).sendToAll(`💬 <b>${user.userName}</b> has joined the chat`)
      }, 1000)
    }

    if (eventName === 'leaveChat') {
      const body = await req.json()
      const chatId = body.chatId
      const userName = body.userName
      context.log(`### User ${userName} has left chat ${chatId}`)

      await serviceClient.group(chatId).removeUser(userId)
      await serviceClient.group(chatId).sendToAll(`💨 <b>${userName}</b> has left the chat`)

      leaveChat(userId, chatId)
    }

    if (eventName === 'createPrivateChat') {
      const body = await req.json()
      const initiator = body.initiatorUserId
      const target = body.targetUserId
      context.log(`### Starting private chat ${initiator} -> ${target}`)

      let chatId = ''
      // This strangeness means we get a unique pair ID no matter who starts the chat
      if (target < initiator) {
        chatId = `private_${target}_${initiator}`
      } else {
        chatId = `private_${initiator}_${target}`
      }

      // Need to call state to get the users name
      const initiatorUser = await state.getUser(initiator)
      const targetUser = await state.getUser(target)

      try {
        await serviceClient.group(chatId).addUser(target)

        await serviceClient.sendToUser(target, {
          chatEvent: 'joinPrivateChat',
          data: JSON.stringify({ id: chatId, name: `Chat with ${initiatorUser.userName}`, grabFocus: false }),
        })
      } catch (err) {
        // This can happen with orphaned disconnected users
        context.log(`### Target user for private chat not found, will remove them!`)
        await removeChatUser(serviceClient, target)
        return { status: 200 }
      }

      try {
        await serviceClient.group(chatId).addUser(initiator)

        await serviceClient.sendToUser(initiator, {
          chatEvent: 'joinPrivateChat',
          data: JSON.stringify({ id: chatId, name: `Chat with ${targetUser.userName}`, grabFocus: true }),
        })
      } catch (err) {
        // This should never happen!
        context.log(`### Source user for private chat not found, will remove them!`)
        await removeChatUser(serviceClient, initiator)
        return { status: 200 }
      }

      setTimeout(async () => {
        await serviceClient.group(chatId).sendToAll(`💬 ${initiatorUser.userName} wants to chat`)
      }, 500)
    }

    if (eventName === 'userEnterIdle') {
      const userId = await req.text()
      context.log(`### User ${userId} has gone idle`)
      await serviceClient.sendToAll({
        chatEvent: 'userIsIdle',
        data: userId,
      })
    }

    if (eventName === 'userExitIdle') {
      const userId = await req.text()
      context.log(`### User ${userId} has returned`)
      await serviceClient.sendToAll({
        chatEvent: 'userNotIdle',
        data: userId,
      })
    }

    if (eventName === 'deleteChat') {
      const chatId = await req.text()
      context.log(`### Chat ${chatId} has been deleted`)
      await state.removeChat(chatId)
      await serviceClient.sendToAll({
        chatEvent: 'chatDeleted',
        data: chatId,
      })
    }

    // Respond with a 200 to the webhook
    return { status: 200 }
  },
})

//
// Helper to remove user from a chat
//
async function leaveChat(userId, chatId) {
  const chat = await state.getChat(chatId)
  if (!chat) {
    return
  }

  // Find & remove user from chat's member list
  for (const memberUserId in chat.members) {
    if (memberUserId === userId) {
      delete chat.members[userId]
    }
  }

  state.upsertChat(chatId, chat)
}

//
// Helper to remove a user, syncs all users and the DB
//
async function removeChatUser(serviceClient, userId) {
  console.log(`### User ${userId} is being removed`)
  state.removeUser(userId)

  // Notify everyone
  serviceClient.sendToAll({
    chatEvent: 'userOffline',
    data: userId,
  })

  // Leave all chats
  for (const chatId in await state.listChats()) {
    console.log('### Calling leaveChat', userId, chatId)
    await leaveChat(userId, chatId)
  }
}
