// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

module.exports = async function (context, message, connectionContext) {
  context.log('==============================')
  console.log('Request from:', context.bindingData.connectionContext.userId)
  console.log('Request message:', message)
  console.log('Request message dataType:', context.bindingData.dataType)
  //console.log('Request message binding: ', context)
  context.log('=================================')
  //context.done()
}
