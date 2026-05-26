import { Application, Graphics, Text, Container } from 'pixi.js';
import { Client } from 'colyseus.js';
import { GameRoomState } from './schema';


const app = new Application();
let player: Graphics | null = null;
let velocityX = 0, velocityY = 0, isOnGround = false;
let platforms: Graphics[] = [];
let goal: Graphics | null = null;
let timer = 0;
let gameRunning = false;
const keys: Record<string, boolean> = {};
let uiElement: HTMLElement | null;
let cameraX = 0;
let deaths = 0;
let hasFinished = false; // prevent duplicate win messages

// Multiplayer state
let multiplayerRoom: any = null;
const otherPlayers: Map<string, Container> = new Map();
let isMultiplayerConnected = false;
let waitingTicker: (() => void) | null = null;
let connectingTicker: (() => void) | null = null;

const TILE_SIZE = 60;

const levels = [
  {
    name: "Level 1 - Basics",
    data: [
      "........................",
      "........................",
      "........................",
      "S.......................",
      "PP......................",
      ".....PP............G....",
      ".........P........PPP...",
      "..............PP........",
      "........................",
      "........................",
    ]
  },
  {
    name: "Level 2 - Rising",
    data: [
      "........................",
      "........................",
      "........................",
      "S...P..................",
      "PP......................",
      "..........PP...G........",
      "..............PP........",
      "........................",
      "........................",
      "........................",
    ]
  },
  {
    name: "Level 3 - Challenge",
    data: [
      "........................",
      "...........PP...........",
      "......PP................",
      "S.......................",
      "PP......................",
      "..........PP............",
      "....PP.............G....",
      "..................PP....",
      "..PP....................",
      "........................",
    ]
  }
];

function createGhostSprite(color: number, label: string): Container {
  const container = new Container();

  // Ghostly glow aura behind the body
  const glow = new Graphics()
    .roundRect(-4, -4, 48, 48, 10)
    .fill({ color, alpha: 0.12 });
  container.addChild(glow);

  // Semi-transparent ghost body with bright edge
  const body = new Graphics()
    .roundRect(0, 0, 40, 40, 8)
    .fill({ color, alpha: 0.45 })
    .stroke({ width: 2, color: 0xffffff, alpha: 0.25 });
  container.addChild(body);

  // Player label
  const labelText = new Text({
    text: label,
    style: { fontSize: 13, fill: 0xffffff, fontFamily: 'monospace', fontWeight: 'bold' }
  });
  labelText.anchor.set(0.5, 1);
  labelText.x = 20;
  labelText.y = -4;
  container.addChild(labelText);

  return container;
}

function showConnectingScreen() {
  app.stage.removeChildren();

  const bg = new Graphics()
    .rect(0, 0, app.screen.width, app.screen.height)
    .fill({ color: 0x0a0a2a });
  app.stage.addChild(bg);

  const title = new Text({
    text: 'RACE PLATFORMER',
    style: { fontSize: 48, fill: 0xffffff, fontWeight: 'bold' }
  });
  title.anchor.set(0.5);
  title.x = app.screen.width / 2;
  title.y = app.screen.height / 3;
  app.stage.addChild(title);

  const status = new Text({
    text: 'Connecting to server...',
    style: { fontSize: 24, fill: 0x00ffff, fontFamily: 'monospace' }
  });
  status.anchor.set(0.5);
  status.x = app.screen.width / 2;
  status.y = app.screen.height / 2;
  app.stage.addChild(status);

  // Animated dots
  let dotPhase = 0;
  connectingTicker = () => {
    dotPhase = (dotPhase + 0.06) % (Math.PI * 2);
    const dotCount = Math.floor(Math.abs(Math.sin(dotPhase)) * 3) + 1;
    status.text = 'Connecting to server' + '.'.repeat(dotCount) + ' '.repeat(4 - dotCount);
  };
  app.ticker.add(connectingTicker);
}

async function connectMultiplayerWithTimeout() {
  const CONNECT_TIMEOUT_MS = 5000;
  try {
    await Promise.race([
      connectMultiplayer(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out')), CONNECT_TIMEOUT_MS)
      ),
    ]);
  } catch (err) {
    console.warn('⚠️ Could not connect to multiplayer server:', err);
    multiplayerRoom = null;
  }

  // Clean up connecting screen ticker
  if (connectingTicker) {
    app.ticker.remove(connectingTicker);
    connectingTicker = null;
  }
}

