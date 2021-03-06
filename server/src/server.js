// Imports the express Node module.
var express = require('express');
//var util = require('./util');
var db = require('./database');
// Creates an Express server.
var app = express();
var bodyParser = require('body-parser');
var StatusUpdateSchema = require('./schemas/statusupdate.json');
var validate = require('express-jsonschema').validate;
var writeDocument = db.writeDocument;
var addDocument = db.addDocument;
var commentSchema = require('./schemas/comment.json');
// Support receiving text in HTTP request bodies
app.use(bodyParser.text());
// Support receiving JSON in HTTP request bodies
app.use(bodyParser.json());
app.use(bodyParser.text());
 // You run the server from `server`, so `../client/build` is `server/../client/build`.
// '..' means "go up one directory", so this translates into `client/build`!
app.use(express.static('../client/build'));

// Defines what happens when it receives the `GET /` request
app.get('/', function (req, res) {
res.send('Hello World!');
});
/**
* Adds a new status update to the database.
*/
function postStatusUpdate(user, location, contents) {
// If we were implementing this for real on an actual server, we would check
// that the user ID is correct & matches the authenticated user. But since
// we're mocking it, we can be less strict.
// Get the current UNIX time.
var time = new Date().getTime();
// The new status update. The database will assign the ID for us.
var newStatusUpdate = {
"likeCounter": [],
"type": "statusUpdate",
"contents": {
"author": user,
"postDate": time,
"location": location,
"contents": contents,
"likeCounter": []
},
// List of comments on the post
"comments": []
};
// Add the status update to the database.
// Returns the status update w/ an ID assigned.
newStatusUpdate = addDocument('feedItems', newStatusUpdate);
// Add the status update reference to the front of the current user's feed.
var userData = db.readDocument('users', user);
var feedData = db.readDocument('feeds', userData.feed);
feedData.contents.unshift(newStatusUpdate._id);
// Update the feed object.
writeDocument('feeds', feedData);
// Return the newly-posted object.
return newStatusUpdate;
}
function postComment(user, feed, contents) {
    var time = new Date().getTime();
    var feedData = db.readDocument('feedItems', feed);
    feedData.comments.push({
        "author": user,
        "contents": contents,
        "postDate": time,
        "likeCounter": []
    });
    writeDocument('feedItems', feedData);
    return getFeedItemSync(feed);
}
app.post('/feeditem',
    validate({ body: StatusUpdateSchema }), function(req, res) {
        var body = req.body;
        var fromUser = getUserIdFromToken(req.get('Authorization'));
        if (fromUser === body.userId) {
            var newUpdate = postStatusUpdate(body.userId, body.location,
                body.contents);
            res.status(201);
            res.set('Location', '/feeditem/' + newUpdate._id);
            res.send(newUpdate);
        } else {
            res.status(401).end();
        }
    });

app.post('/feeditem/:feeditemid/comment',
    validate({body: commentSchema}), function(req, res) {
    var body = req.body;
    var fromUser = getUserIdFromToken(req.get('Authorization'));
    if(fromUser === body.userId) {
        var newComment = postComment(body.userId, req.params.feeditemid, body.contents);
        res.set('Location', '/feeditem/' + req.params.feeditemid);
        res.status(201);
        res.send(newComment);
    } else {
        res.status(401).end();
    }
});


app.put('/feeditem/:feeditemid/comment/:commentid/:userid', function(req, res) {
    var fromUser = getUserIdFromToken(req.get('Authorization'));
    var userId = parseInt(req.params.userid, 10);
    if (fromUser === userId) {
        var feedItemId = parseInt(req.params.feeditemid, 10);
        var feedItem = db.readDocument('feedItems', feedItemId);
        var comment = feedItem.comments[parseInt(req.params.commentid, 10)];
        if (comment.likeCounter.indexOf(userId) === -1) {
            comment.likeCounter.push(userId);
            writeDocument('feedItems', feedItem);
        }
        comment.author = db.readDocument('users', comment.author);
        res.send(comment);
    } else {
        res.status(401).end();
    }
});

app.delete('/feeditem/:feeditemid/comment/:commentid/:userid', function(req, res) {
    var fromUser = getUserIdFromToken(req.get('Authorization'));
    var userId = parseInt(req.params.userid, 10);
    if (fromUser === userId) {
        var feedItemId = parseInt(req.params.feeditemid, 10);
        var feedItem = db.readDocument('feedItems', feedItemId);
        var comment = feedItem.comments[parseInt(req.params.commentid, 10)];
        var likeIndex = comment.likeCounter.indexOf(userId);
        if (likeIndex !== -1) {
            comment.likeCounter.splice(likeIndex, 1);
            writeDocument('feedItems', feedItem);
        }
        comment.author = db.readDocument('users', comment.author);
        res.send(comment);
    } else {
        res.status(401).end();
    }
});

