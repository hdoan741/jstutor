var EventEmitter = require('events').EventEmitter
  , Debugger = require('./lib/debugger.js')
  , util = require('util')
  , ReferenceParser = require('./ReferenceParser.js');

// Output documentation:
// https://github.com/pgbovine/OnlinePythonTutor/blob/master/v3/docs/opt-trace-format.md

var SourceInspection = function(filename, proc, port) {
  EventEmitter.call(this);
  var stdout = '';
  var traces = [];
  var self = this;
  var userScriptRef = null;
  var excludingVars =
      {'__dirname': 1, '__filename': 1, 'exports': 1,
        'module': 1, 'require': 1};

  // it is expected, but not confirmed, that stdout will be in correct order.
  proc.on('output', function(data) {
    stdout += data;
  });

  var dbgr = Debugger.attachDebugger(port);
  dbgr.on('close', function() {
    self.emit('done', traces);
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
    var scriptPath = obj.body.script.name;
    console.log('Break ', scriptPath, ': ', obj.body.sourceLine);
    if (!isUserScript(scriptPath)) {
      // if it is not user_program => step out
      dbgr.request('continue', { arguments: { stepaction: 'out' } });
      return;
    }

    // extract current state of the code: variables, closures
    dbgr.request('backtrace', { arguments: { } }, function(resp) {
      // all recorded data are for the source only.
      // by default of V8debugger, there is maximum 10 stack frames.
      // that should do it for now
      extractSingleStep(resp, function() {
        dbgr.request('continue', { arguments: { stepaction: 'in' } });
      });
    });
  });

  var extractSingleStep = function(btmsg, callback) {
    console.log('======================================');
    // each frame extract: local variable & argument
    // need to fetch the value by reference
    // each frame = 1 stack level
    // TODO: extract scope information of a frame
    var frames = btmsg.body.frames;
    var stepData = {};
    var handles = [];
    var refValues = {};
    var variables = [];
    var func_names = [];

    // placeholder. event can ben step_line or return
    stepData['event'] = 'step_line';
    stepData['line'] = frames[0].line + 1; // in OPT line number start from 1
    // function name is contained in a ref!
    // stepData['func_name'] = frames[0].func;
    var processVar = function(v) {
      variables[v.name] = v;
      handles.push(v.value.ref);
    };

    for (var i = btmsg.body.toFrame - 1; i >= 0; i--) {
      var frame = frames[i];

      var filepath = extractFileNameFromSource(frame.text);
      if (!isUserScript(filepath)) {
        continue;
      }

      console.log(frame);
      func_names.push(frame.func);
      handles.push(frame.func.ref);

      var localVars = {};

      if (frame.locals) {
        for (var j = 0; j < frame.locals.length; j++) {
          var v = frame.locals[j];
          localVars[v.name] = v;
          handles.push(v.value.ref);
        }
      }

      if (frame.arguments) {
        for (var j = 0; j < frame.arguments.length; j++) {
          var v = frame.arguments[j];
          if (!excludingVars[v.name]) {
            localVars[v.name] = v;
            handles.push(v.value.ref);
          }
        }
      }
      variables.push(localVars);
    }

    var postProcessing = function() {
      // parse heap & global / local values to fit the output format by OPT
      var renderResult = ReferenceParser.renderOPTFormat(refValues, variables);
      console.log(' function names ', func_names);
      stepData['func_name'] = refValues[func_names[0].ref].name;
      stepData['globals'] = renderResult.variableDicts[0];
      stepData['ordered_globals'] = Object.keys(variables[0]).sort();
      stepData['heap'] = renderResult.heap;
      var allStacks = [];
      for (var i = 1; i < func_names.length; i++) {
        // higher stack level
        var stackInfo = {};
        console.log(func_names[i]);
        console.log(refValues[func_names[i].ref]);
        stackInfo['func_name'] = 'f' + i; // refValues[func_names[i].ref].text;
        stackInfo['encoded_locals'] = renderResult.variableDicts[i];
        stackInfo['ordered_varnames'] = Object.keys(variables[i]).sort();
        stackInfo['is_highlighted'] = (i == func_names.length - 1);
        stackInfo['frame_id'] = i;
        stackInfo['unique_hash'] = stackInfo['func_name'] + stackInfo['frame_id'];
        // extra
        stackInfo['parent_frame_id_list'] = [];
        stackInfo['is_zombie'] = false;
        stackInfo['is_parent'] = false;
        allStacks.push(stackInfo);
      }
      stepData['stack_to_render'] = allStacks;
      stepData['stdout'] = stdout;
      traces.push(stepData);
      // step forward
      callback();
    }

    var processLookup = function(resp) {
      var refs = [];
      for (var refId in resp.body) {
        refValues[refId] = resp.body[refId];
        var innerRefs = ReferenceParser.extractRef(resp.body[refId]);
        refs = refs.concat(innerRefs);
      }
      console.log(refs, refs.length);
      if (refs.length) {
        // repeat the lookup, because the refence can be nested.
        console.log('inner refs');
        dbgr.request('lookup', { arguments: { handles: refs } }, processLookup);
      } else {
        // cleanup and step forward.
        console.log('done looking up');
        postProcessing();
      }
    }

    // fetching actual value of variables
    dbgr.request('lookup', { arguments: { handles: handles } }, processLookup);
  };

  // return true if the script in scriptPath is user's script
  var isUserScript = function(scriptPath) {
    var paths = scriptPath.split('/');
    return (paths[paths.length - 1] == filename);
  };

  var extractFileNameFromSource = function(frameText) {
    var pieces = frameText.split(' ');
    // 7 = magic number by observing the data
    var path = pieces[pieces.length - 7];
    return path;
  };
};

util.inherits(SourceInspection, EventEmitter);

module.exports = SourceInspection;
