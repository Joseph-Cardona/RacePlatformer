import { Application } from 'pixi.js';

export class Game {
  private app: Application;

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
    this.app.ticker.add(this.update.bind(this));
  }

  private setupKeyboard() {
    const keys: { [key: string]: boolean } = {};
    (window as any).keys = keys;
    window.addEventListener('keydown', e => { keys[e.key] = true; });
    window.addEventListener('keyup', e => { keys[e.key] = false; });
  }

  private showStartScreen() {
    // Will be filled in next steps
    console.log('Start screen ready');
  }

  private update(ticker: any) {
    // Game loop
  }
}

// Bootstrap
declare global {
  interface Window {
    keys: { [key: string]: boolean };
  }
}

const game = new Game();
game.init().catch(console.error);