module.exports = async function (context, req) {
  context.res = {
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      API_ENDPOINT: process.env['API_ENDPOINT'] || '',
    }),
  }
}
