import Phaser from 'phaser';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { categoryColors } from '../sim/categories';
import type { DiceCategory, DieRoll, LaunchResult, RollEvent } from '../sim/types';

interface DiceView {
  category: DiceCategory;
  group: THREE.Group;
  mesh: THREE.Mesh;
  roll: DieRoll;
}

export class RollStage {
  private renderer?: THREE.WebGLRenderer;
  private threeScene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private animationFrame?: number;

  constructor(private readonly scene: Phaser.Scene) {}

  async play(result?: LaunchResult): Promise<void> {
    if (!result) {
      return;
    }

    this.destroy();
    this.setupThree();
    const diceViews = new Map<DiceCategory, DiceView>();

    result.roll.rolls.forEach((roll, index) => {
      const view = this.createDie(roll, -3.2 + index * 1.6, 0.1);
      diceViews.set(roll.category, view);
    });

    await this.delay(280);
    for (const event of result.roll.events) {
      const die = diceViews.get(event.category);
      if (!die) {
        continue;
      }

      if (event.type === 'initialRoll') {
        await this.rollDie(die, event.faceIndex, 720);
      } else if (event.type === 'reroll') {
        await this.showText('REROLL LOWEST', categoryColors[event.category], 0, 2.45, 0.52);
        await this.rollDie(die, event.faceIndex, 860);
        await this.showChange(die, `${event.before}`, 'REROLL', `${event.after}`);
      } else {
        await this.showText(event.cardName, categoryColors[event.category], 0, 2.45, 0.44);
        await this.cardHit(die, event);
      }
    }

    await this.finalResult(result);
    await this.fadeOut();
    this.destroy();
  }