async function connectMultiplayer() {
  if (isMultiplayerConnected) return;
  try {
    const client = new Client('ws://localhost:2567');
    multiplayerRoom = await client.joinOrCreate('game', {}, GameRoomState);
    isMultiplayerConnected = true;

    // Listen for player winning
    multiplayerRoom.onMessage('player_won', (data: { winnerId: string; winnerColor: number }) => {
      const isWinner = data.winnerId === multiplayerRoom.sessionId;
      if (isWinner) {
        showLevelComplete('🎉 YOU WON!', data.winnerColor);
      } else {
        const colorName = colorToName(data.winnerColor);
        showLevelComplete(`${colorName} WON!`, data.winnerColor);
      }
    });

    // Listen for opponent joining the room
    multiplayerRoom.onMessage('opponent_joined', () => {
      console.log('👤 Opponent joined the room!');
    });

    // Listen for game start from server
    multiplayerRoom.onMessage('game_start', (data: { levelIndex: number }) => {
      // Clean up waiting screen ticker if active
      if (waitingTicker) {
        app.ticker.remove(waitingTicker);
        waitingTicker = null;
      }
      console.log(`🏁 Game starting! Level ${data.levelIndex}. otherPlayers.size: ${otherPlayers.size}, state_players: ${multiplayerRoom.state.players.size}`);
      multiplayerRoom.state.players.forEach((mp: any, sessionId: string) => {
        if (sessionId === multiplayerRoom.sessionId) return;
        console.log(`   Opp in state: ${sessionId}, otherPlayers.has: ${otherPlayers.has(sessionId)}, color: ${mp.color}`);
      });
      loadLevel(data.levelIndex);
    });

    multiplayerRoom.state.players.onAdd((mp: any, sessionId: string) => {
      if (sessionId === multiplayerRoom.sessionId) {
        console.log(`🔷 onAdd skipped own session: ${sessionId}`);
        return;
      }

      console.log(`🟢 onAdd fire for opponent: ${sessionId}, color: ${mp.color}, pos: (${mp.x}, ${mp.y})`);

      const playerIndex = otherPlayers.size + 1;
      const sprite = createGhostSprite(mp.color, `P${playerIndex}`);
      sprite.x = mp.x;
      sprite.y = mp.y;
      otherPlayers.set(sessionId, sprite);

      // Only show ghost sprites when we're in a level
      if (gameRunning) {
        app.stage.addChild(sprite);
      }

      mp.onChange(() => {
        const s = otherPlayers.get(sessionId);
        if (s) {
          s.x = mp.x;
          s.y = mp.y;
        }
      });

      console.log(`✅ onAdd created sprite for opp ${sessionId}. Stage children count: ${app.stage.children.length}`);
    }, true);

    multiplayerRoom.state.players.onRemove((_mp: any, sessionId: string) => {
      console.log(`🔴 onRemove for ${sessionId}`);
      const sprite = otherPlayers.get(sessionId);
      if (sprite) {
        if (sprite.parent) {
          sprite.removeFromParent();
        }
        sprite.destroy();
        otherPlayers.delete(sessionId);
        console.log(`✅ onRemove cleaned up ${sessionId}`);
      }
    });

    console.log('✅ Connected to multiplayer server, sessionId:', multiplayerRoom.sessionId);
    console.log('   Room has', multiplayerRoom.state.players.size, 'player(s) already');
  } catch (_err) {
    console.warn('❌ Could not connect to multiplayer server (is it running?)');
    multiplayerRoom = null;
  }
}

function cancelWaiting() {
  if (multiplayerRoom) {
    multiplayerRoom.send('cancel_wait');
  }
  if (waitingTicker) {
    app.ticker.remove(waitingTicker);
    waitingTicker = null;
  }
  showStartScreen();
}

function sendPosition() {
  if (multiplayerRoom && player) {
    multiplayerRoom.send('move', { x: player.x, y: player.y });
  }
}

async function init() {
  await app.init({ background: '#0a0a2a', resizeTo: window, antialias: true });
  document.body.appendChild(app.canvas as HTMLCanvasElement);
  uiElement = document.getElementById('ui');

  window.addEventListener('keydown', e => { keys[e.key] = true; });
  window.addEventListener('keyup', e => { keys[e.key] = false; });

  app.ticker.add(gameLoop);

  // Show connecting screen while establishing multiplayer connection
  showConnectingScreen();
  await connectMultiplayerWithTimeout();

  showStartScreen();
}

