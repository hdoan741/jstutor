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
  var last_line = 1;
  var excludingVars =
      {'__dirname': 1, '__filename': 1, 'exports': 1,
        'module': 1, 'require': 1};

  // it is expected, but not confirmed, that stdout will be in correct order.
  proc.on('output', function(data) {
    stdout += data;
  });

  var dbgr = Debugger.attachDebugger(port);
  dbgr.on('close', function() {
    // need to correct the line number of the last trace
    // because it is usually outside the program length
    for (var i = traces.length - 2; i >= 0; i--) {
      var stepData = traces[i];
      if (!stepData['stack_to_render'] || stepData['stack_to_render'].length == 0) {
        traces[traces.length - 1].line = stepData.line;
        break;
      }
    }
    console.log(util.inspect(traces, false, null));
    self.emit('done', traces);
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
    // console.log('Break ', scriptPath, ': ', obj.body.sourceLine);
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

  var extractSingleStep = function(backtraceData, callback) {
    console.log('======================================');
    // each frame extract: local variable & argument
    // need to fetch the value by reference
    // each frame = 1 stack level
    // TODO: extract scope information of a frame
    var frames = backtraceData.body.frames;
    var stepData = {};
    var handles = [];
    var refValues = {};
    var variables = [];
    var func_refs = [];

    // placeholder. event can ben step_line or return
    stepData['event'] = 'step_line';
    stepData['line'] = frames[0].line + 1; // in OPT line number start from 1

    // function name is contained in a ref!
    // stepData['func_name'] = frames[0].func;
    var processVar = function(v) {
      variables[v.name] = v;
      handles.push(v.value.ref);
    };

    for (var i = backtraceData.body.toFrame - 1; i >= 0; i--) {
      var frame = frames[i];

      // do not go into system code
      var filepath = extractFileNameFromSource(frame.text);
      if (!isUserScript(filepath)) {
        continue;
      }

      console.log(frame);
      func_refs.push(frame.func);
      handles.push(frame.func.ref);

      var localVars = {};

      if (frame.locals) {
        for (var j = 0; j < frame.locals.length; j++) {
          var v = frame.locals[j];
          localVars[v.name] = v.value;
          handles.push(v.value.ref);
        }
      }

      if (frame.arguments) {
        for (var j = 0; j < frame.arguments.length; j++) {
          var v = frame.arguments[j];
          if (!excludingVars[v.name]) {
            localVars[v.name] = v.value;
            handles.push(v.value.ref);
          }
        }
      }

      if (frame.atReturn) {
        stepData['event'] = 'return';
        localVars['__return__'] = frame.returnValue;
        handles.push(frame.returnValue.ref);
      }

      variables.push(localVars);
    }

    var postProcessing = function() {
      // parse heap & global / local values to fit the output format by OPT
      var renderResult = ReferenceParser.renderOPTFormat(refValues, variables);
      // console.log(' function names ', func_refs);
      stepData['func_name'] =
        ReferenceParser.extractFuncName(refValues[func_refs[0].ref].source);
      stepData['ordered_globals'] = Object.keys(variables[0]).sort();
      stepData['globals'] = renderResult.variableDicts[0];
      stepData['heap'] = renderResult.heap;
      var allStacks = [];
      for (var i = 1; i < func_refs.length; i++) {
        // higher stack level
        var stackInfo = {};
        console.log(func_refs[i]);
        console.log(refValues[func_refs[i].ref]);
        stackInfo['func_name'] =
          ReferenceParser.extractFuncName(refValues[func_refs[i].ref].source);
        stackInfo['encoded_locals'] = renderResult.variableDicts[i];
        stackInfo['ordered_varnames'] = Object.keys(variables[i]).sort();
        stackInfo['is_highlighted'] = (i == func_refs.length - 1);
        stackInfo['frame_id'] = i;
        stackInfo['unique_hash'] = stackInfo['func_name'] + '_f' + stackInfo['frame_id'];
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
      if (refs.length) {
        // repeat the lookup, because the refence can be nested.
        dbgr.request('lookup', { arguments: { handles: refs } }, processLookup);
      } else {
        // cleanup and step forward.
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
