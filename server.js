'use strict';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const SLACK_MESSENGER_WEBHOOK = process.env.SLACK_MESSENGER_WEBHOOK;

const request = require('request')
const express = require('express')
const body_parser = require('body-parser')
const serialize = require('node-serialize');
const app = express().use(body_parser.json())

app.listen(process.env.PORT || 5000, () => console.log('Webhook is listening on port 5000'));

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

/**
 * Incoming webhook from facebook page 
 */
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

/**
 * Webhook to trigger the response dialog in slack
 */
app.post('/action', (req, res) => {  
  var obj = serialize.unserialize(req.body);
  console.log(obj)
  // var options = {
  //   url: payload.response_url,
  //   method: 'POST',
  //   headers: {
  //       'User-Agent':       'Super Agent/0.0.1',
  //       'Content-Type':     'application/json'
  //   },
  //   json: {
  //     "text": "Test Response",
  //     "attachments": [
  //         {
  //             "text": JSON.stringify(payload)
  //         }
  //     ],
  //     "response_type": "in_channel"
  //   }
  // }
  // // Process the request
  // request(options, function (error, response, body) {
  //     if (error) {
  //         console.log(error)
  //         res.send({
  //             'success': false
  //         })
  //     }
  //     res.send({
  //         'success': true
  //     })
  // })
})

/**
 * Verification endpoint for facebook
 */
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

/**
 * Handles incoming message from facebook page
 * 
 * @param sender_psid 
 * @param received_message 
 */
function handleMessage(sender_psid, received_message) {
  let response;
  if (received_message.text) {
    // retrieve user information 
    request({
      "uri": "https://graph.facebook.com/" + sender_psid + "?fields=first_name,last_name,profile_pic&access_token=" + PAGE_ACCESS_TOKEN,
      "method": "GET"
    }, (err, res, body) => {
      if (!err) {
        // send automated greeting back to user immediately
        callSendAPI(sender_psid, {
          "text": `Hi! Thank you for sending us a message. We will respond to you within 24 hours.`
        })    
        // post the message to slack channel
        postToSlack(sender_psid, received_message.text, JSON.parse(res.body))
      } else {
        console.error("Error occurred retrieving user info:" + err)
      }
    }) 
  }
}

/**
 * Calls API to send message back to specified user
 * 
 * @param sender_psid 
 * @param response 
 */
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

/**
 * Posts the message to the slack channel
 * 
 * @param sender_psid 
 * @param message 
 */
function postToSlack(sender_psid, message, sender_info) {
  // Configure the request for sending to slack
  var options = {
    url: SLACK_MESSENGER_WEBHOOK,
    method: 'POST',
    headers: {
        'User-Agent':       'Super Agent/0.0.1',
        'Content-Type':     'application/json'
    },
    json: {
        'text': 'New message recieved from McGill AI Society Facebook Page!',
        'attachments': [
            {
                'image_url': sender_info.profile_pic,
                'callback_id': 'reply_message',
                'fields': [
                  {
                    "title": 'From',
                    "value": sender_info.first_name + ' ' + sender_info.last_name,
                    "short": false
                  },
                  {
                    "title": 'Message',
                    "value": message,
                    "short": false
                  }
                ],
                "actions": [
                  {
                      "name": "respond",
                      "text": "Reply To Sender",
                      "type": "button",
                      "style": "primary"
                  }
                ]
            }
        ]
    }
  }
  // Process the request
  request(options, function (error, response, body) {
      if (error) {
          console.log(error)
          res.send({
              'success': false
          })
      }
      res.send({
          'success': true
      })
  })
}