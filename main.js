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
  conn = peer.connect(textbox.value, { reliable: true });
  connectionOpened(conn)
});

var latency = 5;

var unreliableConn;
var player2;
var player2buffer = {}
var player2bufferfilled = false;

function connectionOpened(conn) {
  conn.on('open', function() {
	console.log('Connection opened');

    // Receive messages
	if (conn.reliable) {
      conn.on('data', function(data) {
        console.log('Received', data);
		if (data == 'start') {
		  setupGame(conn)
		} else {
		  player2 = data
		}
      });
	} else {
      conn.on('data', function(data) {
        //console.log('Received', data);
		
		//Discard old packets
		if (data.frame < simulationFrame) return;

		//TODO: Might not be fully correct, gmae could lag behind network
		if (data.ack !== -1) {
		  networkinputbuffer = networkinputbuffer.slice(data.ack, networkinputbuffer.length-1)
		}

		player2buffer[data.frame] = data;
		//player2buffer.sort((a,b) => a.frame - b.frame)

		if (Object.keys(player2buffer).length > latency) player2bufferfilled = true;

		//Dirty hack, to find the first break in the integer sequence
		for (var i = simulationFrame; i < simulationFrame+Object.keys(player2buffer).length; i++) {
          if (player2buffer[i] == undefined) break;
		}

		////The first break in the sequence is all the data the other side can discard
		input.ack = i-1;
		//console.log("ACK: "+ input.ack)
      });
	}
  
    // Send messages
    let sendButton = document.getElementById('send-button');
	if (conn.reliable) {
      sendButton.addEventListener('click', () => {
        setupGame(conn);
		conn.send('start');
      });
	} else {
      unreliableConn = conn;
	}
  });
}

var player = {x: 0, y: 0}
var ctx;
function setupGame(conn) {
  console.log('Setting up game');
  player.x = Math.round(Math.random()*500);
  player.y = Math.round(Math.random()*500);
  conn.send(player);

  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');

  window.requestAnimationFrame(gameLoop);
}

var simulationFrame = 0;
var gameinputbuffer = [];
var networkinputbuffer = [];
var inputbufferfilled = false;
function gameLoop() {
  setTimeout(() => {
    //console.log('Game loop');
	console.log('Network buffer: ' + Object.keys(player2buffer).length);

    input.frame++;
	let input_clone = Object.assign({}, input);
    gameinputbuffer.push(input_clone)
    networkinputbuffer.push(input_clone)
	if (gameinputbuffer.length > latency) inputbufferfilled = true;

	if (!inputbufferfilled) {
      window.requestAnimationFrame(gameLoop);
      return;
	}

    let waitingLoop = () => {
      //console.log('Waiting');
      
      //Reduntantly send all inputs
      for (let inputz of networkinputbuffer) {
        //TODO: Figure out when to remove old packets from inputbuffer
        //if (inputz.frame
        unreliableConn.send(inputz)
      }
      
      if (!player2bufferfilled) {
        setTimeout(() => {
          waitingLoop();
        }, 50);
      	return;
      }
      
      //debugger;
      
      firstLocal = gameinputbuffer[0]
      firstRemote = player2buffer[simulationFrame]
      if (firstLocal && firstRemote && firstLocal.frame === firstRemote.frame) {
		gameinputbuffer.shift();
        delete player2buffer[simulationFrame]
        simulationFrame++;
      
        //console.log('Playing game for frame: ' + firstLocal.frame)
        simulateGame(firstLocal, firstRemote);
        window.requestAnimationFrame(gameLoop);
        return;
      }

      setTimeout(() => {
    	waitingLoop();
      }, 50);
    }
    waitingLoop();

  }, 1000/60)
}

var player1vel = {x: 0, y: 0};
var player2vel = {x: 0, y: 0};
function simulateGame(i1, i2) {
  if (i1.left)  player1vel.x -= 0.5;
  if (i1.right) player1vel.x += 0.5;
  if (i1.up)    player1vel.y -= 0.5;
  if (i1.down)  player1vel.y += 0.5;
                                 
  if (i2.left)  player2vel.x -= 0.5;
  if (i2.right) player2vel.x += 0.5;
  if (i2.up)    player2vel.y -= 0.5;
  if (i2.down)  player2vel.y += 0.5;

  player.x += player1vel.x;
  player.y += player1vel.y;

  if (player.x < 0) player.x = 0;
  if (player.x > 800-20) player.x = 800-20;
  if (player.y < 0) player.y = 0;
  if (player.y > 700-20) player.y = 700-20;

  player2.x += player2vel.x;
  player2.y += player2vel.y;

  if (player2.x < 0) player2.x = 0;
  if (player2.x > 800-20) player2.x = 800-20;
  if (player2.y < 0) player2.y = 0;
  if (player2.y > 700-20) player2.y = 700-20;


  ctx.fillStyle = 'green';
  ctx.fillRect(player.x, player.y, 20, 20); 
  ctx.fillRect(player2.x, player2.y, 20, 20); 
}

var input = {
  'ack': -1,
  'frame': -1,
  'up': false,
  'down': false,
  'left': false,
  'right': false,
}

window.onkeydown = (e) => {
  if (e.key == 'ArrowUp')    input.up = true;
  if (e.key == 'ArrowDown')  input.down = true;
  if (e.key == 'ArrowLeft')  input.left = true;
  if (e.key == 'ArrowRight') input.right = true;
}

window.onkeyup = (e) => {
  if (e.key == 'ArrowUp')    input.up = false;
  if (e.key == 'ArrowDown')  input.down = false;
  if (e.key == 'ArrowLeft')  input.left = false;
  if (e.key == 'ArrowRight') input.right = false;
}
