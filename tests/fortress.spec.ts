import { expect, test } from '@playwright/test';
import { fortressLiftStops } from '../src/field-fortress-state';
import { mazeFloors } from '../src/fortress-maze';
import { adventure, button, route, view, walk } from './maze-route';

test('raise the palace, survey its four floors, open the service lift and hear the captive Kyurem', async ({ page }, info) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  // Count audible starts of the real decoded 1.36s cry, excluding ambience, footsteps and the impact tone.
  await page.addInitScript(() => {
    let count = 0;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer && Math.abs(this.buffer.duration - 1.3635) < .012) ++count;
      return start.apply(this, args);
    };
    Object.defineProperty(window, 'cryPlaybackStarts', {get:()=>count});
  });
  await page.goto('/');
  await button(page, '前往西栈桥').click();
  await button(page, '升起堡垒').click();
  await expect(view(page)).toHaveAttribute('data-fortress-phase', 'rising');
  await page.getByRole('application').press('e');
  await page.reload();
  await expect(view(page)).toHaveAttribute('data-fortress-phase','draining',{timeout:14000});
  await expect(button(page,'群岛航线')).toBeDisabled();
  await expect(button(page,'进入堡垒')).toHaveCount(0);
  await button(page,'进入堡垒').click({timeout:16000});
  await button(page,'唤醒潮盘').click();
  // The trainer crosses the water hall while its 3D materials warm up on first entry.
  await expect(view(page)).toHaveAttribute('data-tide-dial','awake',{timeout:12000});
  await button(page,'前往下层').click();
  await expect(view(page)).toHaveAttribute('data-room','aqueduct');
  expect((await adventure(page)).mazeTrail.aqueduct).toHaveLength(1);
  await walk(page,'aqueduct',mazeFloors.aqueduct.switch);
  await button(page,'操作浮桥绞盘').click();
  await expect(view(page)).toHaveAttribute('data-shortcut','open');
  await page.reload();
  await expect(view(page)).toHaveAttribute('data-shortcut','open');
  await button(page,'打开本层行迹图').click();
  await expect(page.getByRole('dialog',{name:'迷宫行迹图'})).toContainText('回流水渠');
  await button(page,'关闭').click();
  await walk(page,'aqueduct',mazeFloors.aqueduct.down);
  await button(page,'沿阶梯下行').click();
  await expect(view(page)).toHaveAttribute('data-room','catacomb');
  await walk(page,'catacomb',mazeFloors.catacomb.switch);
  await button(page,'操作冰纹轮锁').click();
  await expect(view(page)).toHaveAttribute('data-shortcut','open');
  await walk(page,'catacomb',fortressLiftStops.catacomb);
  await button(page,'乘升降台').click();
  await expect(view(page)).toHaveAttribute('data-room','sluice');
  await button(page,'乘升降台').click();
  await expect(view(page)).toHaveAttribute('data-room','catacomb');
  await expect(view(page)).not.toHaveAttribute('data-lift-moving','true');
  await walk(page,'catacomb',mazeFloors.catacomb.down);
  await button(page,'沿阶梯下行').click();
  await button(page,'靠近封印').click();
  await expect(view(page)).toHaveAttribute('data-observing-seal','true');
  await expect(page.getByText('酋雷姆',{exact:true})).toBeVisible();
  await expect(page.getByRole('application').locator('canvas')).toHaveAttribute('data-renderer','webgl');
  await expect.poll(()=>page.evaluate(()=>performance.getEntriesByType('resource').some(r=>r.name.endsWith('/kyurem.glb')))).toBe(true);
  await button(page,'听它吼叫').click();
  await expect(view(page)).toHaveAttribute('data-roar-phase','impact');
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'cryPlaybackStarts'))).toBeGreaterThan(0);
  await view(page).screenshot({path:info.outputPath('kyurem-ward.png')});
  await button(page,'返回观测桥').click();
  await page.reload();
  await expect(view(page)).toHaveAttribute('data-room','seal');
  await button(page,'返回陵廊').click();
  await expect(view(page)).toHaveAttribute('data-room','catacomb');
  expect((await adventure(page)).shortcuts.sort()).toEqual(['aqueduct','catacomb']);
  expect(errors).toEqual([]);
});

test('reduced-motion touch exploration catches closed shortcuts and supports the Canvas seal', async ({ browser },info)=>{
  test.setTimeout(95_000);
  const page=await browser.newPage({ viewport:{width:320,height:720},hasTouch:true,reducedMotion:'reduce' });
  try {
    await page.addInitScript(()=>{
      const original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=new Proxy(original,{apply(target,self,args){return String(args[0]).includes('webgl')?null:Reflect.apply(target,self,args);}});
      if(!localStorage.getItem('tidebound-save-v1')) localStorage.setItem('tidebound-save-v1',JSON.stringify({
        fortressOpened:true,location:{area:'harbor',fortressRoom:'catacomb',x:18,y:19},
      }));
    });
    await page.goto('/');
    await expect(view(page)).toHaveAttribute('data-room','catacomb');
    await expect(view(page)).toHaveAttribute('data-shortcut','closed');
    const {gate,switch:lever,down} = mazeFloors.catacomb;
    await walk(page,'catacomb',{x:gate.x,y:gate.y+1},true);
    const before=(await adventure(page)).location;
    await button(page,'向上移动').tap();
    await button(page,'打开本层行迹图').tap();
    await expect(page.getByRole('dialog')).toContainText('尚未开启');
    expect((await adventure(page)).location).toEqual(before);
    await button(page,'关闭').tap();
    await walk(page,'catacomb',lever,true);
    await button(page,'操作冰纹轮锁').tap();
    await expect(view(page)).toHaveAttribute('data-shortcut','open');
    await walk(page,'catacomb',down,true);
    await button(page,'沿阶梯下行').tap();
    await button(page,'靠近封印').tap();
    await expect(view(page)).toHaveAttribute('data-observing-seal','true');
    await expect(page.locator('.game-canvas canvas')).toHaveAttribute('data-renderer','canvas2d');
    await button(page,'听它吼叫').tap();
    await expect(view(page)).toHaveAttribute('data-roar-phase','impact');
    await view(page).screenshot({path:info.outputPath('kyurem-mobile.png')});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  } finally {await page.close();}
});