function showStartScreen() {
  app.stage.removeChildren();

  const title = new Text({
    text: 'RACE PLATFORMER',
    style: { fontSize: 72, fill: 0xffffff, fontWeight: 'bold' }
  });
  title.anchor.set(0.5);
  title.x = app.screen.width / 2;
  title.y = app.screen.height / 3;

  const startText = new Text({
    text: 'CLICK OR PRESS SPACE TO START',
    style: { fontSize: 36, fill: 0x00ffff }
  });
  startText.anchor.set(0.5);
  startText.x = app.screen.width / 2;
  startText.y = app.screen.height / 2;

  app.stage.addChild(title, startText);

  const startHandler = () => {
    if (multiplayerRoom) {
      // Signal server we're done with the previous game (if any) and queue up
      multiplayerRoom.send('start');
      showWaitingScreen();
    } else {
      // Fallback: play solo if server not available
      loadLevel(Math.floor(Math.random() * levels.length));
    }
  };
  app.canvas!.addEventListener('pointerdown', startHandler, { once: true });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      startHandler();
    }
  }, { once: true });
}

function showWaitingScreen() {
  app.stage.removeChildren();

  // Animated background
  const bg = new Graphics()
    .rect(0, 0, app.screen.width, app.screen.height)
    .fill({ color: 0x0a0a2a });
  app.stage.addChild(bg);

  // Waiting text
  const searchText = new Text({
    text: 'WAITING FOR OPPONENT',
    style: {
      fontSize: 48,
      fill: 0x00ffff,
      fontWeight: 'bold',
      fontFamily: 'monospace',
      letterSpacing: 4,
    }
  });
  searchText.anchor.set(0.5);
  searchText.x = app.screen.width / 2;
  searchText.y = app.screen.height / 3;
  app.stage.addChild(searchText);

  // Animated dots
  const dots = new Text({
    text: '.',
    style: { fontSize: 64, fill: 0x00ffff, fontFamily: 'monospace' }
  });
  dots.anchor.set(0.5);
  dots.x = app.screen.width / 2;
  dots.y = app.screen.height / 3 + 60;
  app.stage.addChild(dots);

  // Pulsing ring
  const ring = new Graphics();
  app.stage.addChild(ring);

  // Cancel prompt
  const cancelText = new Text({
    text: 'PRESS ESC TO CANCEL',
    style: { fontSize: 22, fill: 0x888888, fontFamily: 'monospace' }
  });
  cancelText.anchor.set(0.5);
  cancelText.x = app.screen.width / 2;
  cancelText.y = app.screen.height * 0.75;
  app.stage.addChild(cancelText);

  // Animate
  let frame = 0;
  let dotPhase = 0;
  let ringRadius = 0;
  let canceled = false;

  waitingTicker = () => {
    if (canceled) return;
    frame++;

    // Animate dots: . .. ... .... .. .
    dotPhase = (dotPhase + 0.06) % (Math.PI * 2);
    const dotCount = Math.floor(Math.abs(Math.sin(dotPhase)) * 3) + 1;
    dots.text = '.'.repeat(dotCount) + ' '.repeat(4 - dotCount);

    // Pulse search text
    searchText.alpha = 0.7 + 0.3 * Math.sin(frame * 0.04);

    // Expanding ring
    ringRadius += 0.6;
    if (ringRadius > 200) ringRadius = 0;
    const ringAlpha = Math.max(0, 1 - ringRadius / 200);
    ring.clear();
    ring.circle(app.screen.width / 2, app.screen.height / 2, ringRadius);
    ring.stroke({ width: 2, color: 0x00ffff, alpha: ringAlpha * 0.3 });

    // Cancel text pulse
    cancelText.alpha = 0.5 + 0.5 * Math.sin(frame * 0.05);
  };
  app.ticker.add(waitingTicker);

  const cancelHandler = () => {
    if (canceled) return;
    canceled = true;
    if (waitingTicker) {
      app.ticker.remove(waitingTicker);
      waitingTicker = null;
    }
    cancelWaiting();
  };

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cancelHandler();
  }, { once: true });
  app.canvas!.addEventListener('pointerdown', cancelHandler, { once: true });
}

