const { WebPubSubServiceClient } = require('@azure/web-pubsub')
const { WebPubSubEventHandler } = require('@azure/web-pubsub-express')

let chatList = require('./state').chatList
let userList = require('./state').userList

const pubSubConnStr = process.env['PUBSUB_CONNECTION_STRING']
const pubSubHub = process.env['HUB'] || 'chat'
if (!pubSubConnStr) {
  console.log('### Fatal! PUBSUB_CONNECTION_STRING is not set, exiting now')
  process.exit(2)
}

const serviceClient = new WebPubSubServiceClient(pubSubConnStr, pubSubHub)

let handler = new WebPubSubEventHandler(pubSubHub, ['*'], {
  path: '/api/event',

  //
  //
  //
  onConnected: async (req) => {
    const userName = req.context.userId
    console.log(`### User ${userName} connected`)
    userList[userName] = 'online'

    // Notify everyone

    await serviceClient.sendToAll({
      chatEvent: 'userOnline',
      data: userName,
    })
  },

  //
  //
  //
  onDisconnected: async (req) => {
    const userId = req.context.userId
    console.log(`### User ${userId} has disconnected`)
    delete userList[userId]

    // Notify everyone
    serviceClient.sendToAll({
      chatEvent: 'userOffline',
      data: userId,
    })

    // Leave all chats
    for (let chatId in chatList) {
      leaveChat(userId, chatId)
    }
  },

  //
  //
  //
  handleUserEvent: async (req, res) => {
    console.log(req)
    if (req.context.eventName === 'createChat') {
      const chatName = req.data.name
      const chatId = req.data.id
      const chat = { id: chatId, name: chatName, members: {} }
      chatList[chatId] = chat

      serviceClient.sendToAll({
        chatEvent: 'chatCreated',
        data: JSON.stringify(chat),
      })

      //res.status(200).json({ id: chatId })
      console.log(`### New chat ${chatName} was created via WS`)
    }

    if (req.context.eventName === 'joinChat') {
      const chatId = req.data
      if (!chatList[chatId]) {
        console.warn(`### Attempt to join chat with ID ${chatId} failed, it doesn't exist`)
        return
      }
      const userId = req.context.userId
      const chatName = chatList[chatId].name

      serviceClient.group(chatId).addUser(userId)
      // Add to members of the chat
      chatList[chatId].members[userId] = 'USER'
      console.log(`### User ${userId} has joined chat ${chatName}`)

      setTimeout(() => {
        serviceClient.group(chatId).sendToAll(`💬 <b>${userId}</b> has joined the chat`)
      }, 1000)
    }

    if (req.context.eventName === 'leaveChat') {
      const chatId = req.data
      if (!chatList[chatId]) {
        console.warn(`### Attempt to leave chat with ID ${chatId} failed, it doesn't exist`)
        return
      }
      const userId = req.context.userId
      const chatName = chatList[chatId].name

      console.log(`### User ${userId} has left chat ${chatName}`)
      serviceClient.group(chatName).removeUser(req.context.userId)
      leaveChat(userId, chatId)
      serviceClient.group(chatName).sendToAll(`🚪 ${userId} has left ${chatName}`)
    }

    res.success()
  },
})

async function leaveChat(userId, chatId) {
  let chat = chatList[chatId]

  // Find & remove user from chat's member list
  for (let memberUserId in chat.members) {
    if (memberUserId === userId) {
      delete chat.members[userId]
      serviceClient.group(chatId).sendToAll(`💨 <b>${userId}</b> has left the chat`)
    }
  }

  // If there are no members, then delete the chat
  if (Object.keys(chat.members).length <= 0) {
    console.log(`### Deleting chat ${chatId} with no members!`)
    await serviceClient.sendToAll({
      chatEvent: 'chatDeleted',
      data: JSON.stringify(chat),
    })
    delete chatList[chatId]
  }
}

module.exports = {
  serviceClient,
  handler,
}
