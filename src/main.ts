import './styles/base.css';
import { GameApp } from './ui/GameApp';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('Missing #app root');
}

new GameApp(root);
