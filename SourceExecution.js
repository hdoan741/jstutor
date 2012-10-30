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
      var debugReady = false;
      user_program.stdout.on('data', function(data) {
        user_program.emit('output', '' + data);
      });
      user_program.stderr.on('data', function(data) {
        if (!debugReady) {
          debugReady = true;
          user_program.emit('debug_ready', filename, PORT);
        }
        user_program.emit('error', '' + data);
      });
      return user_program;
    }
  };
};

module.exports = SourceExecution();