app.post('/feeditem',
validate({ body: StatusUpdateSchema }), function(req, res) {
// If this function runs, `req.body` passed JSON validation!
var body = req.body;
var fromUser = getUserIdFromToken(req.get('Authorization'));
// Check if requester is authorized to post this status update.
// (The requester must be the author of the update.)
if (fromUser === body.userId) {
var newUpdate = postStatusUpdate(body.userId, body.location,
body.contents);
// When POST creates a new resource, we should tell the client about it
// in the 'Location' header and use status code 201.
res.status(201);
res.set('Location', '/feeditem/' + newUpdate._id);
// Send the update!
res.send(newUpdate);
} else {
// 401: Unauthorized.
res.status(401).end();
}
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
 * Delete a feed item.
 */
app.delete('/feeditem/:feeditemid', function(req, res) {
    var fromUser = getUserIdFromToken(req.get('Authorization'));
    var feedItemId = parseInt(req.params.feeditemid, 10);
    var feedItem = db.readDocument('feedItems', feedItemId);
    if (feedItem.contents.author === fromUser) {
        db.deleteDocument('feedItems', feedItemId);
        var feeds = db.getCollection('feeds');
        var feedIds = Object.keys(feeds);
        feedIds.forEach((feedId) => {
            var feed = feeds[feedId];
            var itemIdx = feed.contents.indexOf(feedItemId);
            if (itemIdx !== -1) {
                feed.contents.splice(itemIdx, 1);
                db.writeDocument('feeds', feed);
            }
        });
        res.send();
    } else {
        res.status(401).end();
    }
});
// Like a feed item.
app.put('/feeditem/:feeditemid/likelist/:userid', function(req, res) {
    var fromUser = getUserIdFromToken(req.get('Authorization'));
    var feedItemId = parseInt(req.params.feeditemid, 10);
    var userId = parseInt(req.params.userid, 10);
    if (fromUser === userId) {
        var feedItem = db.readDocument('feedItems', feedItemId);
        if (feedItem.likeCounter.indexOf(userId) === -1) {
            feedItem.likeCounter.push(userId);
            writeDocument('feedItems', feedItem);
        }
        res.send(feedItem.likeCounter.map((userId) =>
            db.readDocument('users', userId)));
    } else {
        res.status(401).end();
    }
});

// Unlike a feed item.
app.delete('/feeditem/:feeditemid/likelist/:userid', function(req, res) {
    var fromUser = getUserIdFromToken(req.get('Authorization'));
    var feedItemId = parseInt(req.params.feeditemid, 10);
    var userId = parseInt(req.params.userid, 10);
    if (fromUser === userId) {
        var feedItem = db.readDocument('feedItems', feedItemId);
        var likeIndex = feedItem.likeCounter.indexOf(userId);
        if (likeIndex !== -1) {
            feedItem.likeCounter.splice(likeIndex, 1);
            writeDocument('feedItems', feedItem);
        }
        res.send(feedItem.likeCounter.map((userId) =>
            db.readDocument('users', userId)));
    } else {
        res.status(401).end();
    }
});

// Search for feed item
app.post('/search', function(req, res) {
    var fromUser = getUserIdFromToken(req.get('Authorization'));
    var user = db.readDocument('users', fromUser);
    if (typeof(req.body) === 'string') {
        var queryText = req.body.trim().toLowerCase();
        var feedItemIDs = db.readDocument('feeds', user.feed).contents;
        res.send(feedItemIDs.filter((feedItemID) => {
            var feedItem = db.readDocument('feedItems', feedItemID);
            return feedItem.contents.contents
                    .toLowerCase()
                    .indexOf(queryText) !== -1;
        }).map(getFeedItemSync));
    } else {
        res.status(400).end();
    }
});

// Update a feed item.
app.put('/feeditem/:feeditemid/content', function(req, res) {
    var fromUser = getUserIdFromToken(req.get('Authorization'));
    var feedItemId = req.params.feeditemid;
    var feedItem = db.readDocument('feedItems', feedItemId);
    if (fromUser === feedItem.contents.author) {
        if (typeof(req.body) !== 'string') {
            res.status(400).end();
            return;
        }
        feedItem.contents.contents = req.body;
        writeDocument('feedItems', feedItem);
        res.send(getFeedItemSync(feedItemId));
    } else {
        res.status(401).end();
    }
});
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
// Reset database.
app.post('/resetdb', function(req, res) {
console.log("Resetting database...");
// This is a debug route, so don't do any validation.
db.resetDatabase();
// res.send() sends an empty response with status code 200
res.send();
});
app.use(function(err, req, res, next) {
    if (err.name === 'JsonSchemaValidation') {
        res.status(400).end();
    } else {
        next(err);
    }
})
// Starts the server on port 3000!
app.listen(3000, function () {
console.log('Example app listening on port 3000!');
});
