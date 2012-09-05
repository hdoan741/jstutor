// SourceManagement saves files to correct location & name.

var fs = require('fs');

var SourceManagement = function(){
  var FILE_NAME = 'tmp.js';
  return {
    save: function(source_code, callback) {
      // TODO: generate a temporary file name
      fs.writeFile(FILE_NAME, source_code, function(err) {
        callback(err, FILE_NAME);
      });
    }
  };
};

module.exports = SourceManagement();
