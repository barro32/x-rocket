import Phaser from 'phaser';
import { buyMetaUpgrade, chooseLesson, isBankrupt, launchCost, restartCompany, simulateLaunch } from '../sim/game';
import { lessonById } from '../sim/lessons';
import { loadGame, saveGame } from '../sim/save';
import type { GameState } from '../sim/types';
import { DevStatsView } from './views/DevStatsView';
import { EffectsView } from './views/EffectsView';
import { HudView } from './views/HudView';
import { LaunchSummaryView } from './views/LaunchSummaryView';
import { LessonCardView } from './views/LessonCardView';
import { MetaDevView } from './views/MetaDevView';
import { RocketView } from './views/RocketView';
import { WorldView } from './views/WorldView';

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private world!: WorldView;
  private rocket!: RocketView;
  private hud!: HudView;
  private devStats!: DevStatsView;
  private metaDev!: MetaDevView;
  private effects!: EffectsView;
  private activeCards: LessonCardView[] = [];
  private launchSummary?: LaunchSummaryView;
  private busy = false;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.state = loadGame();
    this.world = new WorldView(this);
    this.rocket = new RocketView(this, this.world.hangarDoor, this.world.launchPad);
    this.effects = new EffectsView(this);
    this.hud = new HudView(this, { onPrimary: () => void this.primaryAction() });
    this.devStats = new DevStatsView(this);
    this.metaDev = new MetaDevView(this, { onBuy: (id) => this.buyMeta(id) });

    this.rocket.resetToHangar();
    this.renderState();

    if (this.state.pendingLessonChoices.length > 0) {
      this.showLessonCards(new Phaser.Math.Vector2(this.world.launchPad.x, 300));
    }
  }

  private async primaryAction(): Promise<void> {
    if (this.busy || this.state.pendingLessonChoices.length > 0) {
      return;
    }

    if (isBankrupt(this.state)) {
      this.state = restartCompany(this.state);
      this.rocket.resetToHangar();
      this.persistAndRender();
      this.effects.floatingText('+1 knowledge', 640, 170, '#8ef6c5');
      return;
    }

    await this.launchSequence();
  }

  private async launchSequence(): Promise<void> {
    this.busy = true;
    this.renderState();

    await this.rocket.rolloutToPad();
    this.effects.ignition(this.world.launchPad.x, this.world.launchPad.y);
    await this.rocket.ignite();

    const beforeLaunches = this.state.launches;
    this.state = simulateLaunch(this.state);
    if (this.state.launches === beforeLaunches) {
      this.busy = false;
      this.persistAndRender();
      return;
    }

    const result = this.state.lastLaunch;
    if (!result) {
      this.busy = false;
      this.persistAndRender();
      return;
    }

    const finalPosition = await this.rocket.flyTo(result.altitudeMeters);
    this.effects.floatingText(`${Math.floor(result.altitudeMeters / 1000)} km`, finalPosition.x, finalPosition.y - 40);

    let cardOrigin = finalPosition;
    if (result.outcome === 'exploded') {
      cardOrigin = this.rocket.explode();
      this.effects.explosion(cardOrigin);
    } else {
      this.rocket.fadeAway();
    }

    this.persistAndRender();
    await wait(this, 360);
    await this.showLessonCards(cardOrigin);
    this.busy = false;
    this.renderState();
  }

  private async showLessonCards(origin: Phaser.Math.Vector2): Promise<void> {
    this.destroyCards();

    const choices = this.state.pendingLessonChoices;
    const spacing = choices.length === 4 ? 270 : 285;
    const startX = 640 - ((choices.length - 1) * spacing) / 2;
    const targetY = 350;

    this.activeCards = choices.map((lessonId, index) => {
      const spec = lessonById[lessonId];
      return new LessonCardView(this, {
        spec,
        origin,
        target: new Phaser.Math.Vector2(startX + index * spacing, targetY),
        index,
        onSelect: () => void this.pickLesson(index),
      });
    });

    if (this.state.lastLaunch) {
      this.launchSummary?.container.destroy();
      this.launchSummary = new LaunchSummaryView(this, this.state.lastLaunch);
    }

    await Promise.all([
      this.launchSummary?.enter(),
      ...this.activeCards.map((card) => card.enter()),
    ]);
  }

  private async pickLesson(index: number): Promise<void> {
    if (this.busy) {
      return;
    }

    const lessonId = this.state.pendingLessonChoices[index];
    if (!lessonId) {
      return;
    }

    this.busy = true;
    const selectedCard = this.activeCards[index];
    const otherCards = this.activeCards.filter((_, cardIndex) => cardIndex !== index);

    await Promise.all([
      this.launchSummary?.exit(),
      selectedCard?.selectAndDestroy(),
      ...otherCards.map((card, cardIndex) => card.rejectAndDestroy(cardIndex % 2 === 0 ? -1 : 1)),
    ]);

    this.activeCards = [];
    this.launchSummary = undefined;
    this.state = chooseLesson(this.state, lessonId);
    this.rocket.resetToHangar();
    this.persistAndRender();
    this.effects.floatingText(lessonById[lessonId].name, 640, 190, '#f6e7c7');
    this.busy = false;
    this.renderState();
  }

  private buyMeta(id: Parameters<typeof buyMetaUpgrade>[1]): void {
    if (this.busy || this.state.pendingLessonChoices.length > 0) {
      return;
    }

    const next = buyMetaUpgrade(this.state, id);
    if (next === this.state) {
      return;
    }

    this.state = next;
    this.rocket.resetToHangar();
    this.persistAndRender();
    this.effects.floatingText('Meta unlocked', 640, 190, '#8ef6c5');
  }

  private persistAndRender(): void {
    saveGame(this.state);
    this.renderState();
  }

  private renderState(): void {
    this.world.setCompany(this.state.companyIndex);
    this.hud.update(
      this.state.money,
      launchCost(this.state),
      isBankrupt(this.state),
      this.busy || this.state.pendingLessonChoices.length > 0,
    );
    this.devStats.update(this.state);
    this.metaDev.update(this.state);
  }

  private destroyCards(): void {
    this.activeCards.forEach((card) => card.container.destroy());
    this.activeCards = [];
    this.launchSummary?.container.destroy();
    this.launchSummary = undefined;
  }
}

function wait(scene: Phaser.Scene, duration: number): Promise<void> {
  return new Promise((resolve) => {
    scene.time.delayedCall(duration, resolve);
  });
}
