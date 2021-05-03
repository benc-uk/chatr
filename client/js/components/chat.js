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
    group: String,
    active: Boolean,
  },

  async mounted() {
    let res = await fetch(`${API_ENDPOINT}/api/getToken?userid=DaveDemo`)
    let token = await res.json()
    this.appendChat(`💡 Connecting...`)

    this.ws = new WebSocket(token.url, 'json.webpubsub.azure.v1')
    this.ws.onopen = () => {
      this.ws.send(
        JSON.stringify({
          type: 'joinGroup',
          group: this.group,
        })
      )
    }

    this.ws.onmessage = (evt) => {
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
          this.appendChat(msg.data)
          break
        }
      }
    }
  },

  methods: {
    appendChat(text) {
      this.chatText += `${text}\n`
    },

    sendMessage() {
      this.ws.send(
        JSON.stringify({
          type: 'sendToGroup',
          group: this.group,
          dataType: 'text',
          data: this.message,
        })
      )
      this.message = ''
    },

    testMessage() {
      this.ws.send(
        JSON.stringify({
          type: 'event',
          event: 'newChat',
          dataType: 'text',
          data: 'test message hello',
        })
      )
    },
  },

  template: `
  <div class="container" v-show="active">
  
    <button @click="testMessage()" class="button is-primary">SEND TO SERVER</button>

    <input class="chatInput" v-on:keyup.enter="sendMessage" v-show="connected" placeholder="What do you want to say?" v-model="message"></input>
    <textarea class="chatBox" readonly>{{ chatText }}</textarea> 
  </div>`,
})
