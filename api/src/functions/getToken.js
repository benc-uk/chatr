//
// Chatr - API
// REST API to get an access token and URL so that clients can connect to Azure PubSub websocket
// Ben Coleman, 2021 - 2025
//

import { WebPubSubServiceClient } from '@azure/web-pubsub'
import { DefaultAzureCredential } from '@azure/identity'
import { app } from '@azure/functions'

const hubName = process.env.PUBSUB_HUB
const endpoint = process.env.PUBSUB_ENDPOINT

app.http('getToken', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (req, context) => {
    if (!hubName || !endpoint) {
      context.log('### ERROR! Must set PUBSUB_HUB & PUBSUB_ENDPOINT in app settings / env vars')
      return { status: 500, body: 'ERROR! Must set PUBSUB_HUB & PUBSUB_ENDPOINT in app settings / env vars' }
    }

    const credentials = new DefaultAzureCredential()
    const client = new WebPubSubServiceClient(endpoint, credentials, hubName)
    const userId = req.query.get('userId')
    if (!userId) {
      return { status: 400, body: 'Must pass userId on query string' }
    }

    context.log(`### User: ${userId} requested a token to access hub: ${hubName}`)
    const token = await client.getClientAccessToken({
      userId: userId,
      roles: ['webpubsub.sendToGroup', 'webpubsub.joinLeaveGroup'],
    })

    if (token) context.log(`### Token obtained for user: ${userId}`)

    return { jsonBody: token }
  },
})
