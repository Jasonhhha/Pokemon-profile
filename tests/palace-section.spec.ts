import { TILE } from '../src/field-layout';
import { expect, test } from '@playwright/test';
import { fortressMaps } from '../src/field-fortress-state';
import { riserCrest, riserSites } from '../src/fortress-risers';

test('the pair of shafts rises in the pools on every floor and the wave follows it upwards', () => {
  for (const room of ['catacomb','aqueduct','sluice'] as const) {
    const site=riserSites[room];
    for(const side of [-1,1]){
      expect(fortressMaps[room].walkable[Math.floor(site.z)][Math.floor(site.center+side*site.spread)]).toBe(false);
    }
    const phase=site.delay + 3 * .32;
    expect(riserCrest(phase,room,3,false)).toBeGreaterThan(.99);
    expect(riserCrest(phase,room,4,false)).toBeLessThan(.3);
    expect(riserCrest(phase+.32,room,4,false)).toBeGreaterThan(.99);
    expect(riserCrest(phase,room,3,true)).toBe(riserCrest(phase+.32,room,4,true));
  }
});

test('inside the palace the section shows the real surface load and links back to the current floor plan',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('tidebound-save-v1',JSON.stringify({
    fortressOpened:true,palaceLayout:2,gridLimited:true,location:{area:'harbor',fortressRoom:'aqueduct',x:24,y:24}
  })));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await expect(page.locator('.game-canvas canvas')).toHaveAttribute('data-renderer',/webgl|canvas2d/);
  const opening=page.getByRole('button',{name:'地宫纵剖图',exact:true});
  await opening.click();
  const section=page.getByRole('dialog',{name:'地宫纵剖图'});
  await expect(section.getByText('13%',{exact:true})).toBeVisible();
  await expect(section.getByText('▸ 你在 B2 · 御水长庭')).toBeVisible();
  await section.getByRole('button',{name:'B4 冰核封印殿'}).click();
  await expect(section.getByRole('heading',{name:'封印观测桥'})).toBeVisible();
  await section.getByRole('button',{name:'B2 御水长庭'}).click();
  await section.getByRole('button',{name:'展开本层平面'}).click();
  const plan=page.getByRole('dialog',{name:'地宫行迹图'});
  await expect(plan).toBeVisible();
  await plan.getByRole('button',{name:'返回地宫纵剖图'}).click();
  await section.getByRole('button',{name:'查看地表环城'}).click();
  await expect(page.getByRole('dialog',{name:'环城地图'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(section).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(opening).toBeFocused();
  await expect(page.locator('.game-viewport')).toHaveAttribute('data-room','aqueduct');
});

for(const backend of ['webgl','canvas2d']){
  test('survey the full court, rotate and walk to a visible paving stone in '+backend,async({page})=>{
    await page.addInitScript((backend)=>{
      if(backend==='canvas2d'){
        const get=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=new Proxy(get,{apply(t,c,a){return String(a[0]).includes('webgl')?null:Reflect.apply(t,c,a);}});
      }
      localStorage.setItem('tidebound-save-v1',JSON.stringify({fortressOpened:true,palaceLayout:2,location:{area:'harbor',fortressRoom:'aqueduct',x:24,y:31}}));
    },backend);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('/');
    const view=page.locator('.game-viewport'),canvas=page.locator('.game-canvas canvas');
    await expect(canvas).toHaveAttribute('data-renderer',backend);
    await page.getByRole('button',{name:'俯瞰宫殿',exact:true}).click();
    await expect(view).toHaveAttribute('data-overview','true');
    const bounds=(await canvas.boundingBox())!;
    const point=()=>page.evaluate((tile)=>{
      const field=(window as unknown as {__field:{projectPoint:(x:number,y:number)=>{x:number;y:number}}}).__field;
      const c=document.querySelector<HTMLCanvasElement>('.game-canvas canvas')!;
      const dest=field.projectPoint(24.5*tile,30.5*tile);
      return {x:dest.x/c.width,y:dest.y/c.height};
    },TILE);
    await page.waitForFunction(()=>Boolean((window as unknown as {__field?:unknown}).__field));
    const before=await point();
    await page.mouse.move(bounds.x+bounds.width*.50,bounds.y+bounds.height*.52);
    await page.mouse.down();
    await page.mouse.move(bounds.x+bounds.width*.64,bounds.y+bounds.height*.57,{steps:5});
    await page.mouse.up();
    await expect.poll(async()=>Math.abs((await point()).x-before.x)).toBeGreaterThan(.009);
    const dest=await point();
    expect(dest.x).toBeGreaterThan(0);expect(dest.x).toBeLessThan(1);
    expect(dest.y).toBeGreaterThan(0);expect(dest.y).toBeLessThan(1);
    await page.mouse.click(bounds.x+bounds.width*dest.x,bounds.y+bounds.height*dest.y);
    await expect(view).not.toHaveAttribute('data-overview','true');
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tidebound-save-v1')!).location)).toMatchObject({fortressRoom:'aqueduct',x:24,y:30});
  });
}
