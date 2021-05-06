import { API_ENDPOINT } from '../app.js'

export default Vue.component('chat', {
  data() {
    return {
      chatText: '',
      message: '',
      ws: null,
      connected: false,
    }
  },

  props: {
    name: String,
    id: String,
    active: Boolean,
    user: String,
  },

  async mounted() {
    let res = await fetch(`${API_ENDPOINT}/api/getToken?userId=${this.user}`)
    let token = await res.json()
    this.appendChat(`📡 Connecting...`)

    this.ws = new WebSocket(token.url, 'json.webpubsub.azure.v1')

    this.ws.onmessage = (evt) => {
      //console.dir(evt.data)
      let msg = JSON.parse(evt.data)
      switch (msg.type) {
        case 'system': {
          if (msg.event === 'connected') {
            this.appendChat(`✨ Connected to ${evt.target.url.split('?')[0]}`)
            this.connected = true
          }
          if (msg.event === 'disconnected') {
            this.appendChat(`💥 Disconnected, reason was: ${msg.message}`)
          }
          break
        }

        case 'message': {
          // Pretty important otherwise we show messages from all chats !
          if (msg.group !== this.id) break
          if (msg.data.message && msg.data.user) {
            this.appendChat(`<b>${msg.data.user}:</b> ${msg.data.message}`)
            break
          }
          this.appendChat(msg.data)
          break
        }
      }
    }
  },

  methods: {
    appendChat(text) {
      this.chatText += `${text}<br/>`

      Vue.nextTick(() => {
        if (this.$refs['chatBox']) {
          this.$refs['chatBox'].scrollTop = this.$refs['chatBox'].scrollHeight
        }
      })

      if (!this.active) this.$emit('unread', this.id)
    },

    sendMessage() {
      if (!this.message) return
      this.ws.send(
        JSON.stringify({
          type: 'sendToGroup',
          group: this.id,
          dataType: 'json',
          data: {
            message: this.message,
            user: this.user,
          },
        })
      )
      this.message = ''
    },
  },

  template: `
  <div class="container chatComponent" v-show="active">
    <div class="is-flex">
      <input class="chatInput input" v-on:keyup.enter="sendMessage" v-show="connected" placeholder="What do you want to say?" v-model="message"></input>
      &nbsp;
      <button class="button is-success" @click="sendMessage"><i class="fas fa-share"></i><span class="is-hidden-mobile">&nbsp; Send</span></button>
      &nbsp;&nbsp;&nbsp;
      <button class="button is-warning" @click="$emit('leave', id)"><i class="far fa-times-circle"></i><span class="is-hidden-mobile">&nbsp; Leave</span></button>
    </div>

    <div class="chatBox" contentEditable="false" readonly v-html="chatText" ref="chatBox"></div> 
  </div>`,
})
