//
// Chatr - API
// State management and persistence backed with Azure Table storage
// Ben Coleman, 2021 - 2025
//

import { TableServiceClient, TableClient } from '@azure/data-tables'
import { DefaultAzureCredential } from '@azure/identity'

const account = process.env.STORAGE_ACCOUNT_NAME
const chatsTable = 'chats'
const usersTable = 'users'
const partitionKey = 'chatr'

if (!account) {
  console.log('### 💥 Fatal! STORAGE_ACCOUNT_NAME is not set')
}

const credential = new DefaultAzureCredential()
console.log(`### 📭 Using Azure Storage account: ${credential}`)
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
export async function upsertChat(id, chat) {
  const chatEntity = {
    partitionKey: partitionKey,
    rowKey: id,
    data: JSON.stringify(chat),
  }
  await chatTableClient.upsertEntity(chatEntity, 'Replace')
}

export async function removeChat(id) {
  try {
    await chatTableClient.deleteEntity(partitionKey, id)
  } catch (e) {
    console.log('### Delete chat failed')
  }
}

export async function getChat(id) {
  try {
    const chatEntity = await chatTableClient.getEntity(partitionKey, id)

    return JSON.parse(chatEntity.data)
  } catch (err) {
    return null
  }
}

export async function listChats() {
  const chatsResp = {}
  const chatList = chatTableClient.listEntities()

  for await (const chat of chatList) {
    const chatObj = JSON.parse(chat.data)
    // Timestamp only used by cleanup script
    chatObj.timestamp = chat.timestamp
    chatsResp[chat.rowKey] = chatObj
  }

  return chatsResp
}

// ==============================================================
// User state functions
// ==============================================================
export async function upsertUser(id, user) {
  const userEntity = {
    partitionKey: partitionKey,
    rowKey: id,
    ...user,
  }
  await userTableClient.upsertEntity(userEntity, 'Replace')
}

export async function removeUser(id) {
  try {
    await userTableClient.deleteEntity(partitionKey, id)
  } catch (e) {
    console.log('### Delete user failed')
  }
}

export async function listUsers() {
  const usersResp = {}
  const userList = userTableClient.listEntities()

  for await (const user of userList) {
    usersResp[user.rowKey] = user
  }
  return usersResp
}

export async function getUser(id) {
  try {
    const user = await userTableClient.getEntity(partitionKey, id)
    return user
  } catch (err) {
    return null
  }
}
