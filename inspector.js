var spawn = require('child_process').spawn,
    debugr = require('./lib/debugger.js');

var SOURCE = 'tmp_code.js';
var PORT = 5858;

user_program = spawn('node', [
  '--debug-brk=' + PORT,
  'tmp_code.js'
]);

var dbgr = null;
var logs = [];

user_program.stdout.on('data', function(data) {
  console.log('User out: ', '' + data);
});

user_program.stderr.on('data', function(data) {
  // GOAL:
  // 1. attach debugger to the port 5858
  // 2. step through all lines of code
  // 3. store all data: scope, variable, stack etc. in an array
  if (!dbgr) {
    dbgr = debugr.attachDebugger(5858);
    dbgr.on('close', function() { console.log('User Dbg: Closed!'); });
    dbgr.on('error', function(e) { console.log('User Dbg: Error! ', e); });
    dbgr.on('exception', function(e) { console.log('User Dbg: Exception!: ', e); });
    dbgr.on('connect', function() { console.log('User Dbg: Connected!'); });
    dbgr.on('break', function(obj) {
      // first stop when the code reach first line of user's code
      // request backtrace
      // - if not in user source -> step out
      // - otherwise step in
      // inspect obj.body.script.name
      var scriptName = obj.body.script.name;
      console.log(scriptName, ': ', obj.body.sourceLine);
      var paths = scriptName.split('/');
      if (paths[paths.length - 1] != SOURCE) {
        // if it is not user_program => step out
        dbgr.request('continue', {arguments: {stepaction: 'out'}});
        return;
      }

      // extract current state of the code: variables, closures
      dbgr.request('backtrace', {arguments: {toFrame: 2}}, function(msg) {
        // all recorded data are for the source only.
        // by default there'll be maximum 10 stack frames.
        // that should do it for now
        console.log(msg.body.frames[0].locals);
        console.log(msg.body.frames[0].arguments);
        dbgr.request('scopes', {arguments: {frameNumber: msg.body.frames[0].index, inlineRefs: true}},
          function(scopes) {
            console.log(scopes.body.scopes);
          });
        logs.push(msg);
        dbgr.request('continue', {arguments: {stepaction: 'in'}});
      });
    });
  }
});
