import Phaser from 'phaser';
import EasyStar from 'easystarjs';
import { drawTrainer, makeWorld, TILE, WORLD_HEIGHT, WORLD_WIDTH } from './art';
import { isPokemon, pokemonData, pokemonIds, regions, type Destination, type PokemonId, type RegionId, type Spot } from './world';
export type { Destination } from './world';

export interface GameControls {
  travel: (place: Destination) => void;
  move: (direction: 'up' | 'down' | 'left' | 'right') => void;
  interact: () => void;
  setNight: (night: boolean) => void;
  setPaused: (paused: boolean) => void;
  setPartner: (partner: PokemonId) => void;
  changeRegion: (region: RegionId) => void;
  zoom: () => void;
}
interface GameOptions {
  parent: HTMLDivElement;
  onReady: (controls: GameControls) => void;
  onInteract: (destination: Destination) => void;
  onWalk: () => void;
  onRegion: (region: RegionId) => void;
}
const labelNames = { about: '训练家小屋', projects: '作品研究所', contact: '湖畔邮箱' };
export function createGame(options: GameOptions) {
  const density = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  class TownScene extends Phaser.Scene {
    private player!: Phaser.GameObjects.Sprite;
    private companion!: Phaser.GameObjects.Image;
    private shadow!: Phaser.GameObjects.Ellipse;
    private you!: Phaser.GameObjects.Text;
    private pathfinder = new EasyStar.js();
    private grid: number[][] = [];
    private tile = { x: 14, y: 11 };
    private moving = false;
    private paused = false;
    private night = false;
    private zoomed = false;
    private region: RegionId = 'twinleaf';
    private partner: PokemonId = 'gible';
    private path: { x: number; y: number }[] = [];
    private onArrival?: () => void;
    private keys!: Record<string, Phaser.Input.Keyboard.Key>;
    private overlay!: Phaser.GameObjects.Rectangle;
    private marker!: Phaser.GameObjects.Rectangle;
    private waypoints!: Phaser.GameObjects.Graphics;
    private glows: Phaser.GameObjects.Rectangle[] = [];
    private actors: Phaser.GameObjects.Image[] = [];
    private snowflakes: Phaser.GameObjects.Rectangle[] = [];
    private ripples: Phaser.GameObjects.Rectangle[] = [];
    private grassBlades: Phaser.GameObjects.Rectangle[] = [];
    private walkTween?: Phaser.Tweens.Tween;
    private direction = 'down';
    private step = 0;

    constructor() { super('Town'); }
    preload() {
      for (const id of pokemonIds) this.load.image(id, pokemonData[id].asset);
    }
    create() {
      // Keep the loaded PNG texture intact. Runtime canvas copies can fail on some
      // WebGL/mobile combinations and render as opaque black rectangles.
      for (const id of pokemonIds) this.textures.get(id).setFilter(Phaser.Textures.FilterMode.NEAREST);
      for (const direction of ['down', 'up']) for (let step = 0; step < 3; step++) {
        const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 44;
        drawTrainer(canvas.getContext('2d')!, 4, 2, 2, direction, step === 1 ? 1 : step === 2 ? -1 : 0);
        this.textures.addCanvas('trainer-' + direction + '-' + step, canvas)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
      this.pathfinder.setAcceptableTiles([0]); this.pathfinder.enableSync();
      this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE', false) as Record<string, Phaser.Input.Keyboard.Key>;
      this.input.keyboard!.on('keydown-E', () => { if (this.hasMapFocus()) this.interact(); });
      this.input.keyboard!.on('keydown-SPACE', (event: KeyboardEvent) => { if (this.hasMapFocus()) { event.preventDefault(); this.interact(); } });
      this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
        if (!this.hasMapFocus()) return;
        const directions: Record<string, 'up' | 'down' | 'left' | 'right'> = {
          ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
        };
        const direction = directions[event.key] ?? directions[event.key.toLowerCase()];
        if (direction) { event.preventDefault(); this.move(direction); }
      });
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        options.parent.focus({ preventScroll: true });
        if (this.paused || over.length) return;
        this.walkTo(Math.floor(pointer.worldX / TILE), Math.floor(pointer.worldY / TILE));
      });
      this.scale.on('resize', () => this.fitCamera());
      this.buildRegion('twinleaf');
      const api: GameControls = {
        travel: id => this.travel(id), move: direction => this.move(direction), interact: () => this.interact(),
        setNight: value => { this.night = value; this.applyNight(); },
        setPartner: value => { this.partner = value; this.companion.setTexture(value); },
        setPaused: value => {
          this.paused = value; this.input.keyboard!.enabled = !value; this.input.keyboard!.resetKeys();
          if (value) this.walkTween?.pause(); else this.walkTween?.resume();
        },
        changeRegion: id => {
          if (this.paused) return;
          if (id !== this.region) this.buildRegion(id);
          options.parent.focus({ preventScroll: true });
        },
        zoom: () => { this.zoomed = !this.zoomed; this.fitCamera(); },
      };
      options.onReady(api);
      if (import.meta.env.DEV) {
        (window as Window & { __town?: unknown }).__town = {
          getState: () => ({ ...this.tile, moving: this.moving, paused: this.paused, night: this.night, zoomed: this.zoomed, region: this.region, partner: this.partner }),
          travel: api.travel,
          getGrid: () => this.grid,
          getSpots: () => regions[this.region].spots,
        };
      }
    }
    private hasMapFocus() { return options.parent.contains(document.activeElement); }
    private buildRegion(id: RegionId, entry?: 'west' | 'east') {
      this.tweens.killAll(); this.walkTween = undefined; this.path = []; this.onArrival = undefined; this.moving = false;
      this.children.removeAll(true); this.actors = []; this.glows = []; this.snowflakes = []; this.ripples = []; this.grassBlades = [];
      this.region = id; this.tile = entry === 'west' ? { x: 1, y: id === 'verity' ? 14 : 11 } : entry === 'east' ? { x: 26, y: id === 'verity' ? 14 : 11 } : { x: 14, y: id === 'verity' ? 14 : 11 };
      const world = makeWorld(id); this.grid = world.grid; this.pathfinder.setGrid(this.grid);
      const textureKey = 'map-' + id;
      if (!this.textures.exists(textureKey)) this.textures.addCanvas(textureKey, world.canvas)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.add.image(0, 0, textureKey).setOrigin(0);
      // Small foreground blades sit above the painted map so wind motion remains visible.
      const grassSeed = id === 'twinleaf' ? 7 : id === 'verity' ? 13 : 23;
      for (let i = 0; i < 20; i++) {
        const gx = 72 + ((i * 137 + grassSeed * 19) % 748);
        const gy = 180 + ((i * 71 + grassSeed * 11) % 330);
        if (this.grid[Math.floor(gy / TILE)]?.[Math.floor(gx / TILE)] !== 0) continue;
        const blade = this.add.rectangle(gx, gy, 3, 15, id === 'coronet' ? 0xb7d7cf : 0x4f8b5f, .85).setOrigin(.5, 1).setDepth(4);
        blade.setData('baseX', gx); blade.setData('baseY', gy); this.grassBlades.push(blade);
      }
      for (const area of world.water) for (let i = 0; i < 8; i++) {
        const x = area.x + (i * 53 % area.w), y = area.y + (i * 29 % area.h);
        if (this.grid[Math.floor(y / TILE)]?.[Math.floor(x / TILE)] === 1 && !(id === 'verity' && x > 400 && x < 540 && y > 185 && y < 307)) {
          this.ripples.push(this.add.rectangle(x, y, 10, 2, 0xd0ece0).setAlpha(.5).setDepth(2));
        }
      }
      for (const spot of regions[id].spots) {
        if (isPokemon(spot.id)) this.addPokemon(spot);
      }
      if (id === 'twinleaf') {
        this.sign('about', 268, 120);
        for (const [spot, x, y, w, h] of [['about', 268, 215, 188, 144]] as const) {
          this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true }).setDepth(4).on('pointerdown', (_p: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); this.travel(spot); });
        }
      } else if (id === 'verity') {
        this.sign('projects', 704, 406);
        this.add.zone(704, 416, 150, 74).setInteractive({ useHandCursor: true }).setDepth(4).on('pointerdown', (_p: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); this.travel('projects'); });
      } else {
        this.sign('contact', 672, 342);
        this.add.zone(610, 360, 170, 110).setInteractive({ useHandCursor: true }).setDepth(4).on('pointerdown', (_p: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); this.travel('contact'); });
      }
      this.waypoints = this.add.graphics().setDepth(5);
      this.marker = this.add.rectangle(0, 0, 22, 14).setStrokeStyle(2, 0xffffff, .8).setVisible(false).setDepth(6);
      const px = this.tile.x * TILE + 16, py = this.tile.y * TILE + 16;
      this.shadow = this.add.ellipse(px, py + 6, 26, 8, 0x294c48, .32).setDepth(8);
      this.companion = this.add.image(px + 32, py + 8, this.partner).setOrigin(.5, .94).setDisplaySize(64, 64).setDepth(9);
      this.player = this.add.sprite(px, py, 'trainer-down-0').setOrigin(.5, .9).setDepth(10);
      this.you = this.add.text(px, py - 54, 'YOU', { fontFamily: 'Silkscreen', fontSize: '10px', color: '#fffef0', backgroundColor: '#365a57', padding: { x: 5, y: 3 } }).setResolution(2).setOrigin(.5).setDepth(14);
      this.overlay = this.add.rectangle(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 0x132d50, 1).setOrigin(0).setDepth(30).setAlpha(0);
      for (const lamp of world.lamps) {
        this.glows.push(this.add.rectangle(lamp.x, lamp.y, 36, 32, 0xffd980, .15).setDepth(31));
        this.glows.push(this.add.rectangle(lamp.x, lamp.y, 8, 12, 0xffe7a6).setDepth(32));
      }
      if (id === 'coronet') for (let i = 0; i < 32; i++) {
        this.snowflakes.push(this.add.rectangle(i * 73 % WORLD_WIDTH, i * 47 % WORLD_HEIGHT, 2, 2, 0xffffff, .8).setDepth(33));
      }
      const gateY = id === 'verity' ? 14 : 11;
      this.grid[gateY][0] = 0; this.grid[gateY][1] = 0; this.grid[gateY][26] = 0; this.grid[gateY][27] = 0;
      this.fitCamera(); this.applyNight(); options.onRegion(id);
      if (!reducedMotion) this.cameras.main.fadeIn(260, 239, 242, 224);
    }
    private addPokemon(spot: Spot) {
      const x = spot.x * TILE + 16, y = spot.y * TILE + 16;
      this.add.ellipse(x, y + 5, 28, 8, 0x345c57, .25).setDepth(7);
      const pet = this.add.image(x, y + 4, spot.id).setOrigin(.5, .94).setDisplaySize(64, 64).setDepth(9).setInteractive({ useHandCursor: true });
      pet.setData('restY', y + 4); this.actors.push(pet);
      pet.on('pointerover', () => pet.setTint(0xfff3bb));
      pet.on('pointerout', () => pet.clearTint());
      pet.on('pointerdown', (_p: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); this.travel(spot.id); });
    }
    private sign(id: 'about' | 'projects' | 'contact', x: number, y: number) {
      const label = this.add.text(x, y, labelNames[id] + ' ↗', { fontFamily: '-apple-system, "PingFang SC", sans-serif', fontSize: '14px', color: '#34554f', backgroundColor: '#fffbea', padding: { x: 12, y: 7 } }).setResolution(3).setOrigin(.5).setDepth(16).setInteractive({ useHandCursor: true });
      label.on('pointerover', () => label.setColor('#b64e54')); label.on('pointerout', () => label.setColor('#34554f'));
      label.on('pointerdown', (_p: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); this.travel(id); });
    }
    private applyNight() {
      this.overlay.setAlpha(this.night ? .3 : 0);
      this.glows.forEach(glow => glow.setVisible(this.night));
    }
    private fitCamera() {
      if (!this.player) return;
      const width = this.scale.width, height = this.scale.height;
      const mobile = options.parent.clientWidth < 600;
      const ratio = this.zoomed
        ? Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT)
        : mobile ? Math.max(height / WORLD_HEIGHT, density * .9) : Math.max(width / WORLD_WIDTH, height / WORLD_HEIGHT);
      this.cameras.main.setZoom(ratio).setRoundPixels(true).setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      this.cameras.main.centerOn(this.zoomed ? WORLD_WIDTH / 2 : mobile ? this.player.x : WORLD_WIDTH / 2, this.zoomed ? WORLD_HEIGHT / 2 : mobile ? this.player.y : WORLD_HEIGHT / 2);
    }
    private travel(id: Destination) {
      if (this.paused) return;
      options.parent.focus({ preventScroll: true });
      const targetRegion = regions[this.region].spots.some(spot => spot.id === id) ? this.region : (Object.keys(regions) as RegionId[]).find(region => regions[region].spots.some(spot => spot.id === id)) ?? this.region;
      if (targetRegion !== this.region) this.buildRegion(targetRegion, targetRegion === 'twinleaf' ? 'east' : targetRegion === 'verity' ? (this.region === 'twinleaf' ? 'west' : 'east') : 'west');
      const point = regions[targetRegion].spots.find(spot => spot.id === id);
      if (point) this.walkTo(point.x, point.y, () => options.onInteract(id));
    }
    private walkTo(x: number, y: number, callback?: () => void) {
      if (this.paused || x < 0 || y < 0 || x >= 28 || y >= 19 || this.grid[y][x] !== 0) return;
      // A new destination replaces the remaining route, including while a tile-step finishes.
      this.pathfinder.findPath(this.tile.x, this.tile.y, x, y, path => {
        if (!path) return;
        this.path = path.slice(1); this.onArrival = callback;
        this.marker.setPosition(x * TILE + 16, y * TILE + 16).setVisible(this.path.length > 0);
        this.waypoints.clear().fillStyle(0xfff8da, .65);
        this.path.forEach(p => this.waypoints.fillRect(p.x * TILE + 14, p.y * TILE + 14, 4, 4));
        if (!this.path.length && callback && !this.moving) { this.onArrival = undefined; callback(); }
      });
      this.pathfinder.calculate();
    }
    private move(direction: 'up' | 'down' | 'left' | 'right') {
      if (this.moving || this.paused) return;
      const changes = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      const [dx, dy] = changes[direction]; this.walkTo(this.tile.x + dx, this.tile.y + dy);
    }
    private interact() {
      if (this.paused || this.moving) return;
      const near = regions[this.region].spots
        .map(spot => ({ ...spot, distance: Math.abs(spot.x - this.tile.x) + Math.abs(spot.y - this.tile.y) }))
        .filter(spot => spot.distance <= 1).sort((a, b) => a.distance - b.distance)[0];
      if (near) options.onInteract(near.id); else options.onWalk();
    }
    update(time: number) {
      if (!reducedMotion) {
        this.actors.forEach((actor, i) => actor.setY(actor.getData('restY') - (Math.floor(time / (500 + i * 70)) % 2) * 2));
        this.ripples.forEach((ripple, i) => { const wave = (Math.sin(time / 520 + i * .8) + 1) / 2; ripple.setAlpha(.22 + wave * .55).setScale(0.7 + wave * .8, 1); ripple.x += Math.sin(time / 900 + i) * .015; });
        this.grassBlades.forEach((blade, i) => { const sway = Math.sin(time / 520 + i * .7) * .16; blade.setRotation(sway).setScale(1 + Math.abs(sway) * .8, 1); });
        this.snowflakes.forEach((flake, i) => flake.setPosition(Math.floor((i * 73 + time / 110) % WORLD_WIDTH), Math.floor((i * 47 + time / 45) % WORLD_HEIGHT)));
      }
      if (this.paused || this.moving || !this.keys) return;
      if (this.hasMapFocus()) {
        if (this.keys.UP.isDown || this.keys.W.isDown) this.move('up');
        else if (this.keys.DOWN.isDown || this.keys.S.isDown) this.move('down');
        else if (this.keys.LEFT.isDown || this.keys.A.isDown) this.move('left');
        else if (this.keys.RIGHT.isDown || this.keys.D.isDown) this.move('right');
      }
      const next = this.path.shift(); if (!next) return;
      this.moving = true; this.direction = next.y < this.tile.y ? 'up' : 'down'; this.step = (this.step + 1) % 2;
      this.player.setTexture('trainer-' + this.direction + '-' + (this.step + 1)); this.player.setFlipX(next.x < this.tile.x);
      const previousX = this.tile.x * TILE + 16, previousY = this.tile.y * TILE + 16; this.tile = next;
      this.tweens.add({ targets: this.companion, x: previousX, y: previousY + 8, duration: 155 });
      this.walkTween = this.tweens.add({
        targets: this.player, x: next.x * TILE + 16, y: next.y * TILE + 16, duration: 145,
        onUpdate: () => {
          this.shadow.setPosition(Math.round(this.player.x), Math.round(this.player.y + 6));
          this.you.setPosition(Math.round(this.player.x), Math.round(this.player.y - 54));
          if (!this.zoomed && options.parent.clientWidth < 600) this.cameras.main.centerOn(this.player.x, this.player.y);
        },
        onComplete: () => {
          this.moving = false; this.player.setTexture('trainer-' + this.direction + '-0');
          const gateY = this.region === 'verity' ? 14 : 11;
          if (this.tile.y === gateY && this.tile.x === 27 && this.region === 'twinleaf') { this.buildRegion('verity', 'west'); return; }
          if (this.tile.y === gateY && this.tile.x === 0 && this.region === 'verity') { this.buildRegion('twinleaf', 'east'); return; }
          if (this.tile.y === gateY && this.tile.x === 27 && this.region === 'verity') { this.buildRegion('coronet', 'west'); return; }
          if (this.tile.y === gateY && this.tile.x === 0 && this.region === 'coronet') { this.buildRegion('verity', 'east'); return; }
          if (!this.path.length) { this.marker.setVisible(false); this.waypoints.clear(); const fn = this.onArrival; this.onArrival = undefined; fn?.(); }
        },
      });
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent: options.parent, backgroundColor: '#83bb79', pixelArt: true, roundPixels: true,
    scale: { mode: Phaser.Scale.NONE, width: Math.round(options.parent.clientWidth * density), height: Math.round(options.parent.clientHeight * density), zoom: 1 / density },
    scene: TownScene, audio: { noAudio: true }, input: { keyboard: { capture: [] } },
    render: { antialias: false, antialiasGL: false, transparent: false },
  });
  const resize = new ResizeObserver(() => {
    if (game.isBooted) game.scale.resize(Math.round(options.parent.clientWidth * density), Math.round(options.parent.clientHeight * density));
  });
  resize.observe(options.parent);
  game.events.once('destroy', () => {
    resize.disconnect();
    if (import.meta.env.DEV) delete (window as Window & { __town?: unknown }).__town;
  });
  return game;
}
