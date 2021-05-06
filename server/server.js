require('dotenv').config()

const express = require('express')
const pubSubHandler = require('./pubsub').handler
const cors = require('cors')
const app = express()
const packageJson = require('./package.json')

// Plugin the event handler routes
app.use(pubSubHandler.getMiddleware())

// Important when we're accessed via a tunnel
app.use(cors())

// REST API for some tasks
app.use('/', require('./api'))

let PORT = process.env['PORT'] || '3000'
app.use(express.static('../client'))
app.listen(parseInt(PORT), () => console.log(`### Chatr server v${packageJson.version} started on ${PORT}`))
