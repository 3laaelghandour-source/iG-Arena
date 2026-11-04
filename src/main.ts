import './styles.css';
import { Game } from './game/Game';

const game = new Game({
  mount: document.querySelector<HTMLDivElement>('#game-root')!,
  onHud: ({ health, score, ammo, reserve, status, accuracy, elapsed }) => {
    document.querySelector('#health-value')!.textContent = String(health);
    document.querySelector<HTMLElement>('#health-fill')!.style.width = `${health}%`;
    document.querySelector('#score-value')!.textContent = String(score).padStart(4, '0');
    document.querySelector('#ammo-value')!.textContent = String(ammo);
    document.querySelector('.ammo-card small')!.textContent = ` / ${reserve}`;
    document.querySelector('#weapon-status')!.textContent = status;
    document.querySelector('#accuracy-value')!.textContent = `${accuracy}%`;
    document.querySelector('#time-value')!.textContent = elapsed;
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
const title = document.querySelector<HTMLElement>('#overlay-title')!;
const description = document.querySelector<HTMLElement>('#overlay-description')!;

startButton.addEventListener('click', () => game.start());

game.onPause = () => {
  title.innerHTML = 'SESSION <em>PAUSED</em>';
  description.textContent = 'Your progress is saved for this session. Resume whenever you are ready.';
  startButton.innerHTML = 'RESUME TRAINING <span>→</span>';
  overlay.classList.remove('hidden');
};

game.onResume = () => {
  overlay.classList.add('hidden');
};

window.addEventListener('beforeunload', () => game.dispose());