test('each floor can be solved with the gate closed and opening its shortcut shortens the return',()=>{
  for(const room of ['aqueduct','catacomb'] as const) {
    const floor=mazeFloors[room];
    const closed=route(room,floor.up,floor.down,false);
    const open=route(room,floor.up,floor.down,true);
    expect(closed.length).toBeGreaterThan(36);
    expect(open.length).toBeLessThan(closed.length);
    expect(open.some(({point})=>point.x===floor.gate.x && point.y===floor.gate.y)).toBe(true);
    expect(route(room,floor.up,floor.switch,false).length).toBeGreaterThan(10);
  }
});

test('the explored map follows actual footsteps and the seal observation is permanent in the Pokédex', async ({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{
    if (localStorage.getItem('tidebound-save-v1')) return;
    localStorage.setItem('tidebound-save-v1',JSON.stringify({fortressOpened:true,location:{area:'harbor',fortressRoom:'aqueduct',x:4,y:19}}));
  });
  await page.goto('/');
  await expect(view(page)).toHaveAttribute('data-room','aqueduct');
  await walk(page,'aqueduct',{x:4,y:18});
  await page.getByRole('application').press('m');
  const atlas=page.getByRole('dialog',{name:'迷宫行迹图'});
  await expect(atlas).toBeVisible();
  const drawing=atlas.locator('svg.maze-drawing');
  await drawing.focus();
  await drawing.press('ArrowDown');
  await button(page,'沿足迹返回所选处').click();
  await expect(atlas).toHaveCount(0);
  await expect.poll(async()=>(await adventure(page)).location).toMatchObject({x:4,y:19});
  await page.evaluate(()=>{
    const saved=JSON.parse(localStorage.getItem('tidebound-save-v1')!);
    // An older release saved "seal" as B2. It remains a valid entrance to the new B4.
    saved.location={area:'harbor',fortressRoom:'seal',x:8,y:11};
    delete saved.kyuremObserved;
    localStorage.setItem('tidebound-save-v1',JSON.stringify(saved));
  });
  await page.reload();
  await button(page,'靠近封印').click();
  await expect.poll(async()=>(await adventure(page)).kyuremObserved).toBe(true);
  await page.getByRole('application').press('j');
  const dex=page.getByRole('dialog',{name:'群岛图鉴'});
  await expect(dex.locator('.dex-detail')).toContainText('酋雷姆');
  await expect(dex.locator('.dex-detail')).toContainText('325.0');
});

test('an underground GPU context loss keeps the same floor and the touchscreen fallback', async ({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('tidebound-save-v1',JSON.stringify({fortressOpened:true,location:{area:'harbor',fortressRoom:'seal',x:8,y:12}}));
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=new Proxy(original,{apply(target,self,args){
      const context=Reflect.apply(target,self,args);
      if(args[0]==='webgl2' && context) Reflect.set(window,'dropChamber',()=>context.getExtension('WEBGL_lose_context')?.loseContext());
      return context;
    }});
  });
  await page.goto('/');
  const canvas=page.locator('.game-canvas canvas');
  await expect(canvas).toHaveAttribute('data-renderer','webgl');
  await expect.poll(()=>page.evaluate(()=>performance.getEntriesByType('resource').some(r=>r.name.endsWith('/kyurem.glb')))).toBe(true);
  // The raster-only atlas is not required when resuming directly into a healthy 3D chamber.
  expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>r.name.endsWith('/kyurem-roar.webp')))).toBe(false);
  await page.evaluate(()=>Reflect.get(window,'dropChamber')());
  await expect(canvas).toHaveAttribute('data-renderer','canvas2d');
  await button(page,'靠近封印').click();
  await expect(view(page)).toHaveAttribute('data-observing-seal','true');
  await button(page,'听它吼叫').click();
  await expect(button(page,'开启声音')).toBeVisible();
  await expect(view(page)).toHaveAttribute('data-roar-phase','impact');
  await expect(button(page,'听它吼叫')).toBeDisabled();
  await expect(button(page,'听它吼叫')).toBeEnabled();
  await expect.poll(()=>page.evaluate(()=>performance.getEntriesByType('resource').some(r=>r.name.endsWith('/kyurem-roar.webp')))).toBe(true);
});