function loadLevel(levelIndex: number) {
  const level = levels[levelIndex];
  gameRunning = true;
  timer = 0;
  deaths = 0;
  velocityX = velocityY = 0;
  cameraX = 0;
  platforms = [];

  app.stage.removeChildren();

  const bg = new Graphics().rect(0, 0, 4000, app.screen.height).fill(0x112244);
  app.stage.addChild(bg);

  let spawnX = 120;
  let spawnY = 300;

  function addPlatform(x: number, y: number, color?: number) {
    const c = color || 0x00bb44;
    const p = new Graphics().rect(0, 0, TILE_SIZE, TILE_SIZE).fill(c);
    p.x = x; p.y = y;
    app.stage.addChild(p);
    platforms.push(p);
  }

  for (let row = 0; row < level.data.length; row++) {
    for (let col = 0; col < level.data[row].length; col++) {
      const tile = level.data[row][col];
      const x = col * TILE_SIZE + 80;
      const y = row * TILE_SIZE + 120;

      if (tile === 'P') {
        addPlatform(x, y);
      } else if (tile === 'S') {
        spawnX = x + 10;
        spawnY = y - TILE_SIZE - 5;
      } else if (tile === 'G') {
        goal = new Graphics().rect(0, 0, TILE_SIZE, TILE_SIZE).fill(0xffd700);
        goal.x = x; goal.y = y;
        app.stage.addChild(goal);
      }
    }
  }

  // Player
  player = new Graphics();
  player.roundRect(0, 0, 40, 40, 8);
  player.fill(0x111111);
  player.stroke({ width: 4, color: 0x222222 });
  player.x = spawnX;
  player.y = spawnY;
  app.stage.addChild(player);

  // Ensure all remote players have sprites
  if (multiplayerRoom && multiplayerRoom.state && multiplayerRoom.state.players) {
    multiplayerRoom.state.players.forEach((mp: any, sessionId: string) => {
      if (sessionId === multiplayerRoom.sessionId) return;

      if (otherPlayers.has(sessionId)) {
        // Re-add existing sprite
        const sprite = otherPlayers.get(sessionId)!;
        app.stage.addChild(sprite);
      } else {
        // Create sprite for any player missed by onAdd race condition
        console.log(`Creating ghost sprite for late-joining player ${sessionId}`);
        const playerIndex = otherPlayers.size + 1;
        const sprite = createGhostSprite(mp.color, `P${playerIndex}`);
        sprite.x = mp.x;
        sprite.y = mp.y;
        app.stage.addChild(sprite);
        otherPlayers.set(sessionId, sprite);

        mp.onChange(() => {
          const s = otherPlayers.get(sessionId);
          if (s) {
            s.x = mp.x;
            s.y = mp.y;
          }
        });
      }
    });
  }

  hasFinished = false;
  console.log(`Loaded ${level.name}`);
}

function colorToName(color: number): string {
  const names: Record<number, string> = {
    0xff4444: 'Red', 0x44ff44: 'Green', 0x4444ff: 'Blue', 0xffff44: 'Yellow',
    0xff44ff: 'Magenta', 0x44ffff: 'Cyan', 0xff8844: 'Orange', 0x88ff44: 'Lime',
  };
  return names[color] || 'Unknown';
}

function showLevelComplete(bannerText: string, bannerColor?: number) {
  gameRunning = false;
  app.stage.x = 0;
  let dismissed = false;

  const overlay = new Container();
  const bg = new Graphics()
    .rect(0, 0, app.screen.width, app.screen.height)
    .fill({ color: 0x000000, alpha: 0.75 });
  overlay.addChild(bg);

  const title = new Text({
    text: bannerText,
    style: {
      fontSize: 64, fill: bannerColor || 0xffd700, fontWeight: 'bold', fontFamily: 'monospace',
      dropShadow: { color: 0xff8c00, blur: 16, distance: 4, angle: Math.PI / 2 },
    }
  });
  title.anchor.set(0.5);
  title.x = app.screen.width / 2;
  title.y = app.screen.height / 3;
  title.alpha = 0;
  overlay.addChild(title);

  const stats = new Text({
    text: `Time: ${timer.toFixed(1)}s    Deaths: ${deaths}`,
    style: { fontSize: 28, fill: 0xffffff, fontFamily: 'monospace' }
  });
  stats.anchor.set(0.5);
  stats.x = app.screen.width / 2;
  stats.y = app.screen.height / 2;
  stats.alpha = 0;
  overlay.addChild(stats);

  const prompt = new Text({
    text: 'PRESS SPACE OR CLICK TO CONTINUE',
    style: { fontSize: 22, fill: 0x00ffff, fontFamily: 'monospace' }
  });
  prompt.anchor.set(0.5);
  prompt.x = app.screen.width / 2;
  prompt.y = app.screen.height * 0.65;
  prompt.alpha = 0;
  overlay.addChild(prompt);

  const stars: Graphics[] = [];
  const starColors = [0xffd700, 0xff6347, 0x00ffff, 0x7fff00, 0xff69b4];
  for (let i = 0; i < 40; i++) {
    const star = new Graphics()
      .circle(0, 0, 2 + Math.random() * 3)
      .fill({ color: starColors[Math.floor(Math.random() * starColors.length)] });
    star.x = Math.random() * app.screen.width;
    star.y = -Math.random() * app.screen.height;
    (star as any).speedY = 1 + Math.random() * 3;
    (star as any).speedX = (Math.random() - 0.5) * 1.5;
    overlay.addChild(star);
    stars.push(star);
  }

  app.stage.addChild(overlay);

  let elapsed = 0;
  const overlayTicker = () => {
    elapsed++;
    const progress = Math.min(elapsed / 30, 1);
    title.alpha = progress;
    stats.alpha = Math.max(0, (progress - 0.3) / 0.7);
    prompt.alpha = Math.max(0, (progress - 0.5) / 0.5) * (0.6 + 0.4 * Math.sin(elapsed * 0.06));

    for (const star of stars) {
      star.y += (star as any).speedY;
      star.x += (star as any).speedX;
      star.rotation += 0.02;
      if (star.y > app.screen.height + 10) {
        star.y = -10;
        star.x = Math.random() * app.screen.width;
      }
    }
  };
  app.ticker.add(overlayTicker);

  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    app.ticker.remove(overlayTicker);
    app.stage.removeChild(overlay);
    overlay.destroy({ children: true });
    showStartScreen();
  };

  app.canvas!.addEventListener('pointerdown', dismiss, { once: true });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === 'Enter') dismiss();
  }, { once: true });
}

