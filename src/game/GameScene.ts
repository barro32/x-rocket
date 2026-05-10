import Phaser from 'phaser';
import { buyMetaUpgrade, claimBankruptcyReward, chooseLesson, createInitialState, isBankrupt, launchCost, restartCompany, simulateLaunch } from '../sim/game';
import { lessonById } from '../sim/lessons';
import { clearSave, loadGame, saveGame } from '../sim/save';
import type { GameState } from '../sim/types';
import { DevStatsView } from './views/DevStatsView';
import { EffectsView } from './views/EffectsView';
import { GlobalMenuView } from './views/GlobalMenuView';
import { HudView } from './views/HudView';
import { LaunchSummaryView } from './views/LaunchSummaryView';
import { LessonCardView } from './views/LessonCardView';
import { MetaProgressView } from './views/MetaProgressView';
import { RocketView } from './views/RocketView';
import { WorldView } from './views/WorldView';

export class GameScene extends Phaser.Scene {
  private static readonly baseWidth = 1280;
  private static readonly baseHeight = 720;

  private state!: GameState;
  private world!: WorldView;
  private rocket!: RocketView;
  private hud!: HudView;
  private globalMenu!: GlobalMenuView;
  private devStats!: DevStatsView;
  private metaProgress!: MetaProgressView;
  private effects!: EffectsView;
  private activeCards: LessonCardView[] = [];
  private launchSummary?: LaunchSummaryView;
  private nextLaunchPrep?: Promise<void>;
  private busy = false;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.state = loadGame();
    this.world = new WorldView(this);
    this.rocket = new RocketView(this, this.world.hangarDoor, this.world.launchPad);
    this.effects = new EffectsView(this);
    this.globalMenu = new GlobalMenuView(this, { onReset: () => this.resetGame() });
    this.hud = new HudView(this, {
      onPrimary: () => void this.primaryAction(),
      onMeta: () => this.openMetaProgress(),
      onMenu: () => this.globalMenu.show(),
    });
    this.devStats = new DevStatsView(this);
    this.metaProgress = new MetaProgressView(this, {
      onBuy: (id) => this.buyMeta(id),
      onContinue: () => void this.startNextCompany(),
    });

    this.rocket.resetToHangar();
    this.cameras.main.setBounds(0, -3200, GameScene.baseWidth, 3920);
    this.resetCamera();
    this.scale.on('resize', this.handleResize, this);
    this.input.keyboard?.on('keydown-D', () => this.devStats.toggle());
    this.handleResize(this.scale.gameSize);
    this.renderState();

