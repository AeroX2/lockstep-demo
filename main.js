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
var player2buffer = []
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
        //console.log('Length', player2buffer.length);

        //Discard old packets
        if (data.frame < simulationFrame) return;

        //TODO: Might not be fully correct, game could lag behind network
        if (data.ack !== -1) {
          networkinputbuffer = networkinputbuffer.slice(data.ack, networkinputbuffer.length-1)
        }

        if (!player2buffer.map(x => x.frame).includes(data.frame)) player2buffer.push(data); //[data.frame] = data;
        player2buffer.sort((a,b) => a.frame - b.frame)

        if (player2buffer.length > latency) player2bufferfilled = true;

        //Dirty hack, to find the first break in the integer sequence
        for (var i = simulationFrame; i < simulationFrame+player2buffer.length; i++) {
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
      firstRemote = player2buffer[0]
      if (firstLocal && firstRemote && firstLocal.frame === firstRemote.frame) {
        gameinputbuffer.shift();
        player2buffer.shift();
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

function simulateGame(i1, i2) {
  if (i1.left)  player.vx -= 0.5;
  if (i1.right) player.vx += 0.5;
  if (i1.up)    player.vy -= 0.5;
  if (i1.down)  player.vy += 0.5;

  if (i2.left)  player2.vx -= 0.5;
  if (i2.right) player2.vx += 0.5;
  if (i2.up)    player2.vy -= 0.5;
  if (i2.down)  player2.vy += 0.5;

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

  update(player);
  update(player2);

  for (let ball of balls) {
    for (let other_ball of balls) {
      if (ball === other_ball) continue;

      collision(ball, other_ball);
    }

    collision(ball, player);
    collision(ball, player2);

    update(ball);
  }


  ctx.clearRect(0,0,800,700);

  ctx.fillStyle = 'green';
  ctx.beginPath();
  ctx.arc(player.x, player.y, ballRadius, 0, 2*Math.PI); 
  ctx.fill();

  ctx.fillStyle = 'red';
  ctx.beginPath();
  ctx.arc(player2.x, player2.y, ballRadius, 0, 2*Math.PI); 
  ctx.fill();

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
