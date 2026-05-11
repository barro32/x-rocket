import './DevLaunchPanelView.css';
import type { RocketStats, RocketStatId } from '../../sim/types';

interface DevLaunchPanelConfig {
  onChange: (stats: RocketStats | undefined) => void;
}

const statControls: Array<{ id: RocketStatId; label: string }> = [
  { id: 'thrust', label: 'Thrust' },
  { id: 'fuel', label: 'Fuel' },
  { id: 'aerodynamics', label: 'Aero' },
  { id: 'lightness', label: 'Light' },
  { id: 'guidance', label: 'Guide' },
  { id: 'reliability', label: 'Rel' },
];

export class DevLaunchPanelView {
  private readonly root: HTMLDivElement;
  private readonly enabledInput: HTMLInputElement;
  private readonly resetButton: HTMLButtonElement;
  private readonly sliders = new Map<RocketStatId, HTMLInputElement>();
  private readonly values = new Map<RocketStatId, HTMLSpanElement>();
  private visible = false;
  private enabled = false;
  private baseStats?: RocketStats;

  constructor(private readonly config: DevLaunchPanelConfig) {
    const app = document.querySelector<HTMLDivElement>('#app');
    if (!app) {
      throw new Error('Missing #app root for dev launch panel');
    }

    this.root = document.createElement('div');
    this.root.className = 'dev-launch-panel';
    this.root.innerHTML = `
      <div class="dev-launch-panel__header">
        <label class="dev-launch-panel__toggle">
          <input class="dev-launch-panel__enabled" type="checkbox" />
          <span>Override launch stats</span>
        </label>
        <button class="dev-launch-panel__reset" type="button">Reset</button>
      </div>
      <div class="dev-launch-panel__controls">
        ${statControls.map((stat) => `
          <label class="dev-launch-panel__row">
            <span class="dev-launch-panel__label">${stat.label}</span>
            <input class="dev-launch-panel__slider" data-stat="${stat.id}" type="range" min="0" max="99" step="1" />
            <span class="dev-launch-panel__value" data-value="${stat.id}">0</span>
          </label>
        `).join('')}
      </div>
    `;

    app.append(this.root);

    const enabledInput = this.root.querySelector<HTMLInputElement>('.dev-launch-panel__enabled');
    const resetButton = this.root.querySelector<HTMLButtonElement>('.dev-launch-panel__reset');
    if (!enabledInput || !resetButton) {
      throw new Error('Missing dev launch panel controls');
    }
    this.enabledInput = enabledInput;
    this.resetButton = resetButton;

    statControls.forEach((stat) => {
      const slider = this.root.querySelector<HTMLInputElement>(`.dev-launch-panel__slider[data-stat="${stat.id}"]`);
      const value = this.root.querySelector<HTMLSpanElement>(`.dev-launch-panel__value[data-value="${stat.id}"]`);
      if (!slider || !value) {
        throw new Error(`Missing dev launch panel stat control: ${stat.id}`);
      }

      slider.addEventListener('input', () => {
        value.textContent = slider.value;
        this.enabled = true;
        this.enabledInput.checked = true;
        this.emitChange();
      });
      this.sliders.set(stat.id, slider);
      this.values.set(stat.id, value);
    });

    this.enabledInput.addEventListener('change', () => {
      this.enabled = this.enabledInput.checked;
      this.emitChange();
    });
    this.resetButton.addEventListener('click', () => {
      if (this.baseStats) {
        this.setSliderStats(this.baseStats);
      }
      this.enabled = false;
      this.enabledInput.checked = false;
      this.emitChange();
    });
  }

  toggle(): void {
    this.visible = !this.visible;
    this.root.classList.toggle('dev-launch-panel--visible', this.visible);
  }

  update(baseStats: RocketStats): void {
    this.baseStats = baseStats;
    if (!this.enabled) {
      this.setSliderStats(baseStats);
    }
  }

  clearOverride(): void {
    this.enabled = false;
    this.enabledInput.checked = false;
    if (this.baseStats) {
      this.setSliderStats(this.baseStats);
    }
    this.emitChange();
  }

  private emitChange(): void {
    this.config.onChange(this.enabled ? this.currentStats() : undefined);
  }

  private currentStats(): RocketStats {
    return {
      thrust: this.sliderValue('thrust'),
      fuel: this.sliderValue('fuel'),
      aerodynamics: this.sliderValue('aerodynamics'),
      lightness: this.sliderValue('lightness'),
      guidance: this.sliderValue('guidance'),
      reliability: this.sliderValue('reliability'),
    };
  }

  private setSliderStats(stats: RocketStats): void {
    statControls.forEach((stat) => {
      const slider = this.sliders.get(stat.id);
      const value = this.values.get(stat.id);
      if (!slider || !value) {
        return;
      }

      const statValue = `${Math.round(stats[stat.id])}`;
      slider.value = statValue;
      value.textContent = statValue;
    });
  }

  private sliderValue(id: RocketStatId): number {
    return Number(this.sliders.get(id)?.value ?? 0);
  }
}
