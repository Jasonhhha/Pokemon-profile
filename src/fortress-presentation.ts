import { companionPosition, type FieldView } from './field-renderer';
import { TILE } from './field-layout';
import type { FortressInteriorFrame, FortressRoom } from './field-fortress-state';
import { drawFortressInterior2D, fortressInteriorPoint2D, fortressInteriorProject2D } from './fortress-interior-2d';
import type { createFortressInterior3D } from './fortress-interior-3d';

export function createFortressPresentation(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const surface = document.createElement('canvas');
  let chamber: ReturnType<typeof createFortressInterior3D> | undefined;
  let requested = false;
  let destroyed = false;
  let frame: FortressInteriorFrame | undefined;
  let previousSize: [number, number] | undefined;
  let lastDraw = -Infinity;

  function release(event?: Event) {
    event?.preventDefault();
    surface.removeEventListener('webglcontextlost', release);
    chamber?.dispose();
    chamber = undefined;
  }

  function draw(now: number, view: FieldView, room: FortressRoom, reduced: boolean, width: number, height: number, webgl: boolean) {
    if (webgl && !requested) {
      requested = true;
      void import('./fortress-interior-3d').then(({ createFortressInterior3D }) => {
        if (destroyed) return;
        chamber = createFortressInterior3D(surface);
        surface.addEventListener('webglcontextlost', release);
      }).catch(error => {
        if (import.meta.env.DEV) console.warn('Fortress WebGL initialization switched to Canvas2D', error);
        release();
      });
    }
    previousSize ??= [canvas.width, canvas.height];
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5, 1600 / width, 1040 / height);
    const w = Math.max(1, Math.round(width * ratio)), h = Math.max(1, Math.round(height * ratio));
    const resized = canvas.width !== w || canvas.height !== h;
    if (resized) { canvas.width = w; canvas.height = h; }
    if (!resized && frame?.room === room && frame.inspecting === view.inspectingSeal && now - lastDraw < 1000 / 32) return;
    lastDraw = now;
    const step = view.step;
    const fraction = step ? Math.max(0, Math.min(1, (now - step.startedAt) / step.duration)) : 0;
    const follower = companionPosition(view, fraction);
    const alternatingFoot = step ? (step.from.x + step.from.y) % 2 : 0;
    frame = {
      room, now, reduced, facing: view.facing, inspecting: view.inspectingSeal, resonance: view.resonance,
      x: .5 + (step ? step.from.x + (step.to.x - step.from.x) * fraction : view.location.x),
      y: .5 + (step ? step.from.y + (step.to.y - step.from.y) * fraction : view.location.y),
      stride: step ? Math.sin(Math.PI * fraction) * (alternatingFoot ? -1 : 1) : 0,
      gaitPhase: step ? (alternatingFoot + fraction) / 2 : undefined,
      companionId: view.companionId, companionImage: view.companionImage, companionX: follower.x + .5, companionY: follower.y + .5,
    };
    if (chamber) {
      try {
        if (surface.width !== w || surface.height !== h) { surface.width = w; surface.height = h; }
        chamber.draw(frame);
        ctx.drawImage(surface, 0, 0, w, h);
        canvas.dataset.renderer = 'webgl';
        return;
      } catch (error) {
        if (import.meta.env.DEV) console.warn('Fortress WebGL render switched to Canvas2D', error);
        release();
      }
    }
    canvas.dataset.renderer = 'canvas2d';
    drawFortressInterior2D(ctx, frame);
  }

  return {
    draw,
    get active() { return Boolean(frame); },
    leave() {
      if (previousSize) [canvas.width, canvas.height] = previousSize;
      previousSize = undefined;
      frame = undefined;
    },
    getCamera() {
      return { x: (frame?.x ?? 0) * TILE, y: (frame?.y ?? 0) * TILE, width: canvas.width, height: canvas.height, scale: canvas.height / (13 * TILE), depth: 0 };
    },
    projectPoint(x: number, y: number) {
      const point = chamber ? chamber.projectPoint(x / TILE, y / TILE) : fortressInteriorProject2D(ctx, frame!, x / TILE, y / TILE);
      return { ...point, scale: canvas.height / (13 * TILE) };
    },
    pointInWorld(x: number, y: number) {
      const point = chamber ? chamber.pointInWorld(x, y) : fortressInteriorPoint2D(ctx, frame!, x, y);
      return point && { x: point.x * TILE, y: point.y * TILE };
    },
    dispose() { destroyed = true; release(); },
  };
}
