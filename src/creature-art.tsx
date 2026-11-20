import { useEffect, useRef } from 'react';
import { creatures, type CreatureId } from './creatures';

const sprites = new Map<string, Promise<HTMLCanvasElement>>();
const width = 64;
const height = 58;

function cropSprite(image: HTMLImageElement) {
  const source = document.createElement('canvas');
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  const context = source.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, source.width, source.height);
  let left = source.width;
  let right = 0;
  let top = source.height;
  let bottom = 0;
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (!data[(y * source.width + x) * 4 + 3]) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (left > right || top > bottom) return source;
  const crop = document.createElement('canvas');
  crop.width = right - left + 1;
  crop.height = bottom - top + 1;
  crop.getContext('2d')!.drawImage(source, left, top, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return crop;
}

/** Decode and trim transparent margins from a provided sprite. */
export function loadSprite(url: string): Promise<HTMLCanvasElement> {
  let asset = sprites.get(url);
  if (!asset) {
    const image = new Image();
    image.src = url;
    asset = image.decode().then(() => cropSprite(image));
    sprites.set(url, asset);
    void asset.catch(() => sprites.delete(url));
  }
  return asset;
}

export function loadCreatureSprite(id: CreatureId): Promise<HTMLCanvasElement> {
  return loadSprite(creatures[id].asset);
}

export function CreatureSprite({ id, className = '', back = false }: { id: CreatureId; className?: string; back?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    let alive = true;
    context.clearRect(0, 0, width, height);
    void loadCreatureSprite(id).then(sprite => {
      if (!alive) return;
      const scale = Math.min((width - 5) / sprite.width, (height - 4) / sprite.height, 1.34);
      const drawnWidth = Math.round(sprite.width * scale);
      const drawnHeight = Math.round(sprite.height * scale);
      context.save();
      context.imageSmoothingEnabled = false;
      if (back) {
        context.translate(width, 0);
        context.scale(-1, 1);
      }
      context.drawImage(sprite, Math.floor((width - drawnWidth) / 2), height - drawnHeight - 3, drawnWidth, drawnHeight);
      context.restore();
    }).catch(() => {});
    return () => { alive = false; };
  }, [id, back]);
  return <canvas ref={canvas} data-species={id} className={`creature-sprite ${className}`} width={width} height={height} role="img" aria-label={creatures[id].name} />;
}
