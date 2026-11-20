import { createFieldRenderer, feetX, feetY, type FieldView } from './field-renderer';
import type { createFieldView3d } from './field-view3d';
import { createRingRasterView } from './field-ring-raster-view';

export function createFieldPresentation(canvas: HTMLCanvasElement, reducedMotion: MediaQueryList, onReady?: () => void) {
  const classic = createFieldRenderer(canvas, reducedMotion);
  let ring: ReturnType<typeof createRingRasterView> | undefined;
  let raster: typeof classic | NonNullable<typeof ring> = classic;
  let world: ReturnType<typeof createFieldView3d>;
  let pendingWorld: typeof world;
  let loadingWorld = true;
  let ready = false;
  const requestedAt = performance.now();
  let size = { width: 0, height: 0 };
  let destroyed = false;
  canvas.dataset.renderer = 'canvas2d';

  function markReady() {
    if (ready) return;
    ready = true;
    onReady?.();
  }

  function restoreClassic(event?: Event) {
    event?.preventDefault();
    const failed = world ?? pendingWorld;
    if (!failed) return;
    failed.surface.removeEventListener('webglcontextlost', restoreClassic);
    failed.destroy();
    world = pendingWorld = undefined;
    canvas.dataset.renderer = 'canvas2d';
    raster.resize(size.width, size.height);
    raster.resetCamera();
  }

  void import('./field-view3d').then(module => {
    if (destroyed) return;
    pendingWorld = module.createFieldView3d(canvas, reducedMotion);
    pendingWorld?.surface.addEventListener('webglcontextlost', restoreClassic);
  }).catch(error => {
    if (import.meta.env.DEV) console.warn('WebGL field initialization could not finish', error);
  }).finally(() => { loadingWorld = false; });

  return {
    draw(time: number, view: FieldView) {
      if (size.width <= 0 || size.height <= 0) return;
      const active = world ?? pendingWorld;
      if (active) {
        try {
          if (pendingWorld) active.resize(size.width, size.height);
          active.draw(time, view);
          if (pendingWorld) {
            world = active;
            pendingWorld = undefined;
            canvas.dataset.renderer = 'webgl';
          }
          markReady();
          return;
        } catch (error) {
          if (import.meta.env.DEV) console.warn('WebGL field render switched to Canvas2D', error);
          restoreClassic();
        }
      }
      if (!ready && loadingWorld && time - requestedAt < 1550) return;
      const fallback = view.location.area === 'harbor' && !view.location.room
        ? ring ??= createRingRasterView(canvas, reducedMotion) : classic;
      if (fallback !== raster) {
        raster = fallback;
        raster.resize(size.width, size.height);
        raster.resetCamera();
      }
      raster.draw(time, view);
      markReady();
    },
    resize(width: number, height: number) {
      size = { width, height };
      (world ?? raster).resize(width, height);
    },
    projectPoint: (x: number, y: number) => (world ?? raster).projectPoint(x, y),
    pointInWorld: (x: number, y: number) => (world ?? raster).pointInWorld(x, y),
    hitActor(x: number, y: number, candidates: FieldView['map']['npcs'], doorway: (actor: FieldView['map']['npcs'][number]) => boolean) {
      if (world) return world.hitActor(x, y, candidates, doorway);
      return candidates.find(actor => {
        const entrance = doorway(actor);
        const projected = raster.projectPoint(feetX(actor.x), feetY(actor.y));
        return Math.abs(projected.x - x) <= (entrance ? 11 : 8) * projected.scale &&
          y >= projected.y - (entrance ? 48 : 27) * projected.scale && y <= projected.y + 3 * projected.scale;
      });
    },
    resetCamera: () => (world ?? raster).resetCamera(),
    getCamera: () => (world ?? raster).getCamera(),
    destroy() {
      destroyed = true;
      const active = world ?? pendingWorld;
      active?.surface.removeEventListener('webglcontextlost', restoreClassic);
      active?.destroy();
    },
  };
}
