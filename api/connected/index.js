module.exports = async function (context, connectionContext) {
  // !IMPORTANT! Without this, nothing will work and you will see no errors :/
  return {
    roles: ['webpubsub.sendToGroup', 'webpubsub.joinLeaveGroup'],
  }
}
