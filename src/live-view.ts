import { Perception } from './perception';
import { objectLabel, sideLabel, rangeLabel, type Track } from './environment';
import type { Lang } from './engine';
export class LiveView {
  element:HTMLElement; perception:Perception; lang:Lang='en';
  private video:HTMLVideoElement; private preview:HTMLCanvasElement; private map:HTMLCanvasElement; private depth:HTMLCanvasElement;
  private select:HTMLSelectElement; private revision='';
  constructor() {
    this.element=document.createElement('section');this.element.className='real-panel';this.element.hidden=true;
    this.element.innerHTML=`<div class="real-heading"><div><div class="section-label" data-en="LIVE PERCEPTION / LOCAL PROCESSING" data-zh="实时感知 / 本机处理"></div><h2 data-en="Understand the space around you." data-zh="让周围的空间变得可见。"></h2></div><span class="badge" id="camera-status"></span></div>
    <div class="camera-controls"><button id="camera-start" class="primary-button"></button><select id="camera-select" aria-label="Camera"><option value="" data-en="Default camera" data-zh="默认摄像头"></option></select><label class="image-upload" for="image-input" data-en="Try an image" data-zh="用图片测试"></label><input hidden id="image-input" type="file" accept="image/*"></div>
    <p id="camera-message" class="camera-message" role="status"></p>
    <div class="perception-views"><section class="camera-column"><div class="view-heading"><strong data-en="Camera view" data-zh="摄像头画面"></strong><span id="camera-rate">— FPS</span></div><div class="camera-frame"><video id="live-video" playsinline muted hidden></video><canvas id="live-canvas" width="640" height="480" aria-label="Camera feed with detection boxes"></canvas><div class="camera-placeholder"><span>◉</span><h3 data-en="Your environment becomes the demo." data-zh="把真实环境，变成演示现场。"></h3><p data-en="Start your camera or choose an image. Frames stay on this computer." data-zh="启动摄像头或选择图片，画面仅在本机处理。"></p></div><div class="camera-axis"><span data-en="LEFT" data-zh="左侧"></span><span data-en="AHEAD" data-zh="正前方"></span><span data-en="RIGHT" data-zh="右侧"></span></div></div><p class="camera-note" data-en="Unmirrored view. Point the camera in your intended direction of travel." data-zh="画面未镜像。请让摄像头朝向预计行走方向。"></p></section>
    <section class="map-column"><div class="view-heading"><strong>Environment view</strong><span data-en="RELATIVE / 2D" data-zh="相对位置 / 二维"></span></div><canvas id="environment-map" width="640" height="500" aria-label="User-centered relative environment map"></canvas><p class="camera-note" data-en="Camera-relative positions. Rear and out-of-view space are unknown; this is not SLAM." data-zh="位置相对于摄像头；身后及视野外区域未知，不是 SLAM 地图。"></p></section></div>
    <div class="real-options"><label><input type="checkbox" id="layout-toggle" checked><span data-en="Room layout · walls, doors, stairs" data-zh="场景区域 · 墙、门、楼梯"></span></label><label><input type="checkbox" id="depth-toggle"><span data-en="Monocular depth · optional" data-zh="单目深度 · 可选增强"></span></label></div>
    <div class="model-status"><span>Objects <b id="object-model-status"></b></span><span>Layout <b id="layout-model-status"></b></span><span>Depth <b id="depth-model-status"></b></span></div>
    <div class="live-lower"><div class="observations"><div class="view-heading"><strong data-en="Tracked surroundings" data-zh="持续更新的环境物体"></strong><span id="track-count">0</span></div><div id="track-list"></div></div><div class="depth-preview"><div class="view-heading"><strong data-en="Relative depth" data-zh="相对深度"></strong></div><canvas id="depth-canvas" width="128" height="96" aria-label="Optional relative inverse depth visualization"></canvas><span data-en="Brighter = relatively nearer. No calibrated metres." data-zh="越亮表示相对更近，不是校准后的米数。"></span></div></div>
    <div class="real-footnote" data-en="Experimental perception: objects can be missed or mislabeled. Layout labels are tentative; stairs direction and door passability are not inferred. Feedback asks you to check, never assumes a route is safe." data-zh="实验性识别可能漏检或误判。墙门楼梯属于候选场景标签，不判断楼梯上下方向或门是否可通行。提示只要求确认环境，不推断安全通路。"></div>`;
    document.querySelector('.workspace')!.insertBefore(this.element,document.querySelector('.output-panel'));
    this.video=this.q('#live-video');this.preview=this.q('#live-canvas');this.map=this.q('#environment-map');this.depth=this.q('#depth-canvas');this.select=this.q('#camera-select');
    this.perception=new Perception(this.video,()=>{this.revision='';});
    this.q('#camera-start').addEventListener('click',async()=>{if(this.perception.status==='loading'||this.perception.active){this.perception.stop();return;}await this.perception.startCamera(this.select.value);if(this.perception.active)await this.cameras();});
    this.q<HTMLInputElement>('#image-input').addEventListener('change',async e=>{const input=e.target as HTMLInputElement;const file=input.files?.[0];if(file)await this.perception.startImage(file);input.value='';});
    this.q<HTMLInputElement>('#depth-toggle').addEventListener('change',e=>this.perception.setDepth((e.target as HTMLInputElement).checked));
    this.q<HTMLInputElement>('#layout-toggle').addEventListener('change',e=>this.perception.setLayout((e.target as HTMLInputElement).checked));
  }
  private q<T extends HTMLElement=HTMLElement>(selector:string){return this.element.querySelector<T>(selector)!;}
  private t(en:string,zh:string){return this.lang==='en'?en:zh;}
  async cameras(){try{const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');const value=this.select.value;this.select.replaceChildren(new Option(this.t('Default camera','默认摄像头'),''),...devices.map((d,i)=>new Option(d.label||`Camera ${i+1}`,d.deviceId)));this.select.value=value;}catch{}}
  render(now:number,lang:Lang){
    this.lang=lang;const p=this.perception;const tracks=p.tracker.visible(now);const decision=p.decision;
    this.q('#camera-start').textContent=p.status==='loading'?this.t('Cancel loading','取消加载'):p.active?this.t('Stop camera / input','停止摄像头 / 输入'):this.t('Start camera','启动摄像头');
    this.select.disabled=p.active||p.status==='loading';
    this.q<HTMLInputElement>('#depth-toggle').disabled=!p.active||p.layoutStatus==='error'||p.layoutStatus==='timeout';this.q<HTMLInputElement>('#depth-toggle').checked=p.depthEnabled;
    this.q('#camera-status').textContent=p.active?this.t(p.source==='camera'?'Camera active':'IMAGE TEST · not live',p.source==='camera'?'摄像头运行中':'图片测试 · 非实时'):p.status==='loading'?this.t('Loading…','正在加载…'):p.status==='error'?this.t('Needs attention','需要处理'):this.t('Camera off','摄像头关闭');
    this.q('#camera-status').className=`badge ${p.active?'running':''}`;
    const message=p.error.includes('LOCALHOST_REQUIRED')?this.t('Open “启动完整演示.cmd” to use the camera and local models. The single HTML file supports simulation only.','请打开「启动完整演示.cmd」使用摄像头和本地模型；单 HTML 文件用于离线模拟。'):p.status==='error'?this.t(`Unable to start: ${p.error}. Check camera permission, close other camera apps, then retry.`,`无法启动：${p.error}。请检查摄像头权限，关闭占用摄像头的程序后重试。`):p.status==='loading'?this.t('Requesting camera access and loading local models. You can cancel at any time.','正在申请摄像头权限并加载本地模型，可以随时取消。'):this.t('Local models · no frame uploads · no recording. Allow camera access when your browser asks.','模型在本机运行，不上传或录制画面。浏览器询问时请允许摄像头权限。');
    this.q('#camera-message').textContent=message;this.q('#camera-message').classList.toggle('error',p.status==='error');
    this.q('#camera-rate').textContent=p.active?`${p.fps.toFixed(1)} FPS · ${Math.round(p.objectMs)} ms`:'— FPS';
    const state=(s:string)=>this.lang==='en'?s:({idle:'待机',ready:'就绪',loading:'加载中',off:'关闭',error:'出错',timeout:'超时'})[s]??s;
    this.q('#object-model-status').textContent=state(p.modelStatus);
    this.q('#layout-model-status').textContent=state(!p.layoutEnabled?'off':p.layoutStatus)+(p.layoutMs?` · ${Math.round(p.layoutMs)} ms`:'');
    this.q('#depth-model-status').textContent=state(p.depthStatus)+(p.depthMs?` · ${Math.round(p.depthMs)} ms`:'');
    this.q<HTMLElement>('.camera-placeholder').hidden=p.active&&p.frames>0;
    const ctx=this.preview.getContext('2d')!;this.preview.height=Math.round(640/p.aspect);ctx.fillStyle='#182a23';ctx.fillRect(0,0,640,this.preview.height);
    if(p.active){p.preview(ctx,640,this.preview.height);if(now-p.lastFrame<1500)for(const track of tracks.filter(tr=>tr.source==='object'||p.layoutEnabled))this.drawBox(ctx,track);}
    this.drawMap(tracks,now);
    this.q('#track-count').textContent=String(tracks.length);
    const revision=tracks.map(tr=>`${tr.id}-${tr.side}-${tr.range}-${tr.distanceSource}`).join('|')+lang+p.status;
    if(revision!==this.revision){this.revision=revision;this.q('#track-list').innerHTML=tracks.length?tracks.map(tr=>`<div class="track-row"><span class="track-id">${String(tr.id).padStart(2,'0')}</span><strong>${objectLabel(tr.label,lang)}${tr.source==='layout'?' ?':''}</strong><span>${sideLabel(tr.side,lang)}</span><span>${tr.distanceSource==='unknown'?this.t('range unknown','距离未知'):rangeLabel(tr.range,lang)}</span><small>${tr.score===null?this.t('layout region','场景区域'):`${Math.round(tr.score*100)}%`}</small></div>`).join(''):`<p class="empty-tracks">${this.t('Detected objects and structural regions will appear here. No detection does not mean a clear path.','识别到的物体与场景区域会显示在这里；没有检测结果不代表道路安全。')}</p>`;}
    const depthCtx=this.depth.getContext('2d')!;
    if(p.depthEnabled&&p.depth&&now-p.depth.capturedAt<2500){const image=depthCtx.createImageData(p.depth.width,p.depth.height);for(let i=0;i<p.depth.values.length;i++){const v=p.depth.values[i];image.data.set([v,Math.min(255,v+15),Math.max(0,v-15),255],i*4);}depthCtx.putImageData(image,0,0);}else{depthCtx.fillStyle='#e4eade';depthCtx.fillRect(0,0,128,96);depthCtx.fillStyle='#83967a';depthCtx.font='10px sans-serif';depthCtx.textAlign='center';depthCtx.fillText(p.depthEnabled?this.t('Waiting for depth','等待深度数据'):this.t('Depth is optional','深度可选开启'),64,49);}
    return {decision,tracks,age:now-p.lastFrame,ready:p.active};
  }
  private drawBox(ctx:CanvasRenderingContext2D,tr:Track){const[x,y,w,h]=tr.box;const W=this.preview.width,H=this.preview.height;ctx.strokeStyle=tr.source==='layout'?'#e5bf77':tr.central&&tr.range==='near'?'#ff9774':'#b5edb3';ctx.lineWidth=tr.source==='layout'?1.5:2;ctx.setLineDash(tr.source==='layout'?[6,5]:[]);ctx.strokeRect(x*W,y*H,w*W,h*H);ctx.setLineDash([]);const text=`${tr.id} ${objectLabel(tr.label,this.lang)}${tr.source==='layout'?' ?':''}`;ctx.font='13px "Segoe UI", sans-serif';ctx.fillStyle='#20372bd9';const by=Math.max(18,y*H);ctx.fillRect(x*W,by-18,ctx.measureText(text).width+12,20);ctx.fillStyle='#f4f8e9';ctx.fillText(text,x*W+6,by-4);}
  private drawMap(tracks:Track[],now:number){
    const ctx=this.map.getContext('2d')!,W=640,H=500,cx=320,cy=390;ctx.clearRect(0,0,W,H);ctx.fillStyle='#eef2e8';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#dce8d2';ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,335,-Math.PI*0.84,-Math.PI*0.16);ctx.closePath();ctx.fill();
    for(const radius of [115,220,325]){ctx.strokeStyle='#c2d3b9';ctx.lineWidth=1;ctx.beginPath();ctx.arc(cx,cy,radius,-Math.PI*0.84,-Math.PI*0.16);ctx.stroke();}
    for(const angle of [-Math.PI*.65,-Math.PI*.35]){ctx.setLineDash([5,6]);ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+335*Math.cos(angle),cy+335*Math.sin(angle));ctx.stroke();}ctx.setLineDash([]);
    ctx.font='12px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.fillStyle='#75906b';ctx.fillText(this.t('LEFT','左侧'),102,80);ctx.fillText(this.t('AHEAD','正前方'),320,34);ctx.fillText(this.t('RIGHT','右侧'),538,80);
    ctx.font='10px sans-serif';ctx.fillStyle='#8fa082';ctx.fillText(this.t('farther','相对远'),320,83);ctx.fillText(this.t('middle','中间'),320,182);ctx.fillText(this.t('nearer','相对近'),320,290);
    const sorted=[...tracks].sort((a,b)=>Number(a.source==='object')-Number(b.source==='object'));
    sorted.forEach((tr,i)=>{
      const xNorm=tr.box[0]+tr.box[2]/2;const angle=-Math.PI/2+(xNorm-.5)*Math.PI*1.3;
      const radius=tr.distanceSource==='unknown'?285:80+(1-tr.proximity)*235;
      const x=cx+Math.cos(angle)*radius,y=cy+Math.sin(angle)*radius;
      const stale=now-tr.seen>(tr.source==='layout'?2200:800);ctx.globalAlpha=stale?.4:1;
      ctx.fillStyle=tr.central&&tr.range==='near'?'#be7856':tr.source==='layout'?'#a49a6b':'#47734e';
      if(tr.source==='layout'){ctx.setLineDash([4,3]);ctx.strokeStyle=ctx.fillStyle;ctx.strokeRect(x-13,y-9,26,18);ctx.setLineDash([]);}else{ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fill();}
      const text=`${tr.id} · ${objectLabel(tr.label,this.lang)}${tr.source==='layout'?' ?':''}`;ctx.font='11px "Segoe UI", sans-serif';const tw=ctx.measureText(text).width;const tx=Math.max(tw/2+4,Math.min(W-tw/2-4,x));const ty=y+25+(i%2)*12;
      ctx.fillStyle='#f7faf0ed';ctx.fillRect(tx-tw/2-4,ty-12,tw+8,17);ctx.fillStyle='#496140';ctx.fillText(text,tx,ty);ctx.globalAlpha=1;
    });
    ctx.fillStyle='#285741';ctx.beginPath();ctx.arc(cx,cy,15,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f7faf0';ctx.beginPath();ctx.moveTo(cx,cy-9);ctx.lineTo(cx-5,cy+4);ctx.lineTo(cx+5,cy+4);ctx.closePath();ctx.fill();
    ctx.fillStyle='#617658';ctx.font='12px "Segoe UI",sans-serif';ctx.fillText(this.t('YOU / CAMERA','用户 / 摄像头'),cx,425);ctx.fillStyle='#99a18c';ctx.font='10px sans-serif';ctx.fillText(this.t('BEHIND / OUTSIDE VIEW = UNKNOWN','身后 / 视野外 = 未知'),cx,467);
  }
}
