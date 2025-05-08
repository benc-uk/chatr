//
// Chatr - API
// REST API to return all chats, the route for this function is just `/api/chats`
// Ben Coleman, 2021 - 2025
//

import { app } from '@azure/functions'
import { listChats } from '../state.js'

app.http('chats', {
  methods: ['GET'],
  authLevel: 'anonymous',

  handler: async () => {
    try {
      const chats = await listChats()

      return { jsonBody: { chats } }
    } catch (error) {
      console.error('Error fetching chats:', error.statusCode ?? 0, error.message ?? 'Unknown error')
      return { status: error.statusCode ?? 500, body: error }
    }
  },
})
