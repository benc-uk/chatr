// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

module.exports = async function (context, message) {
  context.log('==============================')
  console.log('NEW CHAT EVENT from:', context.bindingData.connectionContext.userId)
  //console.log('Request message binding: ', context)
  context.log('=================================')
  //context.done()
}
