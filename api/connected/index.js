module.exports = async function (context, connectionContext) {
  console.log('############## CONNECTED')
  console.log(context)
  // !IMPORTANT! Without this, nothing will work and you will see no errors :/
  return {
    roles: ['webpubsub.sendToGroup', 'webpubsub.joinLeaveGroup'],
  }
}
