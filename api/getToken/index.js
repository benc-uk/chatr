module.exports = function (context, req, tokenDetails) {
  context.res = { body: tokenDetails }
  context.done()
}
