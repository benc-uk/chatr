import chat from './components/chat.js'
import utils from './utils.js'
import Vue from 'https://cdn.jsdelivr.net/npm/vue@2.6.14/dist/vue.esm.browser.js'

const MAX_IDLE_TIME = 60

// eslint-disable-next-line
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
      // Toggle to see if user is online
      online: false,
      // User object which is an instance of SWA clientPrincipal
      // See https://docs.microsoft.com/en-us/azure/static-web-apps/user-information?tabs=javascript#client-principal-data
      user: {},
      // Map of chat id to server chat objects, synced with the server
      allChats: {},
      // Map of users to server user objects, synced with the server
      allUsers: {},
      // Are we running in a SWA
      isAzureStaticWebApp: false,
      // Used to handle idle detection
      idle: false,
      idleTime: 0,
      // Used by the ne chat modal dialog
      openNewChatDialog: false,
      newChatName: '',
      error: '',
    }
  },

  async beforeMount() {
    // Set up handlers and timer interval for idle time detection
    document.onmousemove = this.resetIdle
    document.onkeydown = this.resetIdle
    setInterval(this.idleChecker, 1000)

    // Get user details from special SWA auth endpoint
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
        this.user = userData.clientPrincipal
        this.isAzureStaticWebApp = true
      }
    } catch (err) {
      // When auth endpoint not available, fallback to a prompt and fake clientPrincipal data
      // In reality this is not really need anymore as we use the SWA emulator
      const userName = prompt('Please set your user name')
      // eslint-disable-next-line
      if (!userName) window.location.href = window.location.href
      this.user = {
        userId: utils.hashString(userName),
        userDetails: userName,
        identityProvider: 'fake',
      }
    }

    try {
      // Get all existing chats from server
      let res = await fetch(`/api/chats`)
      if (!res.ok) throw `chats error: ${await res.text()}`
      let data = await res.json()
      this.allChats = data.chats

      // Get all existing users from server
      res = await fetch(`/api/users`)
      if (!res.ok) throw `users error: ${await res.text()}`
      data = await res.json()
      this.allUsers = data.users

      // Get URL & token to connect to Azure Web Pubsub
      res = await fetch(`/api/getToken?userId=${this.user.userId}`)
      if (!res.ok) throw `getToken error: ${await res.text()}`
      let token = await res.json()

      // Now connect to Azure Web PubSub using the URL we got
      this.ws = new WebSocket(token.url, 'json.webpubsub.azure.v1')

      // Both of these handle error situations
      this.ws.onerror = (evt) => {
        this.error = `WebSocket error ${evt.message}`
      }
      this.ws.onclose = (evt) => {
        this.error = `WebSocket closed, code: ${evt.code}`
      }

      // Custom notification event, rather that relying on the system connected event
      this.ws.onopen = () => {
        this.ws.send(
          JSON.stringify({
            type: 'event',
            event: 'userConnected',
            dataType: 'json',
            data: { userName: this.user.userDetails, userProvider: this.user.identityProvider },
          })
        )
      }
    } catch (err) {
      console.error(`API ERROR: ${err}`)
      this.error = `💩 Failed to get data from the server ${err}, it could be down. You could try refreshing the page 🤷‍♂️`
      return
    }

    // Handle messages from server
    this.ws.addEventListener('message', (evt) => {
      let msg = JSON.parse(evt.data)

      // System events
      if (msg.type === 'system' && msg.event === 'connected') {
        utils.toastMessage(`🔌 Connected to ${evt.origin.replace('wss://', '')}`, 'success')
      }

      // Server events
      if (msg.from === 'server' && msg.data.chatEvent === 'chatCreated') {
        let chat = JSON.parse(msg.data.data)
        this.$set(this.allChats, chat.id, chat)

        this.$nextTick(() => {
          const chatList = this.$refs.chatList
          chatList.scrollTop = chatList.scrollHeight
        })
      }

      if (msg.from === 'server' && msg.data.chatEvent === 'chatDeleted') {
        let chatId = msg.data.data
        this.$delete(this.allChats, chatId)
        if (this.joinedChats[chatId]) {
          utils.toastMessage(`💥 Chat deleted by owner, you have been removed!`, 'danger')
          this.onLeaveEvent(chatId)
        }
      }

      if (msg.from === 'server' && msg.data.chatEvent === 'userOnline') {
        let newUser = JSON.parse(msg.data.data)
        // If the new user is ourselves, that means we're connected and online
        if (newUser.userId == this.user.userId) {
          this.online = true
        } else {
          utils.toastMessage(`🤩 ${newUser.userName} has just joined`, 'success')
        }
        this.$set(this.allUsers, newUser.userId, newUser)
      }

      if (msg.from === 'server' && msg.data.chatEvent === 'userOffline') {
        let userId = msg.data.data
        let userName = this.allUsers[userId].userName
        this.$delete(this.allUsers, userId)
        utils.toastMessage(`💨 ${userName} has left or logged off`, 'warning')
      }

      if (msg.from === 'server' && msg.data.chatEvent === 'joinPrivateChat') {
        let chat = JSON.parse(msg.data.data)
        if (!chat.grabFocus) {
          utils.toastMessage(`💬 Incoming: ${chat.name}`, 'warning')
        }
        this.joinPrivateChat(chat.id, chat.name, chat.grabFocus)
      }

      if (msg.from === 'server' && msg.data.chatEvent === 'userIsIdle') {
        let userId = msg.data.data
        this.$set(this.allUsers, userId, { ...this.allUsers[userId], idle: true })
        utils.toastMessage(`💤 User ${this.allUsers[userId].userName} is now idle`, 'link')
      }

      if (msg.from === 'server' && msg.data.chatEvent === 'userNotIdle') {
        let userId = msg.data.data
        this.$set(this.allUsers, userId, { ...this.allUsers[userId], idle: false })
        utils.toastMessage(`🤸‍♂️ User ${this.allUsers[userId].userName} has returned`, 'link')
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
      if (targetUser == this.user.userId) return

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
          data: { initiatorUserId: this.user.userId, targetUserId: targetUser },
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

      // If grabbing focus means we should deactivate current chat
      if (grabFocus) this.deactivateChats()
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
      this.$delete(this.joinedChats, chatId)
      this.ws.send(
        JSON.stringify({
          type: 'event',
          event: 'leaveChat',
          dataType: 'json',
          data: { chatId, userName: this.user.userDetails },
        })
      )

      const firstChat = this.joinedChats[Object.keys(this.joinedChats)[0]]
      if (firstChat) {
        firstChat.active = true
      }
    },

    //
    // Used to detect idle time and reset it on any activity
    //
    resetIdle() {
      if (this.idle) {
        this.ws.send(
          JSON.stringify({
            type: 'event',
            event: 'userExitIdle',
            dataType: 'text',
            data: this.user.userId,
          })
        )
      }
      this.idle = false
      this.idleTime = 0
    },

    //
    // Called every 1 second to check for idle time
    //
    idleChecker() {
      this.idleTime += 1
      if (this.idleTime > MAX_IDLE_TIME && !this.idle) {
        this.idle = true
        this.ws.send(
          JSON.stringify({
            type: 'event',
            event: 'userEnterIdle',
            dataType: 'text',
            data: this.user.userId,
          })
        )
      }
    },

    //
    // Remove a chat if you are the owner
    //
    deleteChat(chatId) {
      this.ws.send(
        JSON.stringify({
          type: 'event',
          event: 'deleteChat',
          dataType: 'text',
          data: chatId,
        })
      )
    },
  },
})
