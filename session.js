var SourceExecution = require('./SourceExecution.js')
  , SourceManagement = require('./SourceManagement.js')
  , SourceInspection = require('./SourceInspection.js');

var Session = function(socket) {
  var pendingCode = null;
  var isExecuting = false;
  var self = this;
  var inspector;
  var user_program;
  var session = {};
  var currentCode;

  var attachDebugger = function(filename, port) {
    console.log('debug ready');
    inspector = new SourceInspection(filename, port);
    inspector.on('done', function(traces) {
      socket.emit('loginfo', {
        'code': currentCode,
        'traces': traces
      });
      isExecuting = false;
      if (pendingCode) {
        var pc = pendingCode;
        pendingCode = null;
        session.inspect(pc);
      }
    });
    inspector.on('infinite_loop', function(loginfo, refValues) {
      socket.emit('loginfo', loginfo);
      socket.emit('error', 'Too many loops. Possibly infinite loop');
      user_program.kill('SIGKILL');
    });
  }

  var executeSource = function(err, filename) {
    if (err) {
      // TODO: notify that some errors happened
    }
    user_program = SourceExecution.execute(filename);
    user_program.on('debug_ready', attachDebugger);
    user_program.on('output', function(data) {
      // console.log('output', data);
      socket.emit('output', data);
    });
    user_program.on('error', function(data) {
      // console.log('error', data);
      socket.emit('error', data);
    });
  }

  session.inspect = function(source_code) {
    if (!isExecuting) {
      isExecuting = true;
      currentCode = source_code;
      SourceManagement.save(source_code, executeSource);
    } else {
      pendingCode = source_code;
    }
  };

  socket.on('inspect', session.inspect);
  return session;
};

module.exports = Session;
