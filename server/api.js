const express = require('express')
const router = express.Router()
//const { v4: uuidv4 } = require('uuid')

let chatList = require('./state').chatList
let userList = require('./state').userList

const serviceClient = require('./pubsub').serviceClient

//
//
//
router.get('/api/getToken', async (req, res) => {
  let user = req.query.userId || 'anonymous'
  console.log(`### Token requested from user ${user}`)

  let token = await serviceClient.getAuthenticationToken({
    // !IMPORTANT! Without these roles nothing works and you get no errors
    roles: ['webpubsub.sendToGroup', 'webpubsub.joinLeaveGroup'],
    userId: user,
  })

  res.send(token)
})

//
//
//
router.post('/api/createChat', async (req, res) => {
  const chatRequest = req.body

  const chatId = uuidv4()
  const chat = { id: chatId, name: chatRequest.name, members: {}, private: chatRequest.private }
  chatList[chatId] = chat

  serviceClient.sendToAll({
    chatEvent: 'chatCreated',
    data: JSON.stringify(chat),
  })

  res.status(200).json({ id: chatId })
  console.log(`### New chat ${chatRequest.name} was created`)
})

//
//
//
router.get('/api/chats', async (req, res) => {
  res.status(200).json({
    chats: chatList,
  })
})

//
//
//
router.get('/api/users', async (req, res) => {
  res.status(200).json({
    users: userList,
  })
})

module.exports = router
