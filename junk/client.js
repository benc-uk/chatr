const GROUP = `globalChat`

async function main() {
  let res = await fetch('/getToken')
  let token = await res.json()
  appendChat(`💡 Connecting...`)

  let ws = new WebSocket(token.url, 'json.webpubsub.azure.v1')
  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        type: 'joinGroup',
        group: GROUP,
      })
    )
  }

  ws.onmessage = (evt) => {
    let msg = JSON.parse(evt.data)
    switch (msg.type) {
      case 'system': {
        if (msg.event === 'connected') {
          appendChat(`✨ Connected to ${evt.target.url.split('?')[0]}`)
        }
        if (msg.event === 'disconnected') {
          appendChat(`💥 Disconnected, reason was: ${msg.message}`)
        }
        break
      }

      case 'message': {
        appendChat(msg.data)
        break
      }
    }
  }

  ws.onerror = (evt) => {
    console.error(evt)
  }

  ws.onclose = (evt) => {
    console.error(evt)
  }

  let messageBox = document.querySelector('#message')
  messageBox.addEventListener('keypress', (evt) => {
    if (evt.key === 'Enter') {
      let text = messageBox.value
      ws.send(
        JSON.stringify({
          type: 'sendToGroup',
          group: GROUP,
          dataType: 'text',
          data: text,
        })
      )
      messageBox.value = ''
    }
  })
}

function appendChat(text) {
  let chat = document.querySelector('#chat')
  chat.value += `${text}\n`
  chat.scrollTop = chat.scrollHeight
}

main()