function die() {
  deaths++;
  if (player) {
    player.x = 120;
    player.y = 300;
  }
  velocityX = velocityY = 0;
  cameraX = 0;
}

function gameLoop() {
  if (!gameRunning || !player) return;

  timer += 1 / 60;
  if (uiElement) {
    let text = `Time: ${timer.toFixed(1)}s | Deaths: ${deaths}`;
    if (isMultiplayerConnected && multiplayerRoom) {
      text += ` | Players: ${otherPlayers.size + 1}`;
    }
    uiElement.textContent = text;
  }

  const MOVE_SPEED = 11.5;
  const ACCEL = 2.0;
  const FRICTION = 0.78;
  const AIR_FRICTION = 0.94;
  const JUMP_FORCE = -19.5;
  const GRAVITY = 1.25;
  const TERMINAL_VELOCITY = 22;
  const JUMP_CUT = 0.55;

  let targetSpeed = 0;
  if (keys['ArrowLeft'] || keys['a'] || keys['A']) targetSpeed = -MOVE_SPEED;
  if (keys['ArrowRight'] || keys['d'] || keys['D']) targetSpeed = MOVE_SPEED;

  velocityX += (targetSpeed - velocityX) * ACCEL;
  velocityX *= (isOnGround ? FRICTION : AIR_FRICTION);
  player.x += velocityX;

  for (const p of platforms) {
    if (player.x + 40 > p.x && player.x < p.x + p.width &&
        player.y + 40 > p.y && player.y < p.y + p.height) {
      if (velocityX > 0) player.x = p.x - 40;
      if (velocityX < 0) player.x = p.x + p.width;
      velocityX = 0;
    }
  }

  velocityY += GRAVITY;
  if (velocityY > TERMINAL_VELOCITY) velocityY = TERMINAL_VELOCITY;
  player.y += velocityY;

  if (!keys[' '] && !keys['ArrowUp'] && !keys['w'] && !keys['W'] && velocityY < 0) {
    velocityY *= JUMP_CUT;
  }

  isOnGround = false;
  for (const p of platforms) {
    if (player.x + 40 > p.x && player.x < p.x + p.width &&
        player.y + 40 > p.y && player.y < p.y + p.height) {
      if (velocityY > 0) {
        player.y = p.y - 40;
        velocityY = 0;
        isOnGround = true;
      } else if (velocityY < 0) {
        player.y = p.y + p.height;
        velocityY = 0;
      }
    }
  }

  if (player.y > 650) die();

  if ((keys[' '] || keys['ArrowUp'] || keys['w'] || keys['W']) && isOnGround) {
    velocityY = JUMP_FORCE;
    isOnGround = false;
  }

  player.x = Math.round(player.x);
  player.y = Math.round(player.y);

  const targetCam = -player.x + app.screen.width / 3;
  cameraX = cameraX * 0.85 + targetCam * 0.15;
  app.stage.x = Math.round(Math.max(Math.min(cameraX, 0), -3200));

  // Send position to multiplayer server
  sendPosition();

  // Goal collision check
  if (!hasFinished && goal && player.x + 40 > goal.x && player.x < goal.x + goal.width &&
      player.y + 40 >= goal.y && player.y < goal.y + goal.height) {
    hasFinished = true;
    if (multiplayerRoom) {
      multiplayerRoom.send('win');
    } else {
      showLevelComplete('LEVEL COMPLETE');
    }
  }
}

init().catch(console.error);
