//
// Chatr - API
// State management and persistence backed with Azure Table storage
// Ben Coleman, 2021
//

const { TableServiceClient, TableClient } = require('@azure/data-tables')
const { DefaultAzureCredential } = require('@azure/identity')

const account = process.env.STORAGE_ACCOUNT_NAME
const accountKey = process.env.STORAGE_ACCOUNT_KEY
const chatsTable = 'chats'
const usersTable = 'users'
const partitionKey = 'chatr'

if (!account || !accountKey) {
  console.log('### 💥 Fatal! STORAGE_ACCOUNT_NAME and/or STORAGE_ACCOUNT_KEY is not set')
}

const credential = new DefaultAzureCredential()
const serviceClient = new TableServiceClient(`https://${account}.table.core.windows.net`, credential)
const userTableClient = new TableClient(`https://${account}.table.core.windows.net`, usersTable, credential)
const chatTableClient = new TableClient(`https://${account}.table.core.windows.net`, chatsTable, credential)

// ==============================================================
// Create tables and absorb errors if they already exist
// ==============================================================
async function initTables() {
  console.log(`### 📭 Connected to Azure table storage: ${account}`)

  try {
    await serviceClient.createTable(chatsTable)
  } catch (err) {
    if (err.statusCode == 409) console.log(`### 🆗 Table ${chatsTable} already exists, that's OK`)
  }
  try {
    await serviceClient.createTable(usersTable)
  } catch (err) {
    if (err.statusCode == 409) console.log(`### 🆗 Table ${usersTable} already exists, that's OK`)
  }
}

// ==============================================================
// Called when module is imported
// ==============================================================
initTables()

// ==============================================================
// Chat state functions
// ==============================================================
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
  let chatList = chatTableClient.listEntities()

  for await (const chat of chatList) {
    let chatObj = JSON.parse(chat.data)
    // Timestamp only used by cleanup script
    chatObj.timestamp = chat.timestamp
    chatsResp[chat.rowKey] = chatObj
  }
  return chatsResp
}

// ==============================================================
// User state functions
// ==============================================================
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
  let userList = userTableClient.listEntities()

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

// ==============================================================
// Export functions into module scope
// ==============================================================
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
