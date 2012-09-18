var EventEmitter = require('events').EventEmitter
  , Debugger = require('./lib/debugger.js')
  , util = require('util');

var SourceInspection = function(filename, port) {
  EventEmitter.call(this);
  var logs = [];
  var refValues = [];
  var self = this;
  var userScriptRef = null;
  // last reference of value of each value across 'breaks', stored by frames
  var lastRef = [];
  var excludingVars =
      {'__dirname': 1, '__filename': 1, 'exports': 1,
        'module': 1, 'require': 1};

  var dbgr = Debugger.attachDebugger(port);
  dbgr.on('close', function() {
    self.emit('done', logs, refValues);
    console.log('User Dbg: Closed!');
  });

  // return true if the script in scriptPath is user's script
  var verifyUserScript = function(scriptPath) {
    var paths = scriptPath.split('/');
    return (paths[paths.length - 1] == filename);
  }

  var extractFileNameFromSource = function(frameText) {
    var pieces = frameText.split(' ');
    // 7 = magic number by observing the data
    var path = pieces[pieces.length - 7];
    return path;
  }

  var extractFrames = function(btmsg) {
    // each frame extract: local variable & argument
    // need to fetch the value by reference
    // each frame = 1 stack level
    // TODO: extract scope information of a frame
    var frames = btmsg.body.frames;
    var frameData = [];
    var handles = [];
    var count = 0;
    var lastRefFrame;

    var processVar = function(v) {
      // If the reference doesn't change => same value.
      // (I have a feeling that I shouldn't trust the above assumption,
      // and until it still doesn't help in anything.
      // if (lastRefFrame[v.name] != v.value.ref) {
        console.log(v.name, v.value.ref);
        variables[v.name] = v;
        handles.push(v.value.ref);
        lastRefFrame[v.name] = v.value.ref;
      // }
    };

    for (var i = btmsg.body.toFrame - 1; i >= 0; i--) {
      var frame = frames[i];

      var filepath = extractFileNameFromSource(frame.text);
      if (!verifyUserScript(filepath)) {
        continue;
      }

      count++;
      if (count >= lastRef.length) {
        lastRef[count] = {};
      }
      lastRefFrame = lastRef[count];

      var variables = {};
      if (frame.locals) {
        for (var j = 0; j < frame.locals.length; j++) {
          var v = frame.locals[j];
          v['type'] = 'local';
          processVar(v);
        }
      }

      if (frame.arguments) {
        for (var j = 0; j < frame.arguments.length; j++) {
          var v = frame.arguments[j];
          v['type'] = 'arg';
          if (!excludingVars[v.name]) {
            processVar(v);
          }
        }
      }

      var frameInfo = {
        'variables': variables,
        'line': frame.line
      };

      frameData.push(frameInfo);
    }
    logs.push(frameData);
    // fetching actual value of variables
    dbgr.request('lookup', {arguments: {handles: handles}}, function(resp) {
      /*
      for (var i = 0; i < frameData.length; i++) {
        var frameVar = frameData[i].variables;
        for (var j = 0; j < frameVar.length; j++) {
          frameVar[j]['lookupvalue'] = resp.body[frameVar[j].value.ref];
        }
      }
      console.log(frameData[0]);
      logs.push(frameData);
      */
      console.log(resp.body);
      refValues.push(resp.body);
    });
  }

  dbgr.on('error', function(e) { console.log('User Dbg: Error! ', e); });
  dbgr.on('exception', function(e) { console.log('User Dbg: Exception!: ', e); });
  dbgr.on('connect', function() { console.log('User Dbg: Connected!'); });
  dbgr.on('break', function(obj) {
    // first stop when the code reach first line of user's code
    // request backtrace
    // - if not in user source -> step out
    // - otherwise step in
    // inspect obj.body.script.name
    var scriptPath = obj.body.script.name;
    console.log('Break ', scriptPath, ': ', obj.body.sourceLine);
    if (!verifyUserScript(scriptPath)) {
      // if it is not user_program => step out
      dbgr.request('continue', {arguments: {stepaction: 'out'}});
      return;
    }

    // extract current state of the code: variables, closures
    dbgr.request('backtrace', {arguments: {}}, function(resp) {
      // all recorded data are for the source only.
      // by default there'll be maximum 10 stack frames.
      // that should do it for now
      /*
      dbgr.request('scopes', {arguments: {
          frameNumber: msg.body.frames[0].index,
          inlineRefs: true}},
        function(scopes) {
          // console.log(scopes.body.scopes);
        });
      */
      var frameData = extractFrames(resp);
      // logs.push(frameData);
      dbgr.request('continue', {arguments: {stepaction: 'in'}});
    });
  });
};

util.inherits(SourceInspection, EventEmitter);

module.exports = SourceInspection;
