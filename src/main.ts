import { Application, Container, Text, Graphics, Ticker } from 'pixi.js';

export interface GameScene {
  container: Container;
  update(delta: number): void;
  destroy?(): void;
}

class StartScreen implements GameScene {
  container = new Container();
  private title: Text;
  private startText: Text;

  constructor(private app: Application, private startGame: () => void) {
    // Background
    const bg = new Graphics()
      .rect(0, 0, app.screen.width, app.screen.height)
      .fill(0x112244);
    this.container.addChild(bg);

    this.title = new Text({
      text: 'RACE\nPLATFORMER',
      style: { 
        fontSize: 72, 
        fill: 0xffffff, 
        fontWeight: 'bold',
        align: 'center'
      }
    });
    this.title.anchor.set(0.5);
    this.title.x = app.screen.width / 2;
    this.title.y = app.screen.height / 3;

    this.startText = new Text({
      text: 'PRESS SPACE OR CLICK TO START',
      style: { fontSize: 32, fill: 0xaaaaaa }
    });
    this.startText.anchor.set(0.5);
    this.startText.x = app.screen.width / 2;
    this.startText.y = app.screen.height / 2 + 80;

    this.container.addChild(this.title, this.startText);

    app.canvas.addEventListener('pointerdown', this.handleStart);
    window.addEventListener('keydown', this.handleKey);
  }

  private handleStart = () => this.startGame();
  private handleKey = (e: KeyboardEvent) => {
    if (e.code === 'Space') this.startGame();
  };

  update() {
    this.startText.alpha = 0.6 + Math.sin(Date.now() / 150) * 0.4;
  }

  destroy() {
    window.removeEventListener('keydown', this.handleKey);
    (this.app.canvas as HTMLCanvasElement).removeEventListener('pointerdown', this.handleStart);
  }
}

class GameLevel implements GameScene {
  container = new Container();
  private player: Graphics;
  private platforms: Graphics[] = [];
  private velocityY = 0;
  private isOnGround = false;
  private goal: Graphics;

  constructor(private app: Application, private onWin: () => void) {
    // Sky background (long level)
    const bg = new Graphics()
      .rect(0, 0, 2000, app.screen.height)
      .fill(0x4488ff);
    this.container.addChild(bg);

    // Platforms
    this.addPlatform(100, 450, 250, 20);
    this.addPlatform(450, 350, 180, 20);
    this.addPlatform(750, 480, 220, 20);
    this.addPlatform(1100, 280, 160, 20);
    this.addPlatform(1350, 420, 280, 20);
    this.addPlatform(1700, 380, 150, 20);

    // Player
    this.player = new Graphics()
      .rect(-16, -48, 32, 48)
      .fill(0xff4444);
    this.player.x = 80;
    this.player.y = 300;
    this.container.addChild(this.player);

    // Goal flag
    this.goal = new Graphics()
      .rect(0, 0, 20, 120)
      .fill(0x00ff88);
    this.goal.x = 1850;
    this.goal.y = 280;
    this.container.addChild(this.goal);
  }

  private addPlatform(x: number, y: number, w: number, h: number) {
    const plat = new Graphics()
      .rect(0, 0, w, h)
      .fill(0x22aa44);
    plat.x = x;
    plat.y = y;
    this.platforms.push(plat);
    this.container.addChild(plat);
  }

  update(delta: number) {
    const speed = 6;
    const keys = (window as any).keys || {};

    // Horizontal movement
    let moving = false;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
      this.player.x -= speed;
      moving = true;
    }
    if (keys['ArrowRight'] || keys['d'] || keys['D']) {
      this.player.x += speed;
      moving = true;
    }

    // Gravity
    this.velocityY += 0.85;
    this.player.y += this.velocityY;

    // Platform collisions
    this.isOnGround = false;
    for (const plat of this.platforms) {
      if (
        this.player.x < plat.x + plat.width &&
        this.player.x + 32 > plat.x &&
        this.player.y + 48 > plat.y &&
        this.player.y + 48 - this.velocityY <= plat.y
      ) {
        this.player.y = plat.y - 48;
        this.velocityY = 0;
        this.isOnGround = true;
      }
    }

    // Floor
    if (this.player.y > 550) {
      this.player.y = 550;
      this.velocityY = 0;
      this.isOnGround = true;
    }

    // Jump
    if ((keys[' '] || keys['Spacebar'] || keys['Space']) && this.isOnGround) {
      this.velocityY = -17;
      this.isOnGround = false;
      // Prevent holding jump
      delete keys[' '];
      delete keys['Space'];
    }

    // Camera follow (smooth)
    const targetCam = -this.player.x + this.app.screen.width * 0.35;
    this.container.x = Math.max(Math.min(targetCam, 0), -1700);

    // Win condition
    if (this.player.x > 1820) {
      this.onWin();
    }
  }
}

export class Game {
  private app: Application;
  private currentScene: GameScene | null = null;

  constructor() {
    this.app = new Application();
  }

  async init() {
    await this.app.init({
      background: '#1099bb',
      resizeTo: window,
      antialias: true,
    });

    document.body.appendChild(this.app.canvas);

    this.setupKeyboard();
    this.showStartScreen();

    this.app.ticker.add((ticker) => this.update(ticker));
  }

  private setupKeyboard() {
    const keys: { [key: string]: boolean } = {};
    (window as any).keys = keys;

    window.addEventListener('keydown', (e) => {
      keys[e.key] = true;
    });

    window.addEventListener('keyup', (e) => {
      keys[e.key] = false;
    });
  }

  private showStartScreen() {
    if (this.currentScene?.destroy) this.currentScene.destroy();
    if (this.currentScene?.container) this.currentScene.container.destroy();

    const startScreen = new StartScreen(this.app, () => this.startLevel());
    this.currentScene = startScreen;
    this.app.stage.addChild(startScreen.container);
  }

  private startLevel() {
    if (this.currentScene?.destroy) this.currentScene.destroy();
    if (this.currentScene?.container) this.currentScene.container.destroy();

    const onWin = () => {
      const time = Math.floor(Date.now() / 1000) % 999;
      alert(`🎉 Level Complete!\nYour time: ${time} seconds`);
      this.showStartScreen();
    };

    const level = new GameLevel(this.app, onWin);
    this.currentScene = level;
    this.app.stage.addChild(level.container);
  }

  private update(ticker: Ticker) {
    if (this.currentScene) {
      this.currentScene.update(ticker.deltaTime);
    }
  }
}

// Start the game
const game = new Game();
game.init().catch(console.error);
