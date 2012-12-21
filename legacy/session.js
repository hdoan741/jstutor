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

  var attachDebugger = function(filename, proc, port) {
    console.log('debug ready');
    inspector = new SourceInspection(filename, proc, port);
    inspector.on('done', function(traces) {
      if (traces.length >= 2) {
        traces[traces.length - 1].line = traces[traces.length - 2].line;
      }
      socket.emit('loginfo', {
        'code': currentCode,
        'trace': traces
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
