import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.STRIDE_CHROME||resolve(homedir(),'.agent-browser/browsers/chrome-153.0.8010.52/chrome.exe')});
const page=await browser.newPage();const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
await page.route(/^https?:/,route=>{requests.push(route.request().url());route.abort();});
try{
 await page.goto(pathToFileURL(resolve('打开演示.html')).href);
 await page.locator('#mute').click();await page.locator('[data-scenario="rocky"]').click();await page.locator('#start').click();
 await page.waitForFunction(()=>document.querySelector('#pattern-name').textContent==='Triple short pulses');
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 await page.locator('#mode-real').click();await page.locator('#camera-start').click();
 await page.waitForFunction(()=>document.querySelector('#camera-message').textContent.includes('启动完整演示.cmd'));
 await writeFile('artifacts/offline-check.json',JSON.stringify({passed:true,errors,externalRequests:requests,simulation:'file://, networking blocked',cameraMode:'correctly points to localhost launcher'},null,2));console.log('PASS offline HTML simulation and camera launcher guidance');
}finally{await browser.close();}
