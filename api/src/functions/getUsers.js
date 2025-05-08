//
// Chatr - API
// REST API to return all users, the route for this function is just `/api/users`
// Ben Coleman, 2021
//

import { app } from '@azure/functions'
import { listUsers } from '../state.js'

app.http('getUsers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'users',
  handler: async (req, context) => {
    const users = await listUsers()

    return { jsonBody: { users } }
  },
})
