//import Peer from 'peerjs';

let peer = new Peer();
peer.on('open', function(id) {
  console.log('My peer ID is: ' + id);
});

peer.on('connection', connectionOpened);

let connectButton = document.getElementById('connect-button');
connectButton.addEventListener('click', () => {
  let textbox = document.getElementById('textbox');

  let conn = peer.connect(textbox.value, { reliable: true });
  connectionOpened(conn)

  //TODO Find a way to confirm the UDP connection
  conn = peer.connect(textbox.value);
  connectionOpened(conn)
});

var latency = 5;

var unreliableConns = {};
var other_players = {};
var other_player_buffers = {}
var other_player_acks = {}
var other_buffers_filled = {};

function connectionOpened(conn) {
  conn.on('open', function() {
    console.log('Connection opened');

    // Receive messages
    if (conn.reliable) {
      conn.on('data', function(data) {
        console.log('Received', data);
        if (data == 'start') {
		  other_players_buffers[conn.peer] = []
		  other_buffers_filled[conn.peer] = false;
          setupGame(conn)
        } else {
		  other_players[conn.peer] = data
        }
      });
    } else {
      conn.on('data', function(data) {
        //console.log('Received', data);
        //console.log('Length', player2buffer.length);

        //Discard old packets
        if (data.frame < simulationFrame) return;

        //TODO: Might not be fully correct, game could lag behind network
        if (data.ack !== -1) {
          //TODO: Get the lowest ack
          networkinputbuffer = networkinputbuffer.slice(data.ack, networkinputbuffer.length-1)
        }

		let buffer = other_player_buffers[conn.peer]
        if (!buffer.map(x => x.frame).includes(data.frame)) buffer.push(data); //[data.frame] = data;
        buffer.sort((a,b) => a.frame - b.frame)

        if (buffer.length > latency) other_buffers_filled[conn.peer] = true;

        //Dirty hack, to find the first break in the integer sequence
        for (var i = simulationFrame; i < simulationFrame+buffer.length; i++) {
          if (buffer[i] == undefined) break;
        }

        ////The first break in the sequence is all the data the other side can discard
		other_player_acks[conn.peer] = i-1;
        //console.log("ACK: "+ input.ack)
      });
    }

    // Send messages
    if (conn.reliable) {
      let sendButton = document.getElementById('send-button');
      sendButton.addEventListener('click', () => {
        setupGame(conn);
        conn.send('start');
      });
    } else {
      unreliableConns[conn.peer] = conn;
    }
  });
}

var ballRadius = 20;

var br = ballRadius;
var sp = 2;
var balls = [{x: 400, y: 250, vx:0, vy:0}]
balls.push({x: balls[0].x-br-sp,     y: balls[0].y-br*2, vx:0, vy:0})
balls.push({x: balls[0].x+br+sp,     y: balls[0].y-br*2, vx:0, vy:0})

balls.push({x: balls[0].x-br*2-sp,   y: balls[0].y-br*4, vx:0, vy:0})
balls.push({x: balls[0].x,           y: balls[0].y-br*4, vx:0, vy:0})
balls.push({x: balls[0].x+br*2+sp,   y: balls[0].y-br*4, vx:0, vy:0})

balls.push({x: balls[0].x-br-sp,     y: balls[0].y-br*6, vx:0, vy:0})
balls.push({x: balls[0].x-br*3-sp*2, y: balls[0].y-br*6, vx:0, vy:0})
balls.push({x: balls[0].x+br+sp,     y: balls[0].y-br*6, vx:0, vy:0})
balls.push({x: balls[0].x+br*3+sp*2, y: balls[0].y-br*6, vx:0, vy:0})

