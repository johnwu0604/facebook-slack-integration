'use strict';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const SLACK_MESSENGER_WEBHOOK = process.env.SLACK_MESSENGER_WEBHOOK;

const request = require('request')
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

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
app.post('/messenger-reply', (req, res) => {  
  var payload = req.body
  var text = [].concat.apply([], payload.text.split('"').map(function(v,i){
    return i%2 ? v : v.split(' ')
  })).filter(Boolean);
  // retrieve user information 
  request({
    "uri": "https://graph.facebook.com/" + text[0] + "?fields=first_name,last_name,profile_pic&access_token=" + PAGE_ACCESS_TOKEN,
    "method": "GET"
  }, (err, res, body) => {
    if (!err) {
      callSendAPI(text[0], {
        "text": text[1]
      })
      postResponseSlackNotification('@' + payload.user_name, res.body.first_name + ' ' + res.body.last_name, text[1])
    } else {
      console.error("Error occurred retrieving user info:" + err)
    }
  }) 
  res.sendStatus(200)
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
  console.log(received_message)
  if (received_message.text) {
    // retrieve user information 
    request({
      "uri": "https://graph.facebook.com/" + sender_psid + "?fields=first_name,last_name,profile_pic&access_token=" + PAGE_ACCESS_TOKEN,
      "method": "GET"
    }, (err, res, body) => {
      if (!err) {
        // send automated greeting back to user immediately
        callSendAPI(sender_psid, {
          "text": `Hi! Thank you for sending us a message. Our neural networks are trying their best to effectively answer your questions. They’re currently training, but you should have a response within 24 hours.`
        })    
        // post the message to slack channel
        postToSlack(sender_psid, received_message.text, JSON.parse(res.body))
      } else {
        console.error("Error occurred retrieving user info:" + err)
      }
    }) 
  }
}

app.get('/test-send', (req, res) => {
  callSendAPI('1824707100927777', {
    "text": `Hello test`
  })  
  res.send(200)
})

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
 * Post to slack when exec responds to a message
 * 
 * @param responder 
 * @param recipient 
 * @param message 
 */
function postResponseSlackNotification(responder, recipient, message) {
  // Configure the request for sending to slack
  var options = {
    url: SLACK_MESSENGER_WEBHOOK,
    method: 'POST',
    headers: {
        'User-Agent':       'Super Agent/0.0.1',
        'Content-Type':     'application/json'
    },
    json: {
        'text': 'Response sent to facebook messenger conversation.',
        'attachments': [
            {
                'fields': [
                  {
                    "title": 'Responder',
                    "value": responder,
                    "short": true
                  },
                  {
                    "title": 'Recipient',
                    "value": recipient,
                    "short": true
                  },
                  {
                    "title": 'Message',
                    "value": message,
                    "short": false
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
      }
      console.log("Sent successfully")
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
                    "title": 'Message',
                    "value": message,
                    "short": false
                  },
                  {
                    "title": 'From',
                    "value": sender_info.first_name + ' ' + sender_info.last_name,
                    "short": true
                  },
                  {
                    "title": 'Sender PSID',
                    "value": sender_psid,
                    "short": true
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
      }
  })
}