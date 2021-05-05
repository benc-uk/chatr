module.exports = async function (context, connectionContext) {
  context.log(`############## ${context.bindingData.eventName}`)
  context.log(context.bindingData.hub)
  context.log(context.bindingData.userId)

  // !IMPORTANT! Without this, nothing will work and you will see no errors :/
  return {
    roles: ['webpubsub.sendToGroup', 'webpubsub.joinLeaveGroup'],
  }
}
