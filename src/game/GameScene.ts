import Phaser from 'phaser';
import { buyMetaUpgrade, claimBankruptcyReward, chooseLesson, createInitialState, isBankrupt, launchCost, restartCompany, simulateLaunch } from '../sim/game';
import { lessonById, lessonEffectText } from '../sim/lessons';
import { clearSave, loadGame, saveGame } from '../sim/save';
import type { GameState } from '../sim/types';
import { DomMetaProgressView } from './views/DomMetaProgressView';
import { DevStatsView } from './views/DevStatsView';
import { DomUiView } from './views/DomUiView';
import { EffectsView } from './views/EffectsView';
import { RocketView } from './views/RocketView';
import { WorldView } from './views/WorldView';

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private world!: WorldView;
  private rocket!: RocketView;
  private ui!: DomUiView;
  private devStats!: DevStatsView;
  private metaProgress!: DomMetaProgressView;
  private effects!: EffectsView;
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
    this.ui = new DomUiView({
      onPrimary: () => void this.primaryAction(),
      onMeta: () => this.openMetaProgress(),
      onMenuReset: () => this.resetGame(),
    });
    this.devStats = new DevStatsView(this);
    this.metaProgress = new DomMetaProgressView({
      onBuy: (id) => this.buyMeta(id),
      onContinue: () => void this.startNextCompany(),
    });

    this.rocket.resetToHangar();
    this.cameras.main.setBounds(0, -3200, 1280, 3920);
    this.resetCamera();
    this.input.keyboard?.on('keydown-D', () => this.devStats.toggle());
    this.renderState();

    if (this.state.pendingLessonChoices.length > 0) {
      void this.showLessonCards();
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
    this.ui.beginLaunchRoll(this.state.rocketStats.reliability);

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

    this.ui.animateLaunchRoll(result.rolledStats, this.state.rocketStats.reliability, launchRollDuration);

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

    this.resetCamera();
    this.nextLaunchPrep = this.rocket.recycleToPad().finally(() => {
      this.nextLaunchPrep = undefined;
    });

    this.ui.endLaunchRoll(this.state.rocketStats);
    this.persistAndRender();
    await wait(this, 360);
    if (this.state.pendingLessonChoices.length > 0) {
      await this.showLessonCards();
    }
    this.busy = false;
    this.renderState();
  }

  private async showLessonCards(): Promise<void> {
    await this.ui.showLessonChoices(
      this.state.pendingLessonChoices.map((lessonId) => ({
        spec: lessonById[lessonId],
        effectText: lessonEffectText(lessonId, this.state.metaUpgrades, this.state.rocketStats),
      })),
      this.state.lastLaunch,
      (index) => void this.pickLesson(index),
    );
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
    await this.ui.chooseLesson(index);
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
      await this.showLessonCards();
    }
  }

  private resetGame(): void {
    clearSave();
    this.ui.destroyLessonChoices();
    this.ui.hideMenu();
    this.state = createInitialState();
    this.rocket.resetToHangar();
    this.resetCamera();
    this.metaProgress.hide();
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

  private renderState(): void {
    this.world.setCompany(this.state.companyIndex);
    this.ui.update({
      money: this.state.money,
      launchCost: launchCost(this.state),
      bankrupt: isBankrupt(this.state),
      locked: this.busy || this.state.pendingLessonChoices.length > 0,
      stats: this.state.rocketStats,
    });
    this.devStats.update(this.state);
    this.metaProgress.update(this.state);
  }
}

function wait(scene: Phaser.Scene, duration: number): Promise<void> {
  return new Promise((resolve) => {
    scene.time.delayedCall(duration, resolve);
  });
}
