// Full rewritten simple PixiJS game for debugging

import { Application, Container, Text, Graphics } from 'pixi.js';

const app = new Application();

async function initGame() {
  await app.init({
    background: '#0a0a2a',
    resizeTo: window,
    antialias: true,
  });

  document.body.appendChild(app.canvas);
  app.canvas.style.display = 'block';

  // Big visible text
  const title = new Text({
    text: 'RACE PLATFORMER',
    style: { fontSize: 72, fill: '#ffffff', fontWeight: 'bold' }
  });
  title.anchor.set(0.5);
  title.x = app.screen.width / 2;
  title.y = app.screen.height / 3;

  const startText = new Text({
    text: 'CLICK OR PRESS SPACE TO START',
    style: { fontSize: 36, fill: '#00ffcc' }
  });
  startText.anchor.set(0.5);
  startText.x = app.screen.width / 2;
  startText.y = app.screen.height / 2;

  const container = new Container();
  container.addChild(title, startText);
  app.stage.addChild(container);

  // Click handler
  const start = () => {
    alert('Game would start here!');
  };
  app.canvas.addEventListener('pointerdown', start);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') start();
  });

  console.log('✅ Game initialized successfully');
}

initGame().catch(err => {
  console.error('Init failed:', err);
  document.body.innerHTML += '<h1 style="color:red">ERROR: ' + err.message + '</h1>';
});

export {};
