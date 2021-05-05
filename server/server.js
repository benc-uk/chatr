require('dotenv').config()

const express = require('express')
const pubSubHandler = require('./pubsub').handler
const cors = require('cors')
const app = express()

// Important when we're accessed via a tunnel

// Plugin the event handler routes
app.use(pubSubHandler.getMiddleware())

app.use(cors())

// REST API for some tasks
app.use('/', require('./api'))

let PORT = process.env['PORT'] || '3000'
app.use(express.static('../client'))
app.listen(parseInt(PORT), () => console.log(`### Server started on ${PORT}`))
