import chat from './components/chat.js'
import utils from './utils.js'
import { getApiEndpoint } from './config.js'
import { toast } from 'https://cdn.jsdelivr.net/npm/bulma-toast@2.3.0/dist/bulma-toast.esm.js'

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
        // Main WebSocket instance
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

    async beforeMount() {
      // Get user details
      try {
        let userRes = await fetch(`/.auth/me`)
        if (!userRes.ok) {
          throw 'Got a non-200 from to call to /.auth/me'
        } else {
          // Get user details from clientPrincipal returned from SWA
          let userData = await userRes.json()
          // Handles rare case locally when using emulator
          if (!userData.clientPrincipal) {
            document.location.href = 'login.html'
            return
          }
          this.user = userData.clientPrincipal.userDetails
          this.isAzureStaticWebApp = true
        }
      } catch (err) {
        // When auth endpoint not available, like when local, fallback to a prompt :)
        const userName = prompt('What is your name')
        if (!userName) window.location.href = window.location.href
        this.user = userName
      }

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

        // Now connect to Azure Web PubSub using the URL we got
        this.ws = new WebSocket(token.url, 'json.webpubsub.azure.v1')
      } catch (err) {
        this.error = `💩 Failed to get data from the server (API_ENDPOINT='${API_ENDPOINT}'), it could be down. You could try refreshing the page 🤷‍♂️`
      }

      // Handle messages from server
      // this.ws.onmessage = (evt) => {
      this.ws.addEventListener('message', (evt) => {
        let msg = JSON.parse(evt.data)

        // System events
        if (msg.type === 'system' && msg.event === 'connected') {
          toast({
            message: `Connected to ${evt.origin}`,
            type: 'is-success',
            duration: 1500,
            animate: { in: 'fadeIn', out: 'fadeOut' },
          })
        }

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
          if (!chat.grabFocus) {
            toast({
              message: `💬 Incoming: ${chat.name}`,
              type: 'is-info',
              duration: 2500,
              animate: { in: 'fadeIn', out: 'fadeOut' },
            })
          }
          this.joinPrivateChat(chat.id, chat.name, chat.grabFocus)
        }
      })
    },

    methods: {
      //
      // Initiate a new group chat, opens the prompt
      //
      async newChat() {
        this.openNewChatDialog = true
        this.$nextTick(() => {
          this.$refs.newChatInput.focus()
        })
      },

      //
      // Called when new group chat dialog is accepted
      //
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

      //
      // Initiate a private chat with a remote user
      //
      async newPrivateChat(targetUser) {
        // Can't talk to yourself
        if (targetUser == this.user) return

        // Prevent starting chats with users if they are already open
        const openPrivateChats = Object.keys(this.joinedChats).filter((c) => c.startsWith('private_'))
        if (openPrivateChats.length > 0) {
          if (openPrivateChats.find((c) => c.includes(targetUser))) return
        }

        // Tell the server to notify both users of the chat request
        this.ws.send(
          JSON.stringify({
            type: 'event',
            event: 'createPrivateChat',
            dataType: 'json',
            data: { initiatorUserId: this.user, targetUserId: targetUser },
          })
        )
      },

      //
      // Join a group chat
      //
      async joinChat(chatId, chatName) {
        // Skip if we are already joined
        if (this.joinedChats[chatId]) return

        this.deactivateChats()
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

      //
      // On receipt of joinPrivateChat event, open the chat
      //
      joinPrivateChat(chatId, chatName, grabFocus) {
        // Skip if we are already joined
        if (this.joinedChats[chatId]) return
        this.$set(this.joinedChats, chatId, { id: chatId, name: chatName, active: grabFocus, unreadCount: 0 })
      },

      //
      // Switch chat tab
      //
      switchChat(evt) {
        const chatId = evt.target.getAttribute('data-chat-id')
        if (!this.joinedChats[chatId]) return
        this.deactivateChats()
        this.joinedChats[chatId].active = true
        this.joinedChats[chatId].unreadCount = 0
      },

      //
      // Deactivate all tabs
      //
      deactivateChats() {
        for (let chatId in this.joinedChats) {
          this.joinedChats[chatId].active = false
        }
      },

      //
      // Vue event handler when child chat component gets a message and is unfocused
      //
      onUnreadEvent(chatId) {
        this.joinedChats[chatId].unreadCount++
      },

      //
      // Vue event handler for when leave is clicked in child chat component
      //
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
    },
  })
}

// Have to have a synchronous wrapper, to allow getApiEndpoint to await
await startApp()
