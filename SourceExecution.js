// Source Execution mainly manage which port is available to plug the debugger

var spawn = require('child_process').spawn
  , EventEmitter = require('events').EventEmitter;

var PORT = 5858;

var SourceExecution = function() {

  return {
    execute: function(filename) {
      var user_program = spawn('node', [
        '--debug-brk=' + PORT,
        filename
      ]);
      var eventEmitter = new EventEmitter();
      var debugReady = false;
      user_program.stdout.on('data', function(data) {
        eventEmitter.emit('output', '' + data);
      });
      user_program.stderr.on('data', function(data) {
        if (!debugReady) {
          debugReady = true;
          eventEmitter.emit('debug_ready', filename, PORT);
        }
        eventEmitter.emit('error', '' + data);
      });
      return eventEmitter;
    }
  };
};

module.exports = SourceExecution();
