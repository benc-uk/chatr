const state = require('../state')

module.exports = async function (context, req) {
  const users = await state.listUsers()

  context.res = {
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ users }),
  }
}
