// take care of rendering all the debug information
//
var createDebugView = function(table) {

  var that = {};
  var rows = [];

  table = $(table);

  that.createView = function(lineNum) {
    table.append('<colgroup style="width: 150px">');
    // create a table 2 cols, lineNum rows
    for (var i = 0; i < lineNum; i++) {
      var row = $('<tr class="debugRow"><td class="debugVarName"></td><td></td></tr>');
      rows.push(row);
    }
    table.append(rows);
  };

  that.renderLine = function(lineIndex, varName, varValue) {
    // render this line with variable name and value
    // if the line has some value before => add a | to separate
    var row = rows[lineIndex];
    var curVarName = $(row.children()[0]).html();
    if (curVarName && varName != curVarName) {
      return;
    }
    $(row.children()[0]).html(varName + ' = ');
    var oldVal = $(row.children()[1]).html();
    $(row.children()[1]).html(oldVal + varValue);
  };

  that.addSeparator = function(lineIndex) {
    var row = rows[lineIndex];
    var oldVal = $(row.children()[1]).html();
    if (!oldVal) {
      oldVal = '|';
    }
    $(row.children()[1]).html(oldVal + '   |');
  }

  that.clear = function() {
    // clear the current state of the table.
    // possibly for re-rendering the info
    table.html('');
    rows = [];
  }

  return that;
};

var DebugRenderer = function() {
  // Debug Renderer is a singleton that render variables to the view
  // it would take care of which line, which format the variable should be
  // rendered.
  var that = {};
  var view;

  that.setView = function(debugview) {
    view = debugview;
  }

  var refToString = function(ref, refValues) {
    var desc = '',
        name,
        kids = ref.properties ? ref.properties.length : false;
    switch (ref.type) {
      case 'object':
        name = /#<an?\s(\w+)>/.exec(ref.text);
        if (name && name.length > 1) {
          desc = name[1];
          if (desc === 'Array') {
            desc += '[' + (ref.properties.length - 1) + ']';
          }
          else if (desc === 'Buffer') {
            desc += '[' + (ref.properties.length - 4) + ']';
          }
        }
        else {
          desc = ref.className || 'Object';
        }
        break;
      case 'function':
        desc = 'function()';  // ref.text || 'function()';
        break;
      default:
        desc = ref.text || '';
        break;
    }
    if (desc.length > 100) {
      desc = desc.substring(0, 100) + '\u2026';
    }
    return desc;
  };

  var generateVariableMap = function(stepLog, stepRef) {
    var mapValues = [];
    for (var i = 0; i < stepLog.length; i++) {
      var m = {};
      for (var j in stepLog[i].variables) {
        var v = stepLog[i].variables[j];
        m[v.name] = refToString(stepRef[v.value.ref], stepRef);
        console.log(v.name, m[v.name]);
      }
      mapValues.push(m);
    }
    return mapValues;
  };

  that.renderFresh = function(logInfo, refValues) {
    view.clear();
    view.createView(50);

    var variableMaps = [];

    for (var i = 0; i < logInfo.length; i++) {
      var m = generateVariableMap(logInfo[i], refValues[i]);
      variableMaps.push(m);
    }

    for (var i = 0; i < logInfo.length - 1; i++) {
      // compare if any variable change value
      // render such variable
      var before = variableMaps[i];
      var after = variableMaps[i + 1];
      var lineIndex = logInfo[i][logInfo[i].length-1].line;
      var rendered = false;
      // use line index of the last line but variable of the after one (?)
      // now which variable to render?
      for (var j = 0; j < before.length; j++) {
        if (j < after.length) {
          for (var k in before[j]) {
            if (before[j][k] != after[j][k]) {
              console.log('Render line', lineIndex, k, after[j][k]);
              rendered = true;
              view.renderLine(lineIndex, k, after[j][k]);
            }
          }
        }
      }

      // handle showing function arguments. mostly arguments.
      // coz every variables in javascript is
      // defined at the beginning of the function
      var newFrame = variableMaps[i][variableMaps[i].length - 1];
      // if there is a new frame appears, show display variables in that frame
      if (i == 0 || logInfo[i - 1].length < logInfo[i].length) {
        for (var k in newFrame) {
          rendered = true;
          view.renderLine(lineIndex, k, newFrame[k]);
        }
      }

      if (!rendered) {
        // view.addSeparator(lineIndex);
      }
    }
  }

  return that;
}();
