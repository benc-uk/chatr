const { WebPubSubServiceClient } = require('@azure/web-pubsub')
const { WebPubSubEventHandler } = require('@azure/web-pubsub-express')

const state = require('./state')

let disconnectingUsers = {}

const pubSubConnStr = process.env['PUBSUB_CONNECTION_STRING']
const pubSubHub = process.env['HUB'] || 'chat'
if (!pubSubConnStr) {
  console.log('### Fatal! PUBSUB_CONNECTION_STRING is not set, exiting now')
  process.exit(2)
}

const serviceClient = new WebPubSubServiceClient(pubSubConnStr, pubSubHub)
console.log(`### Connected to Azure web pubsub: ${pubSubConnStr.split(';')[0]} using hub: ${pubSubHub}`)

let handler = new WebPubSubEventHandler(pubSubHub, ['*'], {
  path: '/pubsub/events',

  //
  //
  //
  onConnected: async (req) => {
    const userId = req.context.userId
    console.log(`### User ${userId} connected`)
    state.upsertUser(userId, { status: 'online' })

    // Notify everyone
    await serviceClient.sendToAll({
      chatEvent: 'userOnline',
      data: userId,
    })
  },

  //
  //
  //
  onDisconnected: async (req) => {
    const userId = req.context.userId
    // We get multiple disconnect events when a user closes the tab/window
    // This lock object prevents multiple invocations
    if (Object.keys(disconnectingUsers).includes(userId)) {
      return
    }
    disconnectingUsers[userId] = 'BYE'

    console.log(`### User ${userId} is disconnecting`)
    state.removeUser(userId)

    // Notify everyone
    serviceClient.sendToAll({
      chatEvent: 'userOffline',
      data: userId,
    })

    // Leave all chats
    for (let chatId in await state.listChats()) {
      console.log('calling leaveChat', userId, chatId)
      leaveChat(userId, chatId)
    }

    // Release the lock
    delete disconnectingUsers[userId]
  },

  //
  //
  //
  handleUserEvent: async (req, res) => {
    if (req.context.eventName === 'createChat') {
      const chatName = req.data.name
      const chatId = req.data.id
      const chat = { id: chatId, name: chatName, members: {} }
      state.upsertChat(chatId, chat)

      serviceClient.sendToAll({
        chatEvent: 'chatCreated',
        data: JSON.stringify(chat),
      })

      console.log(`### New chat ${chatName} was created via WS`)
    }

    if (req.context.eventName === 'joinChat') {
      const chatId = req.data
      let chat = await state.getChat(chatId)

      if (!chat) {
        console.warn(`### Attempt to join chat with ID ${chatId} failed, it doesn't exist`)
        return
      }
      const userId = req.context.userId

      serviceClient.group(chatId).addUser(userId)

      // Add user to members of the chat (members is a map/dict) and push back into the DB
      chat.members[userId] = 'USER'
      await state.upsertChat(chatId, chat)
      console.log(`### User ${userId} has joined chat ${chat.name}`)

      setTimeout(() => {
        serviceClient.group(chatId).sendToAll(`💬 <b>${userId}</b> has joined the chat`)
      }, 1000)
    }

    if (req.context.eventName === 'leaveChat') {
      const chatId = req.data
      const userId = req.context.userId
      console.log(`### User ${userId} has left chat ${chatId}`)

      await serviceClient.group(chatId).removeUser(req.context.userId)
      await serviceClient.group(chatId).sendToAll(`💨 <b>${userId}</b> has left the chat`)

      leaveChat(userId, chatId)
    }

    if (req.context.eventName === 'createPrivateChat') {
      const initiator = req.data.initiatorUserId
      const target = req.data.targetUserId
      console.log(`### Starting private chat ${initiator} -> ${target}`)

      let chatId = ''
      // This strangeness means we get a unique pair ID no matter who starts the chat
      if (target < initiator) {
        chatId = `private_${target}_${initiator}`
      } else {
        chatId = `private_${initiator}_${target}`
      }

      try {
        await serviceClient.group(chatId).addUser(target)

        await serviceClient.sendToUser(target, {
          chatEvent: 'joinPrivateChat',
          data: JSON.stringify({ id: chatId, name: `A chat with ${initiator}`, grabFocus: false }),
        })
      } catch (err) {
        // This can happen with orphaned disconnected users
        console.log(`### Target user for private chat not found, will remove them!`)
        state.removeUser(target)
        serviceClient.sendToAll({ chatEvent: 'userOffline', data: target })
        res.success()
        return
      }

      try {
        await serviceClient.group(chatId).addUser(initiator)

        await serviceClient.sendToUser(initiator, {
          chatEvent: 'joinPrivateChat',
          data: JSON.stringify({ id: chatId, name: `A chat with ${target}`, grabFocus: true }),
        })
      } catch (err) {
        // This can happen with orphaned disconnected users
        console.log(`### Source user for private chat not found, will remove them!`)
        state.removeUser(initiator)
        serviceClient.sendToAll({ chatEvent: 'userOffline', data: initiator })
        res.success()
        return
      }

      setTimeout(async () => {
        await serviceClient.group(chatId).sendToAll(`💬 ${initiator} wants to chat`)
      }, 500)
    }

    res.success()
  },
})

//
// Helper to remove user from a chat
// Deletes a chat when it has no members
//
async function leaveChat(userId, chatId) {
  let chat = await state.getChat(chatId)
  if (!chat) {
    return
  }

  // Find & remove user from chat's member list
  for (let memberUserId in chat.members) {
    if (memberUserId === userId) {
      delete chat.members[userId]
    }
  }

  // If there are no members, then delete the chat
  if (Object.keys(chat.members).length <= 0) {
    console.log(`### Deleting chat ${chatId} with no members!`)

    await serviceClient.sendToAll({
      chatEvent: 'chatDeleted',
      data: JSON.stringify(chat),
    })

    await state.removeChat(chatId)
  } else {
    state.upsertChat(chatId, chat)
  }
}

module.exports = {
  serviceClient,
  handler,
}
