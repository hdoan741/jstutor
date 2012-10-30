var PORT = 8080;

var express = require('express');
var app = express()
  , http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server)
  , net = require('net');

var Session = require('./session.js');

server.listen(PORT);

app.use('/codemirror', express.static(__dirname + '/codemirror'));
app.use('/js', express.static(__dirname + '/js'));
app.use('/css', express.static(__dirname + '/css'));

app.get('/', function (req, res) {
  res.sendfile('editor.html');
});

io.configure(function() {
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