var player = {x: 0, y: 0, vx: 0, vy: 0}
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
    //console.log('Network buffer: ' + Object.keys(player2buffer).length);

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

		for (let connection of Object.values(unreliableConns)) unreliableConn.send(inputz)
      }

      if (!player2bufferfilled) {
        setTimeout(() => {
          waitingLoop();
        }, 50);
        return;
      }

      firstLocal = gameinputbuffer[0]
	  let other_buffers = Object.values(other_player_buffers)

      let receivedAllInput = false;
	  if (firstLocal) {
        receivedAllInput = true;
        for (let buffer of other_buffers) {
          if (buffer.frame !== firstLocal.frame) {
            receivedAllInput = false;
            break;
          }
        }
	  }

      if (receivedAllInput) {
        gameinputbuffer.shift();
		for (let buffer of other_buffers) buffer.shift();

        simulationFrame++;
        simulateGame(firstLocal, other_buffers);
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

function simulateGame(i1, other_inputs) {
  if (i1.left)  player.vx -= 0.5;
  if (i1.right) player.vx += 0.5;
  if (i1.up)    player.vy -= 0.5;
  if (i1.down)  player.vy += 0.5;

  for (let entry of Object.entries(other_inputs)) {
	let i = entry.value
	let other_player = other_players[entry.key]
    if (i.left)  other_player.vx -= 0.5;
    if (i.right) other_player.vx += 0.5;
    if (i.up)    other_player.vy -= 0.5;
    if (i.down)  other_player.vy += 0.5;
  }

  let update = (ball) => {
    ball.x += ball.vx;
    ball.y += ball.vy;

    ball.vx *= 0.995;
    ball.vy *= 0.995;

    if (ball.x < ballRadius) {
      ball.x = ballRadius;
      ball.vx = -ball.vx*0.9;
    }
    if (ball.x > 800-ballRadius) {
      ball.x = 800-ballRadius;
      ball.vx = -ball.vx*0.9;
    }
    if (ball.y < ballRadius) {
      ball.y = ballRadius;
      ball.vy = -ball.vy*0.9;
    }
    if (ball.y > 700-ballRadius) {
      ball.y = 700-ballRadius;
      ball.vy = -ball.vy*0.9;
    }
  }

  let collision = (b1, b2) => {
    let dx = b2.x-b1.x;
    let dy = b2.y-b1.y;
    let distance = Math.sqrt(dx*dx+dy*dy);
    if (distance < 2*ballRadius) {
      let normalx = dx/distance;
      let normaly = dy/distance;

      let midx = (b1.x+b2.x)/2
      let midy = (b1.y+b2.y)/2
      b1.x = midx - normalx * ballRadius;
      b1.y = midy - normaly * ballRadius;
      b2.x = midx + normalx * ballRadius;
      b2.y = midy + normaly * ballRadius;

      let vdx = b1.vx-b2.vx;
      let vdy = b1.vy-b2.vy;

      let dot = vdx*normalx+vdy*normaly
      let dvx = dot*normalx;
      let dvy = dot*normaly;

      b1.vx -= dvx;
      b1.vy -= dvy;
      b2.vx += dvx;
      b2.vy += dvy;
    }
  }

  // Update the players
  update(player);
  for (let other_player of Object.values(other_players)) update(other_player);

  // Collision checks
  for (let ball of balls) {
    for (let other_ball of balls) {
      if (ball === other_ball) continue;

      collision(ball, other_ball);
    }

    collision(ball, player);
	for (let other_player of Object.values(other_players)) collision(ball, other_player);

    update(ball);
  }

  // Drawing code
  ctx.clearRect(0,0,800,700);

  ctx.fillStyle = 'green';
  ctx.beginPath();
  ctx.arc(player.x, player.y, ballRadius, 0, 2*Math.PI); 
  ctx.fill();

  ctx.fillStyle = 'red';
  for (let other_player of Object.values(other_players)) {
    ctx.beginPath();
    ctx.arc(other_player.x, other_player.y, ballRadius, 0, 2*Math.PI); 
    ctx.fill();
  }

  ctx.fillStyle = 'blue';
  for (let ball of balls) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ballRadius, 0, 2*Math.PI); 
    ctx.fill();
  }
}

////TODO: Remove this
//player2 = {x:0, y:0, vx: 0, vy: 0}
//var conn = {
//  send: () => {}
//}
//setupGame(conn);
//simulateGame({},{});

var input = {
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
