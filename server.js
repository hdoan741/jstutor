var PORT = 8080;

var express = require('express');
var app = express()
  , http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server)
  , net = require('net');

var SourceExecution = require('./SourceExecution.js')
  , SourceManagement = require('./SourceManagement.js')
  , SourceInspection = require('./SourceInspection.js');

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

io.sockets.on('connection', function(socket) {
  // call everytime front-end wants to inspect a code
  // it will save the source code
  // execute node on the source_code
  // inspect using debugger, then notify the socket all inspection data
  socket.on('inspect', function(source_code) {
    var attachDebugger = function(filename, port) {
      var inspector = new SourceInspection(filename, port);
      inspector.on('done', function(loginfo) {
        socket.emit('loginfo', loginfo);
      });
    }

    var executeSource = function(err, filename) {
      if (err) {
        // TODO: notify that some errors happened
      }
      var user_program = SourceExecution.execute(filename);
      user_program.on('debug_ready', attachDebugger);
      user_program.on('output', function(data) {
        socket.emit('output', data);
      });
      user_program.on('error', function(data) {
        socket.emit('error', data);
      });
    }

    SourceManagement.save(source_code, executeSource);
  });
});
