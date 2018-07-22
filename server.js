'use strict';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const request = require('request')
const express = require('express')
const body_parser = require('body-parser')
const app = express().use(body_parser.json())

app.listen(process.env.PORT || 5000, () => console.log('Webhook is listening on port 5000'));

app.post('/webhook', (req, res) => {  
  let body = req.body;
  if (body.object === 'page') {
    body.entry.forEach(function(entry) {
      let webhook_event = entry.messaging[0]
      console.log(webhook_event)
      let sender_psid = webhook_event.sender.id
      console.log('Sender ID: ' + sender_psid)
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message)      
      }  
    })
    res.status(200).send('EVENT_RECEIVED')
  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404)
  }
})

app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = "implementai"
  let mode = req.query['hub.mode']
  let token = req.query['hub.verify_token']
  let challenge = req.query['hub.challenge']
  console.log(token)
  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED')
      res.status(200).send(challenge)
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403)
    }
  }
})

app.get('/test', (req,res) => {
    res.status(200).send('Server working')
});

app.get('/test-response', (req,res) => {
  let response;
  response = {
    "text": `This is a manual test response`
  }
  callSendAPI("2040864105944817", response)  
  res.status(200).send('Response sent')
});

function handleMessage(sender_psid, received_message) {
  let response;
  if (received_message.text) {    
    response = {
      "text": `Hi! Thank you for sending us a message. We will respond to you within 24 hours. 
      TEST -> Sender_psid is: ` + sender_psid
    }
  } 
  callSendAPI(sender_psid, response)    
}

function callSendAPI(sender_psid, response) {
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('message sent!')
    } else {
      console.error("Unable to send message:" + err)
    }
  }) 
}