require('dotenv').config()

const express = require('express')
const { WebPubSubServiceClient } = require('@azure/web-pubsub')

let CONN_STR = process.env['CONN_STR']
let HUB = process.env['HUB'] || 'chat'
if (!CONN_STR) {
  console.log('### Fatal! CONN_STR is not set, exiting now')
  process.exit(2)
}

let serviceClient = new WebPubSubServiceClient(CONN_STR, HUB)
const app = express()

app.get('/getToken', async (req, res) => {
  console.log(`### Token requested from client ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}`)

  let token = await serviceClient.getAuthenticationToken({
    // !IMPORTANT! Without these roles nothing works and you get no errors
    roles: ['webpubsub.sendToGroup', 'webpubsub.joinLeaveGroup'],
  })

  res.send(token)
})

let PORT = process.env['PORT'] || '3000'
app.use(express.static('public'))
app.listen(parseInt(PORT), () => console.log(`### Server started on ${PORT}`))
