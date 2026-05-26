import './styles/base.css';
import { createRoot } from 'react-dom/client';
import { GameApp } from './ui/GameApp';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('Missing #app root');
}

createRoot(root).render(<GameApp />);
