import chat from './components/chat.js'

new Vue({
  el: '#app',

  components: { chat: chat },

  data() {
    return {
      // Array of chat objects, e.g. { name: 'blah', active: true }
      chats: [],
    }
  },

  methods: {
    addChat() {
      this.deactivateChats()
      this.chats.push({ name: `Chat ${this.chats.length + 1}`, active: true })
    },

    switchChat(evt) {
      const chatName = evt.target.getAttribute('data-chat-name')
      this.deactivateChats()
      this.chats.find((c) => c.name === chatName).active = true
    },

    deactivateChats() {
      for (let chat of this.chats) {
        chat.active = false
      }
    },
  },
})
