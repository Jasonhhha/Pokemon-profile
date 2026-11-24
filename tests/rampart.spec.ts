import { expect, test, type Page } from '@playwright/test';
const save = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('tidebound-save-v1')!));
const v = (page: Page) => page.locator('.game-viewport');
const action = (page: Page, name: string) => page.getByRole('button',{name,exact:true});

test('the exposed bridge leads to a playable exterior descent and the royal gate on foot', async ({page}) => {
  test.setTimeout(70000);
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.goto('./');
  await action(page,'前往西栈桥').click();
  await action(page,'升起堡垒').click({timeout:13000});
  await action(page,'踏上外壁长阶').click();
  const field = page.getByRole('application');
  await expect(v(page)).toHaveAttribute('data-wall-passage','true');
  await expect(page.locator('.loading')).toHaveCount(0); await field.focus(); await page.keyboard.down('Shift'); await page.keyboard.down('ArrowUp');
  await expect.poll(async()=>(await save(page)).location.y).toBeLessThan(45);
  await page.keyboard.up('ArrowUp'); await page.keyboard.up('Shift');
  await page.waitForTimeout(260);
  const stopped=(await save(page)).location;
  expect(stopped.wallPassage).toBe(true);
  await page.reload();
  await expect(v(page)).toHaveAttribute('data-wall-passage','true');
  expect((await save(page)).location).toEqual(stopped);
  await expect(page.locator('.loading')).toHaveCount(0); await field.focus(); await page.keyboard.down('Shift'); await page.keyboard.down('ArrowUp');
  await expect(v(page)).toHaveAttribute('data-room','sluice',{timeout:16000});
  await page.keyboard.up('ArrowUp'); await page.keyboard.up('Shift');
  await action(page,'返回下层王门').click();
  await expect(v(page)).toHaveAttribute('data-wall-passage','true');
  await action(page,'沿阶返回西栈桥').click();
  await expect.poll(async()=>(await save(page)).location,{timeout:27000}).toEqual({area:'harbor',x:3,y:12});
});

test('walking from the winch onto the seaward tile enters the bridge without the destination button', async({page})=>{
  await page.addInitScript(()=>{if(!localStorage.getItem('tidebound-save-v1')) localStorage.setItem('tidebound-save-v1',JSON.stringify({fortressOpened:true,location:{area:'harbor',x:3,y:12}}));});
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.goto('./');
  const streetCameraScale = () => page.evaluate(() => Reflect.get(window,'__field').getCamera().scale);
  await action(page,'返回街道').waitFor();
  const distantScale=await streetCameraScale();
  await action(page,'返回街道').click();
  await expect.poll(streetCameraScale).toBeGreaterThan(distantScale * 1.5);
  const field=page.getByRole('application');
  // Tap the presented street tile at the seaward lip of the pier.
  const screen=await page.evaluate(()=>{
    const el=document.querySelector('.game-canvas canvas') as HTMLCanvasElement;
    const d=Reflect.get(window,'__field');
    const pt=d.projectPoint(3.5*16,13.875*16), frame=d.getCamera(), box=el.getBoundingClientRect();
    return {x:pt.x/frame.width*box.width,y:pt.y/frame.height*box.height};
  });
  await field.click({position:screen});
  await expect(v(page)).toHaveAttribute('data-wall-passage','true',{timeout:6500});
});

test('a legacy maze save reopens in its corresponding palace, with a clear unblocked axis',async({page})=>{
  await page.addInitScript(()=>{if(!localStorage.getItem('tidebound-save-v1'))localStorage.setItem('tidebound-save-v1',JSON.stringify({
    location:{area:'harbor',fortressRoom:'aqueduct',x:4,y:19},fortressOpened:true,mazeTrail:{aqueduct:[19*23+4],catacomb:[]}
  }));});
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('./');
  await expect(v(page)).toHaveAttribute('data-room','aqueduct');
  await expect.poll(async()=>(await save(page)).location).toMatchObject({x:24,y:43});
  await page.getByRole('application').focus(); await page.keyboard.down('Shift'); await page.keyboard.down('ArrowUp');
  await expect.poll(async()=>(await save(page)).location.y,{timeout:13000}).toBeLessThanOrEqual(6);
  await page.keyboard.up('ArrowUp'); await page.keyboard.up('Shift');await page.waitForTimeout(200);
  await page.getByRole('application').press('e');
  await expect(v(page)).toHaveAttribute('data-room','catacomb');
});
