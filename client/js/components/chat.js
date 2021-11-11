import Vue from 'https://cdn.jsdelivr.net/npm/vue@2.6.14/dist/vue.esm.browser.js'

// eslint-disable-next-line no-undef
export default Vue.component('chat', {
  data() {
    return {
      chatText: '',
      message: '',
      connected: false,
      chatBubbles: [],
    }
  },

  props: {
    name: String,
    id: String,
    active: Boolean,
    user: Object,
    // This is shared with the parent app component
    ws: WebSocket,
  },

  async mounted() {
    // Use addEventListener to not overwrite the existing listeners
    this.ws.addEventListener('message', (evt) => {
      let msg = JSON.parse(evt.data)

      switch (msg.type) {
        case 'message': {
          // Pretty important otherwise we show messages from all chats !
          if (msg.group !== this.id) break

          // User sent messages, i.e. from sendMessage() below
          if (msg.data.message && msg.data.fromUserName) {
            //this.appendChat(`<b>${msg.data.fromUserName}:</b> ${msg.data.message}`)
            this.appendChat(msg.data.message, msg.data.fromUserName)
            break
          }

          // Other messages from the server etc
          this.appendChat(msg.data, '')
          break
        }
      }
    })
  },

  updated() {
    if (this.active) {
      this.$refs.chatInput.focus()
    }
  },

  methods: {
    appendChat(text, from) {
      //this.chatText += `${text}<br/>`

      this.chatBubbles.push({
        text,
        from,
        time: new Date(),
      })

      // eslint-disable-next-line no-undef
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
            fromUserId: this.user.userId,
            fromUserName: this.user.userDetails,
          },
        })
      )
      this.message = ''
    },
  },

  template: `
  <div class="container chatComponent" v-show="active">
    <div class="is-flex">
      <input class="chatInput input" ref="chatInput" v-on:keyup.enter="sendMessage" v-show="ws && ws.readyState === 1" placeholder="What do you want to say?" v-model="message"></input>
      &nbsp;
      <button class="button is-success" @click="sendMessage" v-show="ws && ws.readyState === 1"><i class="fas fa-share"></i><span class="is-hidden-mobile">&nbsp; Send</span></button>
      &nbsp;&nbsp;&nbsp;
      <button class="button is-warning" @click="$emit('leave', id)"><i class="far fa-times-circle"></i><span class="is-hidden-mobile">&nbsp; Leave</span></button>
    </div>

    <div class="chatBox" contentEditable="false" readonly ref="chatBox">
      <div v-for="chatBubble of chatBubbles" class="bubbleWrap" :class="{chatSelf: user.userDetails == chatBubble.from}"> 
        <div class="card m-3 p-2 chatBubble">
          <div class="chatBubbleTitle text-info" v-if="chatBubble.from" >{{ chatBubble.from }}</div>
          <div class="chatBubbleBody" v-html="chatBubble.text"></div>
        </div>
      </div>
    </div> 
  </div>`,
})
