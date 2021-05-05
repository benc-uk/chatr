import chat from './components/chat.js'
import utils from './utils.js'

new Vue({
  el: '#app',

  components: { chat: chat },

  data() {
    return {
      // Map of joined chats, using id as key
      // values are client side chat objects -> { id: string, name: string, active: bool, unreadCount: int }
      joinedChats: {},
      ws: null,
      user: false,
      allChats: {},
      // Map of chat id to server chat objects, synced with the server
      allUsers: {},
      isAzureStaticWebApp: false,
    }
  },

  async mounted() {
    // Get user details
    let userRes = await fetch(`/.auth/me`)
    if (!userRes.ok) {
      // Todo replace with prompt or get from auth system
      const userName = prompt('What is your name')
      if (!userName) window.location.href = window.location.href
      this.user = userName
    } else {
      let data = await userRes.json()
      this.user = data.clientPrincipal.userDetails
      this.isAzureStaticWebApp = true
    }
    console.log('### USER IS:', this.user)

    // Get all existing chats from server
    let res = await fetch(`${API_ENDPOINT}/api/chats`)
    let data = await res.json()
    this.allChats = data.chats

    // Get all existing users from server
    res = await fetch(`${API_ENDPOINT}/api/users`)
    data = await res.json()
    this.allUsers = data.users

    // Get URL & token to connect to Azure Web Pubsub
    res = await fetch(`${API_ENDPOINT}/api/getToken?userId=${this.user}`)
    let token = await res.json()

    // Now connect to Azure Web PubSub
    this.ws = new WebSocket(token.url, 'json.webpubsub.azure.v1')

    // Handle messages from server
    this.ws.onmessage = (evt) => {
      let msg = JSON.parse(evt.data)
      // console.log('============= onmessage app.js')
      // console.log(msg)

      // Server events
      if (msg.from === 'server' && msg.data.chatEvent === 'chatCreated') {
        let chat = JSON.parse(msg.data.data)
        this.$set(this.allChats, chat.id, { name: chat.name })
      }
      if (msg.from === 'server' && msg.data.chatEvent === 'chatDeleted') {
        let chat = JSON.parse(msg.data.data)
        this.$delete(this.allChats, chat.id)
      }
      if (msg.from === 'server' && msg.data.chatEvent === 'userOnline') {
        let userName = msg.data.data
        this.$set(this.allUsers, userName, {})
      }
      if (msg.from === 'server' && msg.data.chatEvent === 'userOffline') {
        let userName = msg.data.data
        this.$delete(this.allUsers, userName)
      }
    }
  },

  methods: {
    async newChat() {
      let chatName = prompt('Name this new chat') //`chat ${Math.floor(Math.random() * 50)}`#
      if (!chatName) return

      const chatId = utils.uuidv4()
      this.ws.send(
        JSON.stringify({
          type: 'event',
          event: 'createChat',
          dataType: 'json',
          data: { name: chatName, id: chatId },
        })
      )
      this.deactivateChats()
      this.joinChat(chatId, chatName)
    },

    async joinChat(chatId, chatName = null) {
      // Skip if we are already joined
      if (this.joinedChats[chatId]) return

      this.deactivateChats()
      // Lookup name
      if (!chatName) chatName = this.allChats[chatId].name
      this.$set(this.joinedChats, chatId, { id: chatId, name: chatName, active: true, unreadCount: 0 })

      this.ws.send(
        JSON.stringify({
          type: 'event',
          event: 'joinChat',
          dataType: 'text',
          data: chatId,
        })
      )
    },

    switchChat(evt) {
      const chatId = evt.target.getAttribute('data-chat-id')
      if (!this.joinedChats[chatId]) return
      this.deactivateChats()
      this.joinedChats[chatId].active = true
      this.joinedChats[chatId].unreadCount = 0
    },

    deactivateChats() {
      for (let chatId in this.joinedChats) {
        this.joinedChats[chatId].active = false
      }
    },

    onUnreadEvent(chatId) {
      this.joinedChats[chatId].unreadCount++
    },

    onLeaveEvent(chatId) {
      this.$delete(this.joinedChats, chatId)
      this.ws.send(
        JSON.stringify({
          type: 'event',
          event: 'leaveChat',
          dataType: 'text',
          data: chatId,
        })
      )

      const firstChat = this.joinedChats[Object.keys(this.joinedChats)[0]]
      if (firstChat) {
        firstChat.active = true
      }
    },
  },
})
