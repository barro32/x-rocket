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
  private static readonly gameplayCenterX = 475;

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
  private currentZoom = 1;

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
    this.cameras.main.setBounds(0, -3200, 1280, 3920);
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => this.layout(gameSize.width, gameSize.height));
    this.layout(this.scale.width, this.scale.height);
    this.resetCamera();
    this.input.keyboard?.on('keydown-D', () => this.devStats.toggle());
    this.renderState();

    if (this.state.pendingLessonChoices.length > 0) {
      this.showLessonCards(this.worldToScreen(new Phaser.Math.Vector2(this.world.launchPad.x, 300)));
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
    const { targets, cardScale } = this.lessonCardLayout(choices.length);
    const uiOrigin = new Phaser.Math.Vector2(origin.x / this.currentZoom, origin.y / this.currentZoom);

    this.activeCards = choices.map((lessonId, index) => {
      const spec = lessonById[lessonId];
      return new LessonCardView(this, {
        spec,
        origin: uiOrigin,
        target: targets[index],
        index,
        scale: cardScale / this.currentZoom,
        onSelect: () => void this.pickLesson(index),
      });
    });

    if (this.state.lastLaunch) {
      this.launchSummary?.container.destroy();
      this.launchSummary = new LaunchSummaryView(this, this.state.lastLaunch);
      this.launchSummary.layout(this.scale.width, this.scale.height, this.currentZoom);
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
    if (this.nextLaunchPrep) {
      await this.nextLaunchPrep;
    }
    this.persistAndRender();
    const point = this.uiPoint(this.scale.width / 2, Math.min(190, this.scale.height * 0.26));
    this.effects.floatingText(lessonById[lessonId].name, point.x, point.y, '#f6e7c7');
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
    const point = this.uiPoint(this.scale.width / 2, Math.min(190, this.scale.height * 0.26));
    this.effects.floatingText('Meta unlocked', point.x, point.y, '#8ef6c5');
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
    const point = this.uiPoint(this.scale.width / 2, 170);
    this.effects.floatingText('+1 knowledge', point.x, point.y, '#8ef6c5');
    if (this.state.pendingLessonChoices.length > 0) {
      await wait(this, 180);
      await this.showLessonCards(this.worldToScreen(new Phaser.Math.Vector2(this.world.launchPad.x, 300)));
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
    this.cameras.main.pan(GameScene.gameplayCenterX, 360, 220, 'Sine.easeOut');
  }

  private worldToScreen(point: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const camera = this.cameras.main;
    return new Phaser.Math.Vector2((point.x - camera.scrollX) * camera.zoom, (point.y - camera.scrollY) * camera.zoom);
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

  private layout(width: number, height: number): void {
    this.currentZoom = Phaser.Math.Clamp(Math.min(width / 860, height / 520), 0.45, 1);
    this.cameras.main.setZoom(this.currentZoom);
    this.hud.layout(width, height, this.currentZoom);
    this.globalMenu.layout(width, height, this.currentZoom);
    this.devStats.layout(width, height, this.currentZoom);
    this.metaProgress.layout(width, height, this.currentZoom);
    this.launchSummary?.layout(width, height, this.currentZoom);
  }

  private lessonCardLayout(count: number): { targets: Phaser.Math.Vector2[]; cardScale: number } {
    const width = this.scale.width;
    const height = this.scale.height;
    const compact = width < 900;
    const cardScale = compact ? 0.82 : 1;

    if (!compact) {
      const spacing = count === 4 ? 270 : 285;
      const startX = width / 2 - ((count - 1) * spacing) / 2;
      return {
        cardScale,
        targets: Array.from({ length: count }, (_, index) => new Phaser.Math.Vector2((startX + index * spacing) / this.currentZoom, 350 / this.currentZoom)),
      };
    }

    const columns = count > 1 ? 2 : 1;
    const rows = Math.ceil(count / columns);
    const horizontalGap = Math.min(230, width * 0.42);
    const verticalGap = 188;
    const startY = Math.max(180, height * 0.42 - ((rows - 1) * verticalGap) / 2);

    return {
      cardScale,
      targets: Array.from({ length: count }, (_, index) => {
        const column = columns === 1 ? 0 : index % 2;
        const row = Math.floor(index / columns);
        const x = columns === 1 ? width / 2 : width / 2 + (column === 0 ? -horizontalGap / 2 : horizontalGap / 2);
        const y = startY + row * verticalGap;
        return new Phaser.Math.Vector2(x / this.currentZoom, y / this.currentZoom);
      }),
    };
  }

  private uiPoint(x: number, y: number): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(x / this.currentZoom, y / this.currentZoom);
  }
}

function wait(scene: Phaser.Scene, duration: number): Promise<void> {
  return new Promise((resolve) => {
    scene.time.delayedCall(duration, resolve);
  });
}
