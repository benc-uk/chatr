//
// Chatr - API
// REST API to return all chats, the route for this function is just `/api/chats`
// Ben Coleman, 2021
//

const state = require('../state')

module.exports = async function (context) {
  const chats = await state.listChats()

  context.res = {
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ chats }),
  }
}
