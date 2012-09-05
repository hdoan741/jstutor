var EventEmitter = require('events').EventEmitter
  , Debugger = require('./lib/debugger.js')
  , util = require('util');

var SourceInspection = function(filename, port) {
  EventEmitter.call(this);
  var logs = [];
  var self = this;

  var dbgr = Debugger.attachDebugger(port);
  dbgr.on('close', function() {
    self.emit('done', logs);
    console.log('User Dbg: Closed!');
  });

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
    // console.log(scriptName, ': ', obj.body.sourceLine);
    var paths = scriptName.split('/');
    if (paths[paths.length - 1] != filename) {
      // if it is not user_program => step out
      dbgr.request('continue', {arguments: {stepaction: 'out'}});
      return;
    }

    // extract current state of the code: variables, closures
    dbgr.request('backtrace', {arguments: {toFrame: 2}}, function(msg) {
      // all recorded data are for the source only.
      // by default there'll be maximum 10 stack frames.
      // that should do it for now
      // console.log(msg.body.frames[0].locals);
      // console.log(msg.body.frames[0].arguments);
      dbgr.request('scopes', {arguments: {frameNumber: msg.body.frames[0].index, inlineRefs: true}},
        function(scopes) {
          // console.log(scopes.body.scopes);
        });
      logs.push(msg);
      dbgr.request('continue', {arguments: {stepaction: 'in'}});
    });
  });
};

util.inherits(SourceInspection, EventEmitter);

module.exports = SourceInspection;
