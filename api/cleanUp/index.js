//
// Chatr - API
// REST API to clean up state, old removes chats and users
// Ben Coleman, 2021
//

module.exports = async function (context) {
  context.res = {
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ok: true }),
  }
}
