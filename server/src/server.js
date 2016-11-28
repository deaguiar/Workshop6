// Imports the express Node module.
var express = require('express');
var reverseString= require('./util').reverseString;
// Creates an Express server.
var app = express();
var bodyParser = require('body-parser');
//var  = util.reverseString();

 //var reverse = util.reverseString();
 app.use(bodyParser.text());

// Defines what happens when it receives the `GET /` request
app.get('/', function (req, res) {
res.send('Hello World!');
});
// Starts the server on port 3000!
app.listen(3000, function () {
console.log('Example app listening on port 3000!');
});
// Handle POST /reverse [data]
app.post('/reverse', function (req, res) {
// If the request came with text, then the text() middleware handled it
// and made `req.body` a string.
// Check that req.body is a string.
if (typeof(req.body) === 'string') {

var reversed = reverseString(req.body);
res.send(reversed);
} else {
res.status(200).end()
}
});