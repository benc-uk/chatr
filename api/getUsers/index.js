//
// Chatr - API
// REST API to return all users, the route for this function is just `/api/users`
// Ben Coleman, 2021
//

const state = require('../state')

module.exports = async function (context) {
  const users = await state.listUsers()

  context.res = {
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ users }),
  }
}
