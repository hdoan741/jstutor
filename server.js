var PORT = process.env.PORT || 8080;

var express = require('express');
var app = express()
  , http = require('http')
  , server = http.createServer(app)
//  , io = require('socket.io').listen(server)
  , util = require('util')
  , net = require('net');

// var Session = require('./session.js');
var Inspector = require('./static_backend.js');

server.listen(PORT);

app.use('/codemirror', express.static(__dirname + '/codemirror'));
app.use('/js', express.static(__dirname + '/js'));
app.use('/css', express.static(__dirname + '/css'));
app.use('/example-code', express.static(__dirname + '/example-code'));

app.get('/', function(req, res) {
  res.sendfile('visualize.html');
});

app.get('/exec', function(req, res) {
  var user_script = req.query.user_script;
  Inspector.inspect(user_script, function(resp) {
    console.log(util.inspect(resp, false, null));
    res.json(200, resp);
  });
});

/*
io.configure(function() {
  io.set("transports", ["xhr-polling"]);
  io.set("polling duration", 10);
  io.set('log level', 1);
});

var session;

io.sockets.on('connection', function(socket) {
  // call everytime front-end wants to inspect a code
  // it will save the source code
  // execute node on the source_code
  // inspect using debugger, then notify the socket all inspection data
  session = new Session(socket);
});
*/