    if (this.state.pendingLessonChoices.length > 0) {
      this.showLessonCards(this.defaultCardOrigin());
    }
  }

  private async primaryAction(): Promise<void> {
    if (this.busy || this.state.pendingLessonChoices.length > 0) {
      return;
    }

    if (isBankrupt(this.state)) {
      this.openMetaProgress();
      return;
    }

    await this.launchSequence();
  }

  private async launchSequence(): Promise<void> {
    this.busy = true;
    this.renderState();
    this.hud.beginLaunchRoll(this.state.rocketStats.reliability);

    await this.rocket.rolloutToPad();

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

    const launchProfile = {
      ...result.rolledStats,
      reliability: this.state.rocketStats.reliability / 99,
    };
    const launchRollDuration = this.rocket.ignitionDuration(launchProfile) + this.rocket.flightDuration(result.altitudeMeters, launchProfile);

    this.hud.animateLaunchRoll(result.rolledStats, this.state.rocketStats.reliability, launchRollDuration);

    this.effects.ignition(this.world.launchPad.x, this.world.launchPad.y, {
      thrust: result.rolledStats.thrust,
      fuel: result.rolledStats.fuel,
    });
    await this.rocket.ignite(launchProfile);

    this.cameras.main.startFollow(this.rocket.sprite, true, 0.08, 0.12, 0, 130);
    const finalPosition = await this.rocket.flyTo(result.altitudeMeters, launchProfile);
    this.cameras.main.stopFollow();
    this.effects.floatingText(`${Math.floor(result.altitudeMeters)} m | Score ${Math.floor(result.score)}`, finalPosition.x, finalPosition.y - 40);

    let cardOrigin = finalPosition;
    if (result.outcome === 'exploded') {
      cardOrigin = this.rocket.explode();
      this.effects.explosion(cardOrigin);
    } else {
      this.rocket.fadeAway();
    }

    const cardScreenOrigin = this.worldToScreen(cardOrigin);
    this.resetCamera();
    this.nextLaunchPrep = this.rocket.recycleToPad().finally(() => {
      this.nextLaunchPrep = undefined;
    });

    this.hud.endLaunchRoll(this.state.rocketStats);
    this.persistAndRender();
    await wait(this, 360);
    await this.showLessonCards(cardScreenOrigin);
    this.busy = false;
    this.renderState();
  }

  private async showLessonCards(origin: Phaser.Math.Vector2): Promise<void> {
    this.destroyCards();

    const choices = this.state.pendingLessonChoices;
    const cardLayout = this.calculateLessonLayout(choices.length);

    this.activeCards = choices.map((lessonId, index) => {
      const spec = lessonById[lessonId];
      return new LessonCardView(this, {
        spec,
        origin,
        target: cardLayout.targets[index],
        scale: cardLayout.scale,
        index,
        onSelect: () => void this.pickLesson(index),
      });
    });

    if (this.state.lastLaunch) {
      this.launchSummary?.container.destroy();
      this.launchSummary = new LaunchSummaryView(this, this.state.lastLaunch);
    }

    this.layoutActiveCards(false);

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
    if (this.nextLaunchPrep) {
      await this.nextLaunchPrep;
    }
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
    this.metaProgress.update(this.state);
    this.effects.floatingText('Meta unlocked', 640, 190, '#8ef6c5');
  }

  private openMetaProgress(): void {
    if (this.busy || this.state.pendingLessonChoices.length > 0) {
      return;
    }

    if (isBankrupt(this.state)) {
      this.state = claimBankruptcyReward(this.state);
      this.persistAndRender();
    }

    this.metaProgress.show(this.state);
  }

  private async startNextCompany(): Promise<void> {
    if (!isBankrupt(this.state)) {
      this.metaProgress.hide();
      return;
    }

    this.state = restartCompany(this.state);
    this.rocket.resetToHangar();
    this.resetCamera();
    this.persistAndRender();
    this.metaProgress.hide();
    this.effects.floatingText('+1 knowledge', 640, 170, '#8ef6c5');
    if (this.state.pendingLessonChoices.length > 0) {
      await wait(this, 180);
      await this.showLessonCards(this.defaultCardOrigin());
    }
  }

  private resetGame(): void {
    clearSave();
    this.destroyCards();
    this.state = createInitialState();
    this.rocket.resetToHangar();
    this.resetCamera();
    this.metaProgress.hide();
    this.globalMenu.hide();
    this.persistAndRender();
  }

  private persistAndRender(): void {
    saveGame(this.state);
    this.renderState();
  }

  private resetCamera(): void {
    this.cameras.main.stopFollow();
    this.cameras.main.pan(640, 360, 220, 'Sine.easeOut');
  }

  private worldToScreen(point: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const camera = this.cameras.main;
    return new Phaser.Math.Vector2(
      (point.x - camera.scrollX) * camera.zoom,
      (point.y - camera.scrollY) * camera.zoom,
    );
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    const width = gameSize.width;
    const height = gameSize.height;
    const zoom = Math.min(width / GameScene.baseWidth, height / GameScene.baseHeight);

    this.cameras.main.setViewport(0, 0, width, height);
    this.cameras.main.setZoom(zoom);

    this.hud.layout(width, height);
    this.globalMenu.layout(width, height);
    this.devStats.layout(width);
    this.metaProgress.layout(width, height);
    this.launchSummary?.layout(width, height);
    this.layoutActiveCards();
  }

  private layoutActiveCards(animate = true): void {
    if (this.activeCards.length === 0) {
      return;
    }

    const cardLayout = this.calculateLessonLayout(this.activeCards.length);
    this.activeCards.forEach((card, index) => {
      card.layout(cardLayout.targets[index], cardLayout.scale, animate ? 180 : 0);
    });
    this.launchSummary?.layout(this.scale.width, this.scale.height);
  }

  private defaultCardOrigin(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.scale.width / 2, Math.min(this.scale.height * 0.42, 300));
  }

  private calculateLessonLayout(count: number): { scale: number; targets: Phaser.Math.Vector2[] } {
    const width = this.scale.width;
    const height = this.scale.height;
    const compact = width < 760;

    if (!compact) {
      const spacing = count === 4 ? 270 : 285;
      const startX = width / 2 - ((count - 1) * spacing) / 2;
      const targetY = Math.min(height - 170, 350);
      return {
        scale: 1,
        targets: Array.from({ length: count }, (_, index) => new Phaser.Math.Vector2(startX + index * spacing, targetY)),
      };
    }

    const columns = count <= 2 ? 1 : 2;
    const rows = Math.ceil(count / columns);
    const horizontalGap = 18;
    const verticalGap = 18;
    const scale = Phaser.Math.Clamp(
      (width - 36 - (columns - 1) * horizontalGap) / (columns * 250),
      0.58,
      0.82,
    );
    const cardWidth = 250 * scale;
    const cardHeight = 172 * scale;
    const startY = Math.max(220, height - rows * cardHeight - (rows - 1) * verticalGap - 120);

    const targets: Phaser.Math.Vector2[] = [];
    for (let index = 0; index < count; index += 1) {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const itemsInRow = row === rows - 1 && count % columns !== 0 ? count % columns : columns;
      const rowWidth = itemsInRow * cardWidth + (itemsInRow - 1) * horizontalGap;
      const startX = width / 2 - rowWidth / 2 + cardWidth / 2;
      targets.push(new Phaser.Math.Vector2(startX + column * (cardWidth + horizontalGap), startY + row * (cardHeight + verticalGap)));
    }

    return { scale, targets };
  }

  private renderState(): void {
    this.world.setCompany(this.state.companyIndex);
    this.hud.update(
      this.state.money,
      launchCost(this.state),
      isBankrupt(this.state),
      this.busy || this.state.pendingLessonChoices.length > 0,
      this.state.rocketStats,
    );
    this.devStats.update(this.state);
    this.metaProgress.update(this.state);
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
