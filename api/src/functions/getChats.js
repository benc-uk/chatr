//
// Chatr - API
// REST API to return all chats, the route for this function is just `/api/chats`
// Ben Coleman, 2021
//

import { app } from '@azure/functions'
import { listChats } from '../state.js'

app.http('getChats', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'chats',
  handler: async (req, context) => {
    const chats = await listChats()

    return { jsonBody: { chats } }
  },
})
