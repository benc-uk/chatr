const { WebPubSubServiceClient } = require('@azure/web-pubsub')

const CONN_STR = process.env.PUBSUB_CONNECTION_STRING
const HUB = process.env.PUBSUB_HUB

module.exports = async function (context, req) {
  if (!CONN_STR || !HUB) {
    context.res = { status: 500, body: 'Must set PUBSUB_CONNECTION_STRING and PUBSUB_CONNECTION_HUB app settings / env vars' }
    context.done()
    return
  }

  const client = new WebPubSubServiceClient(CONN_STR, HUB)
  const userId = req.query.userId
  if (!userId) {
    context.res = { status: 400, body: 'Must pass userId on query string' }
    context.done()
    return
  }
  context.log(`### User: ${userId} requested a token to access hub: ${HUB}`)

  let token = await client.getAuthenticationToken({
    userId: userId,
    roles: ['webpubsub.sendToGroup', 'webpubsub.joinLeaveGroup'],
  })

  context.res = { body: token }
  context.done()
}
