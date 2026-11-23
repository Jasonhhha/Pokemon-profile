import { createFieldRenderer, feetX, feetY, type FieldView } from './field-renderer';
import { TILE } from './field-layout';
import type { createFieldView3d } from './field-view3d';
import { createRingRasterView } from './field-ring-raster-view';
import { ringStreetRow } from './field-ring-coordinates';

export const streetAxisMinSpan = .0072;

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
  const usableAxes: { x?: boolean; y?: boolean } = {};
  canvas.dataset.renderer = 'canvas2d';

  function streetAxisProjection(column: number, row: number, axis: 'x' | 'y', cityView = world ?? (raster === ring ? ring : undefined)) {
    if (!cityView?.hasStreetFrame()) return;
    const x = feetX(column), y = ringStreetRow(row) * TILE;
    const dx = axis === 'x' ? TILE * .22 : 0;
    const dy = axis === 'y' ? TILE * .22 : 0;
    const span = cityView.projectPoint(x + dx, y + dy)[axis] - cityView.projectPoint(x - dx, y - dy)[axis];
    if (Number.isFinite(span)) return span / cityView.getCamera().height;
  }

  function rememberAxes(view: FieldView, cityView: NonNullable<typeof world> | typeof ring) {
    if (view.overview || view.location.area !== 'harbor' || view.location.room) {
      usableAxes.x = usableAxes.y = undefined;
      return;
    }
    for (const axis of ['x', 'y'] as const) {
      const projection = streetAxisProjection(view.location.x, view.location.y, axis, cityView);
      if (projection !== undefined && Math.abs(projection) > streetAxisMinSpan) usableAxes[axis] = projection < 0;
    }
  }

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
          rememberAxes(view, active);
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
      rememberAxes(view, raster === ring ? ring : undefined);
      markReady();
    },
    resize(width: number, height: number) {
      size = { width, height };
      (world ?? raster).resize(width, height);
    },
    projectPoint: (x: number, y: number) => (world ?? raster).projectPoint(x, y),
    pointInWorld: (x: number, y: number) => (world ?? raster).pointInWorld(x, y),
    hitSurvey(x: number, y: number) {
      if (world) return world.hitSurvey(x, y);
      if (ring && raster === ring) return ring.hitSurvey(x, y);
    },
    hitActor(x: number, y: number, candidates: FieldView['map']['npcs'], doorway: (actor: FieldView['map']['npcs'][number]) => boolean) {
      if (world) return world.hitActor(x, y, candidates, doorway);
      if (ring && raster === ring) return ring.hitActor(x, y, candidates, doorway);
      return candidates.find(actor => {
        const entrance = doorway(actor);
        const projected = raster.projectPoint(feetX(actor.x), feetY(actor.y));
        return Math.abs(projected.x - x) <= (entrance ? 11 : 8) * projected.scale &&
          y >= projected.y - (entrance ? 48 : 27) * projected.scale && y <= projected.y + 3 * projected.scale;
      });
    },
    resetCamera: () => (world ?? raster).resetCamera(),
    getCamera: () => (world ?? raster).getCamera(),
    streetAxisProjection,
    lastUsableAxis: (axis: 'x' | 'y') => usableAxes[axis],
    destroy() {
      destroyed = true;
      const active = world ?? pendingWorld;
      active?.surface.removeEventListener('webglcontextlost', restoreClassic);
      active?.destroy();
    },
  };
}
