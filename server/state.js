const { TableServiceClient, TablesSharedKeyCredential, TableClient } = require('@azure/data-tables')

const account = process.env.STORAGE_ACCOUNT_NAME
const accountKey = process.env.STORAGE_ACCOUNT_KEY
const chatsTable = 'chats'
const usersTable = 'users'
const partitionKey = 'chatr'

if (!account || !accountKey) {
  console.log('### Fatal! STORAGE_ACCOUNT_NAME and/or STORAGE_ACCOUNT_KEY is not set, exiting now')
  process.exit(2)
}

const credential = new TablesSharedKeyCredential(account, accountKey)
const serviceClient = new TableServiceClient(`https://${account}.table.core.windows.net`, credential)
const userTableClient = new TableClient(`https://${account}.table.core.windows.net`, usersTable, credential)
const chatTableClient = new TableClient(`https://${account}.table.core.windows.net`, chatsTable, credential)

async function initTables() {
  console.log(`### Connected to Azure table storage: ${account}`)

  try {
    await serviceClient.createTable(chatsTable)
  } catch (err) {
    if (err.statusCode == 409) console.log(`### Table ${chatsTable} already exists, that's OK`)
  }
  try {
    await serviceClient.createTable(usersTable)
  } catch (err) {
    if (err.statusCode == 409) console.log(`### Table ${usersTable} already exists, that's OK`)
  }
}

initTables()

async function upsertChat(id, chat) {
  const chatEntity = {
    partitionKey: partitionKey,
    rowKey: id,
    data: JSON.stringify(chat),
  }
  await chatTableClient.upsertEntity(chatEntity, 'Replace')
}

async function removeChat(id) {
  try {
    await chatTableClient.deleteEntity(partitionKey, id)
  } catch (e) {
    console.log('### Delete chat failed')
  }
}

async function getChat(id) {
  try {
    const chatEntity = await chatTableClient.getEntity(partitionKey, id)

    return JSON.parse(chatEntity.data)
  } catch (err) {
    return null
  }
}

async function listChats() {
  let chatsResp = {}
  let chatList = await chatTableClient.listEntities()
  if (!chatList) return {}

  for (const chat of chatList) {
    chatsResp[chat.rowKey] = JSON.parse(chat.data)
  }
  return chatsResp
}

async function upsertUser(id, user) {
  const userEntity = {
    partitionKey: partitionKey,
    rowKey: id,
    ...user,
  }
  await userTableClient.upsertEntity(userEntity, 'Replace')
}

async function removeUser(id) {
  try {
    await userTableClient.deleteEntity(partitionKey, id)
  } catch (e) {
    console.log('### Delete user failed')
  }
}

async function listUsers() {
  let usersResp = {}
  let userList = await userTableClient.listEntities()
  if (!userList) return {}
  for await (const user of userList) {
    usersResp[user.rowKey] = user
  }
  return usersResp
}

async function getUser(id) {
  try {
    const user = await userTableClient.getEntity(partitionKey, id)
    return user
  } catch (err) {
    return null
  }
}

module.exports = {
  upsertChat,
  removeChat,
  getChat,
  listChats,

  upsertUser,
  removeUser,
  getUser,
  listUsers,
}
