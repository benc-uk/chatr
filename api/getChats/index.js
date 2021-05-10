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
