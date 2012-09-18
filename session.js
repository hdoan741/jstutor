var SourceExecution = require('./SourceExecution.js')
  , SourceManagement = require('./SourceManagement.js')
  , SourceInspection = require('./SourceInspection.js');

var Session = function(socket) {
  var pendingCode = null;
  var isExecuting = false;
  var self = this;
  var inspector;
  var user_program;

  var attachDebugger = function(filename, port) {
    console.log('debug ready');
    inspector = new SourceInspection(filename, port);
    inspector.on('done', function(loginfo, refValues) {
      console.log('loginfo', loginfo, refValues);
      socket.emit('loginfo', loginfo, refValues);
    });
  }

  var executeSource = function(err, filename) {
    if (err) {
      // TODO: notify that some errors happened
    }
    user_program = SourceExecution.execute(filename);
    user_program.on('debug_ready', attachDebugger);
    user_program.on('output', function(data) {
      console.log('output', data);
      socket.emit('output', data);
    });
    user_program.on('error', function(data) {
      console.log('error', data);
      socket.emit('error', data);
    });
  }

  var session = {};

  session.inspect = function(source_code) {
    SourceManagement.save(source_code, executeSource);
  };

  socket.on('inspect', session.inspect);
  return session;
};

module.exports = Session;
