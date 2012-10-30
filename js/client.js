var socket = io.connect('http://localhost');
// var dbview = createDebugView($('#debugview'));
// DebugRenderer.setView(dbview);

$('#btn').click(function() {
  var code = editor.getValue();
  socket.emit('inspect', code);
});

socket.on('output', function(data) {
  console.log('output: ', data);
  // $('#outputContainer').html($('<div>').html(data));
});

socket.on('loginfo', function(logInfo) {
  console.log('loginfo: ', JSON.stringify(logInfo));
  // DebugRenderer.renderFresh(logInfo, refValues);
});

socket.on('error', function(data) {
  console.log('error: ', data);
});

