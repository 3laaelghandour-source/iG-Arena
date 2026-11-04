import './styles.css';
import { Game } from './game/Game';

const game = new Game({
  mount: document.querySelector<HTMLDivElement>('#game-root')!,
  onHud: ({ health, score, ammo, reserve, status }) => {
    document.querySelector('#health-value')!.textContent = String(health);
    document.querySelector<HTMLElement>('#health-fill')!.style.width = `${health}%`;
    document.querySelector('#score-value')!.textContent = String(score).padStart(4, '0');
    document.querySelector('#ammo-value')!.textContent = String(ammo);
    document.querySelector('.ammo-card small')!.textContent = ` / ${reserve}`;
    document.querySelector('#weapon-status')!.textContent = status;
  },
  onHit: () => {
    const marker = document.querySelector<HTMLElement>('#hit-marker')!;
    marker.classList.remove('show');
    void marker.offsetWidth;
    marker.classList.add('show');
    window.setTimeout(() => marker.classList.remove('show'), 150);
  },
  onMessage: (message) => {
    const toast = document.querySelector<HTMLElement>('#toast')!;
    toast.textContent = message;
    toast.classList.add('visible');
    window.setTimeout(() => toast.classList.remove('visible'), 1400);
  },
});

const overlay = document.querySelector<HTMLElement>('#center-message')!;
const startButton = document.querySelector<HTMLButtonElement>('#start-button')!;
startButton.addEventListener('click', () => {
  game.start();
  overlay.classList.add('hidden');
});
game.onPause = () => overlay.classList.remove('hidden');
game.onResume = () => overlay.classList.add('hidden');

window.addEventListener('beforeunload', () => game.dispose());