  destroy(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
    }
    this.renderer?.domElement.remove();
    this.renderer?.dispose();
    this.renderer = undefined;
    this.threeScene = undefined;
    this.camera = undefined;
  }

  private setupThree(): void {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    Object.assign(this.renderer.domElement.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '5',
      pointerEvents: 'none',
    });
    document.body.append(this.renderer.domElement);

    this.threeScene = new THREE.Scene();
    this.threeScene.fog = new THREE.FogExp2(0x050914, 0.055);
    this.camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 0.2, 9.3);
    this.camera.lookAt(0, 0.1, 0);

    const ambient = new THREE.AmbientLight(0x8fa6c4, 1.25);
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(-3, 4, 5);
    key.castShadow = true;
    const rim = new THREE.PointLight(0x9ed8ff, 7.5, 12);
    rim.position.set(3.8, 1.4, 3.8);
    this.threeScene.add(ambient, key, rim);

    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 10),
      new THREE.MeshBasicMaterial({ color: 0x050914, transparent: true, opacity: 0.76 }),
    );
    bg.position.z = -2.4;
    this.threeScene.add(bg);

    this.addStarfield();
    this.renderLoop();
  }

  private createDie(roll: DieRoll, x: number, y: number): DiceView {
    const geometry = new RoundedBoxGeometry(1.08, 1.08, 1.08, 8, 0.16);
    const mesh = new THREE.Mesh(geometry, diceMaterials(roll.category, roll.faces));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.rotation.set(-0.42, 0.62, -0.12);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.86, 32, 16),
      new THREE.MeshBasicMaterial({
        color: colorNumber(categoryColors[roll.category]),
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
      }),
    );
    glow.scale.set(1.22, 1.22, 0.26);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.78, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, -0.78, 0.18);

    const group = new THREE.Group();
    group.position.set(x, y - 0.55, 0);
    group.scale.setScalar(0.01);
    group.add(shadow, glow, mesh);
    this.threeScene?.add(group);

    const view = { category: roll.category, group, mesh, roll };
    void this.tweenScalar(group.scale, 'x', 1, 360, easeOutBack);
    void this.tweenScalar(group.scale, 'y', 1, 360, easeOutBack);
    void this.tweenScalar(group.scale, 'z', 1, 360, easeOutBack);
    void this.tweenVector(group.position, { x, y, z: 0 }, 360, easeOutBack);
    return view;
  }

  private async rollDie(view: DiceView, faceIndex: number, duration: number): Promise<void> {
    const started = performance.now();
    while (performance.now() - started < duration) {
      const elapsed = performance.now() - started;
      const t = elapsed / duration;
      view.mesh.rotation.x += 0.2 + t * 0.08;
      view.mesh.rotation.y += 0.16 + t * 0.06;
      view.group.position.y = 0.1 + Math.sin(t * Math.PI) * 0.58;
      await nextFrame();
    }

    view.group.position.y = 0.1;
    await this.tweenRotation(view.mesh.rotation, faceRotation(faceIndex), 180, easeOutBack);
    await this.punch(view, 1.22, 180);
  }

  private async cardHit(view: DiceView, event: Extract<RollEvent, { type: 'cardModifier' }>): Promise<void> {
    const color = colorNumber(categoryColors[event.category]);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.18, 2.2, 18, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending }),
    );
    beam.position.set(view.group.position.x, 1.85, 0.15);
    beam.rotation.x = Math.PI / 2;
    const label = textSprite(event.label, categoryColors[event.category], 84);
    label.position.set(view.group.position.x, 1.9, 0.65);
    label.scale.setScalar(0.72);
    this.threeScene?.add(beam, label);

    await Promise.all([
      this.tweenVector(beam.position, { x: view.group.position.x, y: 0.62, z: 0.15 }, 210, easeInCubic),
      this.tweenVector(label.position, { x: view.group.position.x, y: 0.88, z: 0.65 }, 210, easeInCubic),
    ]);
    this.scene.cameras.main.shake(150, 0.007);
    this.emitParticles(view.group.position.x, view.group.position.y, color, 28);
    await this.punch(view, 1.34, 220);
    await this.showChange(view, `${event.before}`, event.label, `${event.after}`);
    this.threeScene?.remove(beam, label);
    beam.geometry.dispose();
    (beam.material as THREE.Material).dispose();
    label.material.map?.dispose();
    label.material.dispose();
  }

  private async showChange(view: DiceView, before: string, label: string, after: string): Promise<void> {
    const sprite = textSprite(`${before}  ${label}  ${after}`, '#edf5ff', 38);
    sprite.position.set(view.group.position.x, -1.25, 0.8);
    sprite.scale.set(1.25, 0.32, 1);
    this.threeScene?.add(sprite);
    await this.tweenVector(sprite.position, { x: view.group.position.x, y: -1.02, z: 0.8 }, 160, easeOutCubic);
    await this.delay(220);
    await this.tweenMaterialOpacity(sprite.material, 0, 180);
    this.threeScene?.remove(sprite);
    sprite.material.map?.dispose();
    sprite.material.dispose();
  }

  private async showText(text: string, color: string, x: number, y: number, scale: number): Promise<void> {
    const sprite = textSprite(text, color, 52);
    sprite.position.set(x, y + 0.18, 0.7);
    sprite.scale.set(scale * 4.8, scale, 1);
    sprite.material.opacity = 0;
    this.threeScene?.add(sprite);
    await Promise.all([
      this.tweenMaterialOpacity(sprite.material, 1, 130),
      this.tweenVector(sprite.position, { x, y, z: 0.7 }, 160, easeOutBack),
    ]);
    await this.delay(160);
    await this.tweenMaterialOpacity(sprite.material, 0, 140);
    this.threeScene?.remove(sprite);
    sprite.material.map?.dispose();
    sprite.material.dispose();
  }

  private async finalResult(result: LaunchResult): Promise<void> {
    const exploded = result.roll.exploded;
    const color = exploded ? '#ff5a5f' : '#ffe4a6';
    const label = exploded ? 'EXPLODED' : `${result.heightMeters}m`;
    const sprite = textSprite(label, color, exploded ? 86 : 110);
    sprite.position.set(0, -2.05, 1.1);
    sprite.scale.set(0.01, 0.01, 1);
    this.threeScene?.add(sprite);
    this.scene.cameras.main.flash(200, 255, exploded ? 80 : 245, exploded ? 88 : 210);
    this.scene.cameras.main.shake(280, exploded ? 0.012 : 0.007);
    this.emitParticles(0, -2.05, colorNumber(color), 70);
    await this.tweenVector(sprite.scale, { x: 4.4, y: 0.92, z: 1 }, 460, easeOutBack);
    await this.delay(760);
  }

  private async punch(view: DiceView, scale: number, duration: number): Promise<void> {
    await this.tweenVector(view.group.scale, { x: scale, y: scale, z: scale }, duration * 0.42, easeOutCubic);
    await this.tweenVector(view.group.scale, { x: 1, y: 1, z: 1 }, duration * 0.58, easeOutBack);
  }

  private emitParticles(x: number, y: number, color: number, count: number): void {
    for (let index = 0; index < count; index += 1) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(THREE.MathUtils.randFloat(0.025, 0.07), 8, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending }),
      );
      particle.position.set(x, y, THREE.MathUtils.randFloat(0.2, 0.9));
      this.threeScene?.add(particle);
      const target = new THREE.Vector3(
        x + THREE.MathUtils.randFloatSpread(2.2),
        y + THREE.MathUtils.randFloatSpread(1.6),
        THREE.MathUtils.randFloat(0.1, 1.2),
      );
      void Promise.all([
        this.tweenVector(particle.position, target, THREE.MathUtils.randInt(360, 760), easeOutCubic),
        this.tweenMaterialOpacity(particle.material as THREE.MeshBasicMaterial, 0, THREE.MathUtils.randInt(360, 760)),
      ]).then(() => {
        this.threeScene?.remove(particle);
        particle.geometry.dispose();
        (particle.material as THREE.Material).dispose();
      });
    }
  }

  private addStarfield(): void {
    const geometry = new THREE.BufferGeometry();
    const positions = Array.from({ length: 180 }, () => [
      THREE.MathUtils.randFloatSpread(12),
      THREE.MathUtils.randFloatSpread(6.5),
      THREE.MathUtils.randFloat(-2.8, -1.1),
    ]).flat();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.018, transparent: true, opacity: 0.55 });
    this.threeScene?.add(new THREE.Points(geometry, material));
  }

  private async fadeOut(): Promise<void> {
    if (!this.renderer) {
      return;
    }
    await this.tweenElementOpacity(this.renderer.domElement, 0, 260);
  }

  private renderLoop(): void {
    if (!this.renderer || !this.threeScene || !this.camera) {
      return;
    }
    this.renderer.render(this.threeScene, this.camera);
    this.animationFrame = requestAnimationFrame(() => this.renderLoop());
  }

  private tweenVector(target: THREE.Vector3, to: { x: number; y: number; z: number }, duration: number, ease: (t: number) => number): Promise<void> {
    const from = target.clone();
    return tween(duration, (t) => {
      const eased = ease(t);
      target.set(
        THREE.MathUtils.lerp(from.x, to.x, eased),
        THREE.MathUtils.lerp(from.y, to.y, eased),
        THREE.MathUtils.lerp(from.z, to.z, eased),
      );
    });
  }

  private tweenRotation(target: THREE.Euler, to: { x: number; y: number; z: number }, duration: number, ease: (t: number) => number): Promise<void> {
    const from = { x: target.x, y: target.y, z: target.z };
    return tween(duration, (t) => {
      const eased = ease(t);
      target.set(
        THREE.MathUtils.lerp(from.x, to.x, eased),
        THREE.MathUtils.lerp(from.y, to.y, eased),
        THREE.MathUtils.lerp(from.z, to.z, eased),
      );
    });
  }

  private tweenScalar(target: THREE.Vector3, key: 'x' | 'y' | 'z', to: number, duration: number, ease: (t: number) => number): Promise<void> {
    const from = target[key];
    return tween(duration, (t) => {
      target[key] = THREE.MathUtils.lerp(from, to, ease(t));
    });
  }

  private tweenMaterialOpacity(material: THREE.Material, to: number, duration: number): Promise<void> {
    material.transparent = true;
    const from = material.opacity;
    return tween(duration, (t) => {
      material.opacity = THREE.MathUtils.lerp(from, to, easeOutCubic(t));
    });
  }

  private tweenElementOpacity(element: HTMLElement, to: number, duration: number): Promise<void> {
    const from = Number(element.style.opacity || 1);
    return tween(duration, (t) => {
      element.style.opacity = `${THREE.MathUtils.lerp(from, to, easeOutCubic(t))}`;
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
}

function diceMaterials(category: DiceCategory, faces: number[]): THREE.MeshStandardMaterial[] {
  return faces.map((value) => new THREE.MeshStandardMaterial({
    map: diceFaceTexture(categoryColors[category], `${value}`),
    color: 0xffffff,
    roughness: 0.34,
    metalness: 0.18,
    emissive: colorNumber(categoryColors[category]),
    emissiveIntensity: 0.08,
  }));
}

function diceFaceTexture(color: string, value: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }
  const gradient = context.createRadialGradient(78, 62, 18, 128, 128, 190);
  gradient.addColorStop(0, lighten(color, 0.32));
  gradient.addColorStop(0.54, color);
  gradient.addColorStop(1, darken(color, 0.42));
  context.fillStyle = gradient;
  roundedRect(context, 12, 12, 232, 232, 34);
  context.fill();
  context.strokeStyle = 'rgba(255,255,255,0.42)';
  context.lineWidth = 8;
  context.stroke();
  context.fillStyle = 'rgba(5,9,20,0.22)';
  context.fillRect(34, 178, 188, 12);
  context.font = 'bold 116px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 14;
  context.strokeStyle = 'rgba(5,9,20,0.72)';
  context.strokeText(value, 128, 130);
  context.fillStyle = '#ffffff';
  context.fillText(value, 128, 130);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function textSprite(text: string, color: string, fontSize: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (context) {
    context.font = `900 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineWidth = 16;
    context.strokeStyle = 'rgba(5,9,20,0.9)';
    context.strokeText(text, 512, 128);
    context.fillStyle = color;
    context.fillText(text, 512, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  return new THREE.Sprite(material);
}

function tween(duration: number, update: (t: number) => void): Promise<void> {
  const start = performance.now();
  return new Promise((resolve) => {
    const frame = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      update(t);
      if (t >= 1) {
        resolve();
      } else {
        requestAnimationFrame(frame);
      }
    };
    frame();
  });
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function faceRotation(faceIndex: number): { x: number; y: number; z: number } {
  const rotations = [
    { x: -0.35, y: -Math.PI / 2 + 0.16, z: -0.08 },
    { x: -0.35, y: Math.PI / 2 - 0.16, z: 0.08 },
    { x: Math.PI / 2 - 0.2, y: 0.24, z: -0.1 },
    { x: -Math.PI / 2 + 0.2, y: -0.24, z: 0.1 },
    { x: -0.48, y: 0.68, z: -0.08 },
    { x: -0.44, y: Math.PI + 0.44, z: 0.08 },
  ];
  return rotations[faceIndex] ?? rotations[4];
}

function colorNumber(color: string): number {
  return Number.parseInt(color.replace('#', ''), 16);
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function lighten(color: string, amount: number): string {
  return mix(color, '#ffffff', amount);
}

function darken(color: string, amount: number): string {
  return mix(color, '#000000', amount);
}

function mix(a: string, b: string, amount: number): string {
  const ca = colorNumber(a);
  const cb = colorNumber(b);
  const ar = (ca >> 16) & 255;
  const ag = (ca >> 8) & 255;
  const ab = ca & 255;
  const br = (cb >> 16) & 255;
  const bg = (cb >> 8) & 255;
  const bb = cb & 255;
  const r = Math.round(THREE.MathUtils.lerp(ar, br, amount));
  const g = Math.round(THREE.MathUtils.lerp(ag, bg, amount));
  const bl = Math.round(THREE.MathUtils.lerp(ab, bb, amount));
  return `rgb(${r}, ${g}, ${bl})`;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t: number): number {
  return t * t * t;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
