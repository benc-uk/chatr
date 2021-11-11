#!node
const state = require('../api/state')

const DELETE_AGE = process.argv[2] !== undefined ? parseInt(process.argv[2]) : 24
console.log(`### Deleting data older than ${DELETE_AGE} hours`)

console.log('### Cleaning up old users')
state.listUsers().then((users) => {
  for (let userId in users) {
    const user = users[userId]

    const timestamp = new Date(user.timestamp)
    const now = new Date()
    const ageInHours = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60)

    if (ageInHours > DELETE_AGE) {
      console.log(`### Deleting user ${user.userName} with age of ${ageInHours} hours`)
      state.removeUser(userId)
    }
  }
})

console.log('### Cleaning up old chats')
state.listChats().then((chats) => {
  for (let chatId in chats) {
    const chat = chats[chatId]

    const timestamp = new Date(chat.timestamp)
    const now = new Date()
    const ageInHours = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60)

    if (ageInHours > DELETE_AGE) {
      console.log(`### Deleting chat ${chat.name} with age of ${ageInHours} hours`)
      state.removeChat(chatId)
    }
  }
})
