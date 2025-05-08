//
// Chatr - API
// REST API to return all users, the route for this function is just `/api/users`
// Ben Coleman, 2021 - 2025
//

import { app } from '@azure/functions'
import { listUsers } from '../state.js'

app.http('users', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async () => {
    try {
      const users = await listUsers()

      return { jsonBody: { users } }
    } catch (error) {
      console.error('Error fetching users:', error.statusCode ?? 0, error.message ?? 'Unknown error')
      return { status: error.statusCode ?? 500, body: error }
    }
  },
})
