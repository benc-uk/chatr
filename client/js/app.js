import chat from './components/chat.js'
import utils from './utils.js'
import { getApiEndpoint } from './config.js'

let API_ENDPOINT

async function startApp() {
  // Has to be wrapped in an async function, can't use a Vue lifecycle hook
  // If we don't do this we get a race condition and the app might start before we have the API endpoint
  API_ENDPOINT = await getApiEndpoint()

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
        // Map of chat id to server chat objects, synced with the server
        allChats: {},
        // Map of users to server user objects, synced with the server
        allUsers: {},

        isAzureStaticWebApp: false,

        // Used by the modal dialog
        openNewChatDialog: false,
        newChatName: '',

        error: '',
      }
    },

    async mounted() {
      // Get user details
      let userRes = await fetch(`/.auth/me`)
      if (!userRes.ok) {
        // When auth endpoint not available, like when local, fallback to a prompt :)
        const userName = prompt('What is your name')
        if (!userName) window.location.href = window.location.href
        this.user = userName
      } else {
        let data = await userRes.json()
        this.user = data.clientPrincipal.userDetails
        this.isAzureStaticWebApp = true
      }
      console.log('### User id:', this.user)

      try {
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
      } catch (err) {
        this.error = `💩 Failed to get data from the server (API_ENDPOINT='${API_ENDPOINT}'), it could be down. You could try refreshing the page 🤷‍♂️`
      }

      // Handle messages from server
      this.ws.onmessage = (evt) => {
        let msg = JSON.parse(evt.data)

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
        if (msg.from === 'server' && msg.data.chatEvent === 'joinPrivateChat') {
          let chat = JSON.parse(msg.data.data)
          this.joinPrivateChat(chat.id, chat.name, chat.grabFocus)
        }
      }
    },

    methods: {
      async newChat() {
        this.openNewChatDialog = true
        this.$nextTick(() => {
          this.$refs.newChatInput.focus()
        })
      },

      async newPrivateChat(targetUser) {
        if (targetUser == this.user) return
        const openPrivateChats = Object.keys(this.joinedChats).filter((c) => c.startsWith('private_'))
        if (openPrivateChats.length > 0) {
          if (openPrivateChats.find((c) => c.includes(targetUser))) return
        }

        this.ws.send(
          JSON.stringify({
            type: 'event',
            event: 'createPrivateChat',
            dataType: 'json',
            data: { initiatorUserId: this.user, targetUserId: targetUser },
          })
        )
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

      joinPrivateChat(chatId, chatName, grabFocus) {
        // Skip if we are already joined
        if (this.joinedChats[chatId]) return
        this.$set(this.joinedChats, chatId, { id: chatId, name: chatName, active: grabFocus, unreadCount: 0 })
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
        console.log('LEAVING', chatId)
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

      newChatCreate() {
        this.openNewChatDialog = false
        const chatName = this.newChatName
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
        this.newChatName = ''
        this.deactivateChats()
        this.joinChat(chatId, chatName)
      },

      newChatCancel() {
        this.openNewChatDialog = false
        this.newChatName = ''
      },
    },
  })
}

// Have to have a synchronous wrapper, to allow getApiEndpoint to await
await startApp()
