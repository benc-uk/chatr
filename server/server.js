require('dotenv').config()

const express = require('express')
const pubSubHandler = require('./pubsub').handler
const app = express()

// Plugin the event handler routes
app.use(pubSubHandler.getMiddleware())

// REST API for some tasks
app.use('/', require('./api'))

let PORT = process.env['PORT'] || '3000'
app.use(express.static('../client'))
app.listen(parseInt(PORT), () => console.log(`### Server started on ${PORT}`))
