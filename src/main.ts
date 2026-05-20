import { Application, Container, Text } from 'pixi.js';

const app = new Application();

async function init() {
  await app.init({
    background: '#0a0a2a',
    resizeTo: window,
  });

  document.body.appendChild(app.canvas);

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

  console.log('✅ Game initialized successfully - You should see dark blue background and text!');

  // Click handler
  app.canvas.addEventListener('pointerdown', () => {
    alert('Game works! 🎉 Now we can build the platformer.');
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      alert('Game works! 🎉');
    }
  });
}

init().catch(console.error);
