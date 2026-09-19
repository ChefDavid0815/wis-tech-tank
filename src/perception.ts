import { EnvironmentTracker, assessEnvironment, type DepthFrame, type Observation, type Track } from './environment';
import type { ObjectDetection } from '@tensorflow-models/coco-ssd';
let modelPromise:Promise<ObjectDetection>|null=null;
async function objectModel() {
  if(!modelPromise)modelPromise=(async()=>{
    const tf=await import('@tensorflow/tfjs'); await tf.ready();
    try{await tf.setBackend('webgl');await tf.ready();}catch{await tf.setBackend('cpu');await tf.ready();}
    const coco=await import('@tensorflow-models/coco-ssd');
    return coco.load({base:'lite_mobilenet_v2',modelUrl:new URL('models/coco/model.json',location.href).href});
  })().catch(e=>{modelPromise=null;throw e;});
  return modelPromise;
}
export class Perception {
  tracker=new EnvironmentTracker(); tracks:Track[]=[]; depth:DepthFrame|null=null;
  status:'idle'|'loading'|'running'|'error'='idle'; source:'camera'|'image'='camera';
  error=''; modelStatus='idle'; layoutStatus='idle'; depthStatus='off';
  objectMs=0; layoutMs=0; depthMs=0; fps=0; frames=0; lastFrame=0; lastLayout=0;
  lastVideoTime=-1; depthEnabled=false; layoutEnabled=true;
  private stream:MediaStream|null=null; private model:ObjectDetection|null=null; private worker:Worker|null=null;
  private workerBusy=false; private workerReady=false; private depthReady=false; private generation=0;
  private timer=0; private workerDeadline=0; private lastWorker=0; private image:HTMLImageElement|null=null; private imageUrl='';
  private input=document.createElement('canvas'); private roomInput=document.createElement('canvas');
  constructor(public video:HTMLVideoElement,public changed:()=>void){}
  get active(){return this.status==='running';}
  get decision(){return assessEnvironment(this.tracker.visible(performance.now()),this.lastFrame?performance.now()-this.lastFrame:Infinity,this.active);}
  async startCamera(deviceId='') {
    this.stop();this.source='camera';this.status='loading';this.error='';const gen=this.generation;this.changed();
    try {
      if(location.protocol==='file:')throw new Error('LOCALHOST_REQUIRED');
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('CAMERA_API_UNAVAILABLE');
      const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:deviceId?{deviceId:{exact:deviceId},width:{ideal:640},height:{ideal:480}}:{facingMode:'environment',width:{ideal:640},height:{ideal:480}}});
      if(gen!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream;this.video.srcObject=stream;await this.video.play();
      stream.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if(gen===this.generation)this.fail('CAMERA_DISCONNECTED');}));
      await this.initialize(gen);
    }catch(error){if(gen===this.generation)this.fail(error instanceof Error?error.message:String(error));}
  }
  async startImage(file:File) {
    this.stop();this.source='image';this.status='loading';this.error='';const gen=this.generation;this.changed();
    try {
      if(location.protocol==='file:')throw new Error('LOCALHOST_REQUIRED');
      if(!file.type.startsWith('image/')||file.size>15*1024*1024)throw new Error('Use an image smaller than 15 MB.');
      this.imageUrl=URL.createObjectURL(file);const img=new Image();img.src=this.imageUrl;await img.decode();
      if(gen!==this.generation)return;this.image=img;await this.initialize(gen);
    }catch(error){if(gen===this.generation)this.fail(error instanceof Error?error.message:String(error));}
  }
  async initialize(gen:number) {
    this.modelStatus='loading';this.changed();
    this.model=await objectModel();if(gen!==this.generation)return;
    this.modelStatus='ready';this.status='running';this.lastFrame=0;this.setupWorker(gen);this.changed();void this.infer(gen);
  }
  private setupWorker(gen:number) {
    this.worker=new Worker(new URL('assets/perception-worker.js',location.href),{type:'module'});this.workerBusy=true;this.layoutStatus='loading';
    this.workerDeadline=window.setTimeout(()=>{if(gen===this.generation&&this.workerBusy){this.worker?.terminate();this.worker=null;this.workerReady=false;this.workerBusy=false;this.layoutStatus='error';this.depthStatus='error';this.changed();}},45000);
    this.worker.onmessage=e=>{
      if(gen!==this.generation)return;const m=e.data;
      if(m.type==='ready'){clearTimeout(this.workerDeadline);this.workerReady=true;this.workerBusy=false;this.layoutStatus='ready';}
      if(m.type==='depth-ready'){clearTimeout(this.workerDeadline);this.depthReady=true;this.workerBusy=false;this.depthStatus='ready';}
      if(m.type==='layout'){
        this.layoutMs=m.ms;this.lastLayout=m.capturedAt;
        if(performance.now()-m.capturedAt<3500&&this.layoutEnabled)this.tracker.update(m.observations, m.capturedAt,this.depth,'layout');
      }
      if(m.type==='depth'){this.depthMs=m.ms;this.depth={values:new Uint8Array(m.values),width:m.width,height:m.height,capturedAt:m.capturedAt};}
      if(m.type==='frame-done'){clearTimeout(this.workerDeadline);this.workerBusy=false;}
      if(m.type==='error'){clearTimeout(this.workerDeadline);this.workerBusy=false;if(m.task==='depth-init'){this.depthStatus='error';this.depthEnabled=false;}else{this.layoutStatus='error';this.workerReady=false;this.worker?.terminate();this.worker=null;}console.warn('Perception worker:',m.message);}
      this.changed();
    };
    this.worker.onerror=e=>{clearTimeout(this.workerDeadline);this.workerBusy=false;this.workerReady=false;this.layoutStatus='error';this.depthStatus='error';console.warn('Perception worker:',e.message);this.worker?.terminate();this.worker=null;this.changed();};
    this.worker.postMessage({type:'init',base:new URL('.',location.href).href});
  }
  setDepth(enabled:boolean){this.depthEnabled=enabled;if(!enabled){this.depth=null;this.depthStatus='off';}else this.depthStatus=this.depthReady?'ready':'loading';this.changed();}
  setLayout(enabled:boolean){this.layoutEnabled=enabled;if(!enabled)this.tracker.tracks=this.tracker.tracks.filter(t=>t.source!=='layout');}
  private async infer(gen:number) {
    if(gen!==this.generation||!this.active||!this.model)return;
    const started=performance.now();
    const source=this.source==='image'?this.image:this.video;
    try {
      if(!source)throw new Error('FRAME_UNAVAILABLE');
      const w=this.source==='image'?this.image!.naturalWidth:this.video.videoWidth;
      const h=this.source==='image'?this.image!.naturalHeight:this.video.videoHeight;
      const fresh=this.source==='image'||this.video.currentTime!==this.lastVideoTime;
      if(w&&h&&fresh){
        this.lastVideoTime=this.video.currentTime;
        this.input.width=640;this.input.height=Math.round(640*h/w);const ctx=this.input.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(source,0,0,this.input.width,this.input.height);
        const detections=await this.model.detect(this.input,20,0.5);if(gen!==this.generation)return;
        const observations:Observation[]=detections.map(d=>({label:d.class,score:d.score,source:'object',box:[d.bbox[0]/this.input.width,d.bbox[1]/this.input.height,d.bbox[2]/this.input.width,d.bbox[3]/this.input.height]}));
        this.tracker.update(observations,started,this.depth,'object');this.tracks=this.tracker.visible(performance.now());
        this.objectMs=performance.now()-started;this.fps=this.lastFrame?1000/(started-this.lastFrame):0;this.lastFrame=started;this.frames++;
        if(this.workerReady&&!this.workerBusy&&this.worker){
          if(this.depthEnabled&&!this.depthReady){this.workerBusy=true;this.worker.postMessage({type:'depth-init'});this.depthStatus='loading';}
          else if((this.layoutEnabled||this.depthEnabled)&&started-this.lastWorker>900){
            this.workerBusy=true;this.lastWorker=started;this.roomInput.width=320;this.roomInput.height=Math.round(320*h/w);const room=this.roomInput.getContext('2d',{willReadFrequently:true})!;room.drawImage(source,0,0,this.roomInput.width,this.roomInput.height);
            const pixels=room.getImageData(0,0,this.roomInput.width,this.roomInput.height).data.buffer;
            this.worker.postMessage({type:'frame',pixels,width:this.roomInput.width,height:this.roomInput.height,capturedAt:performance.now(),depth:this.depthEnabled,layout:this.layoutEnabled},[pixels]);
          }
          if(this.workerBusy){this.workerDeadline=window.setTimeout(()=>{this.worker?.terminate();this.worker=null;this.workerBusy=false;this.workerReady=false;this.layoutStatus='timeout';this.depthStatus='timeout';this.depth=null;this.changed();},30000);}
        }
        this.changed();
      }
    }catch(error){if(gen===this.generation)this.fail(error instanceof Error?error.message:String(error));return;}
    if(gen===this.generation&&this.active)this.timer=window.setTimeout(()=>void this.infer(gen),Math.max(60,200-(performance.now()-started)));
  }
  preview(ctx:CanvasRenderingContext2D,width:number,height:number){
    const source=this.source==='image'?this.image:this.video;if(source&&((this.source==='image'&&this.image?.complete)||(this.video.readyState>=2)))ctx.drawImage(source,0,0,width,height);
  }
  get aspect(){return this.source==='image'&&this.image?this.image.naturalWidth/this.image.naturalHeight:this.video.videoWidth/this.video.videoHeight||4/3;}
  stop(){this.generation++;clearTimeout(this.timer);clearTimeout(this.workerDeadline);this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.srcObject=null;this.worker?.terminate();this.worker=null;this.workerReady=false;this.workerBusy=false;this.depthReady=false;this.depthEnabled=false;this.depthStatus='off';this.layoutStatus='idle';this.lastVideoTime=-1;this.lastFrame=0;this.lastLayout=0;this.lastWorker=0;this.frames=0;this.fps=0;this.objectMs=0;this.layoutMs=0;this.depthMs=0;this.tracker.clear();this.tracks=[];this.depth=null;this.image=null;if(this.imageUrl)URL.revokeObjectURL(this.imageUrl);this.imageUrl='';this.status='idle';}
  fail(message:string){this.stop();this.error=message;this.status='error';this.changed();}
}
