// Imports the express Node module.
var express = require('express');
//var util = require('./util');
var db = require('./database');
// Creates an Express server.
var app = express();
var bodyParser = require('body-parser');
//var  = util.reverseString();

 //var reverse = util.reverseString();
 app.use(bodyParser.text());
 // You run the server from `server`, so `../client/build` is `server/../client/build`.
// '..' means "go up one directory", so this translates into `client/build`!
app.use(express.static('../client/build'));

// Defines what happens when it receives the `GET /` request
app.get('/', function (req, res) {
res.send('Hello World!');
});

// Handle POST /reverse [data]
//app.post('/reverse', function (req, res) {
// If the request came with text, then the text() middleware handled it
// and made `req.body` a string.
// Check that req.body is a string.
//if (typeof(req.body) === 'string') {

/*var reversed = reverseString(req.body);
res.send(reversed);
} else {
res.status(400).end()
}
});*/
/**
 * Resolves a feed item. Internal to the server, since it's synchronous.
 */
function getFeedItemSync(feedItemId) {
  var feedItem = db.readDocument('feedItems', feedItemId);
  // Resolve 'like' counter.
  feedItem.likeCounter = feedItem.likeCounter.map((id) => db.readDocument('users', id));
  // Assuming a StatusUpdate. If we had other types of FeedItems in the DB, we would
  // need to check the type and have logic for each type.
  feedItem.contents.author = db.readDocument('users', feedItem.contents.author);
  // Resolve comment author.
  feedItem.comments.forEach((comment) => {
    comment.author = db.readDocument('users', comment.author);
  });
  return feedItem;
}

/**
* Get the feed data for a particular user.
*/
function getFeedData(user) {
var userData = db.readDocument('users', user);
var feedData = db.readDocument('feeds', userData.feed);
// While map takes a callback, it is synchronous,
// not asynchronous. It calls the callback immediately.
feedData.contents = feedData.contents.map(getFeedItemSync);
// Return FeedData with resolved references.
return feedData;
}

/**
* Get the user ID from a token. Returns -1 (an invalid ID)
* if it fails.
*/
function getUserIdFromToken(authorizationLine) {
try {
// Cut off "Bearer " from the header value.
var token = authorizationLine.slice(7);
// Convert the base64 string to a UTF-8 string.
var regularString = new Buffer(token, 'base64').toString('utf8');
// Convert the UTF-8 string into a JavaScript object.
var tokenObj = JSON.parse(regularString);
var id = tokenObj['id'];
// Check that id is a number.
if (typeof id === 'number') {
return id;
} else {
// Not a number. Return -1, an invalid ID.
return -1;
}
} catch (e) {
// Return an invalid ID.
return -1;
}
}
/**
* Get the feed data for a particular user.
*/
app.get('/user/:userid/feed', function(req, res) {
var userid = req.params.userid;
var fromUser = getUserIdFromToken(req.get('Authorization'));
// userid is a string. We need it to be a number.
// Parameters are always strings.
var useridNumber = parseInt(userid, 10);
if (fromUser === useridNumber) {
// Send response.
res.send(getFeedData(userid));
} else {
// 401: Unauthorized request.
res.status(401).end();
}
});
// Starts the server on port 3000!
app.listen(3000, function () {
console.log('Example app listening on port 3000!');
});
