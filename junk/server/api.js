const express = require('express')
const router = express.Router()

const { listUsers, listChats } = require('./state')

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
router.get('/api/chats', async (req, res) => {
  let chats = await listChats()
  res.status(200).json({
    chats,
  })
})

//
//
//
router.get('/api/users', async (req, res) => {
  let users = await listUsers()
  res.status(200).json({
    users,
  })
})

module.exports = router
