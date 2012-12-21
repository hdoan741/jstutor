var ReferenceParser = function() {

  var getFuncName = function(src) {
    return src.substring('function '.length, src.indexOf('{')).trim();
  }

  return {
    // extract inner reference in a refValue
    // happens on array, etc.
    extractRef: function(refValue) {
      var refs = [];
      if (refValue.type == 'object') {
        for (var i in refValue.properties) {
          refs.push(refValue.properties[i].ref);
        }
      }
      return refs;
    },

    extractFuncName: getFuncName,

    // render format for online python tutor
    renderOPTFormat: function(refMaps, variables) {
      var heaps = {};
      var primitives = {};

      function render(index) {
        if (primitives.hasOwnProperty(index)) {
          return primitives[index];
        }
        if (heaps.hasOwnProperty(index)) {
          return [
            'REF',
            index
          ];
        }
        var refValue = refMaps[index];
        var renderedValue = null;
        if (refValue.type == 'function') {
          var func_name = getFuncName(refValue.source);
          renderedValue = [
            'FUNCTION',
            func_name,
            null
          ];
          heaps[index] = renderedValue;
        } else if (refValue.type == 'object') {
          renderedValue = [];
          var startIndex = 0;
          if (refValue.className == 'Array') {
            renderedValue = ['LIST'];
            startIndex = 1;
          } else
          if (refValue.className == 'Object') {
            renderedValue = ['DICT'];
          }
          for (var i = startIndex; i < refValue.properties.length; i++) {
            var propertyValue = refValue.properties[i];
            var renderedProperty = render(propertyValue.ref);
            renderedValue.push(renderedProperty);
          }
          heaps[index] = renderedValue;
        } else {
          renderedValue = refValue.value || refValue.text;
          primitives[index] = renderedValue;
        }
        return renderedValue;
      }

      for (i in refMaps) {
        render(i);
      }

      var variableDicts = [];
      for (i in variables) {
        localVars = variables[i];
        var varDict = {};
        for (vname in localVars) {
          var v = localVars[vname];
          varDict[vname] = render(v.ref);
        }
        variableDicts.push(varDict);
      }

      return {
        'heap': heaps,
        'variableDicts': variableDicts
      }
    }
  }
};

module.exports = ReferenceParser ();
