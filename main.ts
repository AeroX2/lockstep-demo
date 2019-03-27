//import Peer from 'peerjs';

let peer = new Peer();
peer.on('open', function(id) {
  console.log('My peer ID is: ' + id);
});

peer.on('connection', connectionOpened);

let connectButton = document.getElementById('connect-button');
connectButton.addEventListener('click', () => {
  let textbox = document.getElementById('textbox');
  let conn = peer.connect(textbox.value);
  connectionOpened(conn)
});

function connectionOpened(conn) {
  conn.on('open', function() {
    // Receive messages
    conn.on('data', function(data) {
      console.log('Received', data);
    });
  
    // Send messages
    let sendButton = document.getElementById('send-button');
    sendButton.addEventListener('click', () => {
      conn.send('Hello!');
    });
  });
}

