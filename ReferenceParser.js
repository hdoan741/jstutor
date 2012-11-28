var ReferenceParser = function() {

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
        if (refValue.type == 'object') {
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

      var variableDict = {};
      for (i in variables) {
        v = variables[i];
        variableDict[v.name] = render(v.value.ref);
      }

      return {
        'heap': heaps,
        'variableDict': variableDict
      }
    }
  }
};

module.exports = ReferenceParser ();
