'use strict';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const SLACK_MESSENGER_WEBHOOK = process.env.SLACK_MESSENGER_WEBHOOK;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const AUTO_REPLY_MESSAGE = 'Hi! Thank you for sending us a message. Our neural networks are trying their best to effectively answer your questions. They’re currently training, but you should have a response within 24 hours.'
const FACEBOOK_PAGE_NAME = 'McGill AI Society'

const request = require('request')
const express = require('express')
const bodyParser = require('body-parser')

const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.listen(process.env.PORT || 5000, () => console.log('Webhook is listening on port 5000'));

/**
 * Test endpoint for server
 */
app.get('/test', (req,res) => {
    res.status(200).send('Server working')
});

/**
 * Incoming webhook from facebook page 
 */
app.post('/webhook', (req, res) => {  
  let body = req.body;
  if (body.object === 'page') {
    body.entry.forEach(function(entry) {
      let webhook_event = entry.messaging[0]
      let sender_psid = webhook_event.sender.id
      if (webhook_event.message) {
        handleFacebookMessage(sender_psid, webhook_event.message)      
      }  
    })
    res.status(200).send('EVENT_RECEIVED')
  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404)
  }
})

/**
 * Verification endpoint for facebook
 */
app.get('/webhook', (req, res) => {
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
 * Webhook to trigger the response dialog in slack
 */
app.post('/messenger-reply', (req, res) => {  
  var payload = req.body
  // parse input text 
  var text = [].concat.apply([], payload.text.split('"').map(function(v,i){
    return i%2 ? v : v.split(' ')
  })).filter(Boolean);
  // retrieve user information 
  request({
    'uri': 'https://graph.facebook.com/' + text[0] + '?fields=first_name,last_name,profile_pic&access_token=' + PAGE_ACCESS_TOKEN,
    'method': 'GET'
  }, (err, res, body) => {
    if (!err) {
      sendFacebookMessage(text[0], {
        'text': text[1]
      })
      var user_info = JSON.parse(res.body)
      postToSlack({
        'text': 'A response has been sent to a facebook messenger conversation.',
        'attachments': [
            {
                'fields': [
                  {
                    'title': 'Responder',
                    'value': '@' + payload.user_name,
                    'short': true
                  },
                  {
                    'title': 'Recipient',
                    'value': user_info.first_name + ' ' + user_info.last_name,
                    'short': true
                  },
                  {
                    'title': 'Message',
                    'value': text[1],
                    'short': false
                  }
                ]
            }
        ]
      })
    } else {
      console.error('Error occurred retrieving user info: ' + err)
    }
  })
  res.status(200).send('Message sent!') 
})

/**
 * Handles incoming message from facebook page
 * 
 * @param sender_psid 
 * @param received_message 
 */
function handleFacebookMessage(sender_psid, received_message) {
  if (received_message.text) {
    // retrieve user information 
    request({
      'uri': 'https://graph.facebook.com/' + sender_psid + '?fields=first_name,last_name,profile_pic&access_token=' + PAGE_ACCESS_TOKEN,
      'method': 'GET'
    }, (err, res, body) => {
      if (!err) {
        console.log(received_message)
        // send automated greeting back to user immediately
        sendFacebookMessage(sender_psid, {
          'text': AUTO_REPLY_MESSAGE + ' TEST -> ' + JSON.parse(res.body) + ' ' + JSON.parse(received_message)
        })    
        // post message to slack
        var sender_info = JSON.parse(res.body)
        postToSlack({
          'text': 'New message recieved from the ' + FACEBOOK_PAGE_NAME + ' Facebook Page!',
          'attachments': [
              {
                  'image_url': sender_info.profile_pic,
                  'callback_id': 'reply_message',
                  'fields': [
                    {
                      "title": 'Message',
                      "value": received_message.text,
                      "short": false
                    },
                    {
                      'title': 'From',
                      'value': sender_info.first_name + ' ' + sender_info.last_name,
                      'short': true
                    },
                    {
                      'title': 'Sender PSID',
                      'value': sender_psid,
                      'short': true
                    }
                  ]
              }
          ]
        })
      } else {
        console.error('Error occurred retrieving sender info: ' + err)
      }
    }) 
  }
}

/**
 * Sends Facebook message to a user in messenger
 * 
 * @param psid 
 * @param response 
 */
function sendFacebookMessage(psid, response) {
  let request_body = {
    'recipient': {
      'id': psid
    },
    'message': response
  }
  request({
    'uri': 'https://graph.facebook.com/v2.6/me/messages',
    'qs': { 'access_token': PAGE_ACCESS_TOKEN },
    'method': 'POST',
    'json': request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('Message sent to facebook with user PSID: ' + psid)
    } else {
      console.error('Unable to send message: ' + err)
    }
  }) 
}

/**
 * Posts a message to slack
 */
function postToSlack(payload) {
    // Configure the request for sending to slack
    var options = {
      url: SLACK_MESSENGER_WEBHOOK,
      method: 'POST',
      headers: {
          'User-Agent':       'Super Agent/0.0.1',
          'Content-Type':     'application/json'
      },
      json: payload
    }
    // Process the request
    request(options, function (error, response, body) {
        if (error) {
            console.log(error)
        }
    })
}