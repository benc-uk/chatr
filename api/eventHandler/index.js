//
// Chatr - API
// Webhook event handler for receiving upstream events from Azure Web PubSub
//
// NOTE. This function DOES NOT use the Web PubSub Trigger binding as you might expect
// So we can host it in Static Web App, we handle the HTTP webhooks manually, it's not hard :)
// Ben Coleman, 2021
//

const { WebPubSubServiceClient } = require('@azure/web-pubsub')
const state = require('../state')

const CONN_STR = process.env.PUBSUB_CONNECTION_STRING
const HUB = process.env.PUBSUB_HUB

module.exports = async function (context, req) {
  if (!CONN_STR || !HUB) {
    context.log('### ERROR! Must set PUBSUB_CONNECTION_STRING and PUBSUB_CONNECTION_HUB app settings / env vars')
    context.res = { status: 500, body: 'ERROR! Must set PUBSUB_CONNECTION_STRING and PUBSUB_CONNECTION_HUB app settings / env vars' }
    context.done()
    return
  }

  context.log(`### Web PubSub event handler called with method ${req.method}`)

  // We have to handle webhook validation https://azure.github.io/azure-webpubsub/references/protocol-cloudevents#validation
  if (req.method === 'GET') {
    context.log(`### Webhook validation was called for ${req.headers['webhook-request-origin']}`)
    context.res = {
      headers: {
        'webHook-allowed-origin': req.headers['webhook-request-origin'],
      },
      status: 200,
    }
    context.done()
    return
  }

  // We we're here, then it's a POST request for a real event

  const serviceClient = new WebPubSubServiceClient(CONN_STR, HUB)

  const userId = req.headers['ce-userid']
  const eventName = req.headers['ce-eventname']

  // System event for new connected user
  if (eventName === 'connected') {
    context.log(`### User ${userId} connected`)
    state.upsertUser(userId, { status: 'online' })
    await serviceClient.sendToAll({
      chatEvent: 'userOnline',
      data: userId,
    })
  }

  // System event for disconnected user, logoff or tab closed
  if (eventName === 'disconnected') {
    context.log(`### User ${userId} has disconnected`)
    await removeChatUser(serviceClient, userId)
    await serviceClient.sendToAll({
      chatEvent: 'userOffline',
      data: userId,
    })
  }

  if (eventName === 'createChat') {
    const chatName = req.body.name
    const chatId = req.body.id
    const chatEntity = { id: chatId, name: chatName, members: {} }
    state.upsertChat(chatId, chatEntity)

    serviceClient.sendToAll({
      chatEvent: 'chatCreated',
      data: JSON.stringify(chatEntity),
    })

    context.log(`### New chat ${chatName} was created by ${userId}`)
  }

  if (eventName === 'joinChat') {
    const chatId = req.body
    let chat = await state.getChat(chatId)

    if (!chat) {
      context.log(`### Attempt to join chat with ID ${chatId} failed, it doesn't exist`)
      return
    }

    // Chat id used as the group name
    serviceClient.group(chatId).addUser(userId)

    // Add user to members of the chat (members is a map/dict) and push back into the DB
    chat.members[userId] = 'USER'
    await state.upsertChat(chatId, chat)
    context.log(`### User ${userId} has joined chat ${chat.name}`)

    setTimeout(() => {
      serviceClient.group(chatId).sendToAll(`💬 <b>${userId}</b> has joined the chat`)
    }, 1000)
  }

  if (eventName === 'leaveChat') {
    const chatId = req.body
    console.log(`### User ${userId} has left chat ${chatId}`)

    await serviceClient.group(chatId).removeUser(userId)
    await serviceClient.group(chatId).sendToAll(`💨 <b>${userId}</b> has left the chat`)

    leaveChat(serviceClient, userId, chatId)
  }

  if (eventName === 'createPrivateChat') {
    const initiator = req.body.initiatorUserId
    const target = req.body.targetUserId
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
      await removeChatUser(serviceClient, target)
      context.res = { status: 200 }
      context.done()
      return
    }

    try {
      await serviceClient.group(chatId).addUser(initiator)

      await serviceClient.sendToUser(initiator, {
        chatEvent: 'joinPrivateChat',
        data: JSON.stringify({ id: chatId, name: `A chat with ${target}`, grabFocus: true }),
      })
    } catch (err) {
      // This should never happen!
      console.log(`### Source user for private chat not found, will remove them!`)
      await removeChatUser(serviceClient, initiator)
      context.res = { status: 200 }
      context.done()
      return
    }

    setTimeout(async () => {
      await serviceClient.group(chatId).sendToAll(`💬 ${initiator} wants to chat`)
    }, 500)
  }

  // Respond with a 200 to the webhook
  context.res = { status: 200 }
  context.done()
}

//
// Helper to remove user from a chat
// Deletes a chat when it has no members
//
async function leaveChat(serviceClient, userId, chatId) {
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
  for (let chatId in await state.listChats()) {
    console.log('### Calling leaveChat', userId, chatId)
    await leaveChat(serviceClient, userId, chatId)
  }
}
