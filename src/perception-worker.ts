/// <reference lib="webworker" />
import { env, pipeline, RawImage, type ImageSegmentationPipeline, type DepthEstimationPipeline } from '@huggingface/transformers';
import type { Observation, Box } from './environment';
let layout: ImageSegmentationPipeline | null=null;
let depth: DepthEstimationPipeline | null=null;
let busy=false;
const createPipeline=pipeline as unknown as (task:string,model:string,options:Record<string,unknown>)=>Promise<unknown>;
const wanted=new Set(['wall','door','stairs','stairway','escalator','fence','railing','windowpane']);
const send=(value:unknown)=>self.postMessage(value);
self.onmessage=async(event:MessageEvent)=>{
  const m=event.data;
  if(busy)return;
  busy=true;
  try {
    if(m.type==='init') {
      env.allowRemoteModels=false; env.allowLocalModels=true; env.localModelPath=`${m.base}models/`; env.useBrowserCache=false;
      env.backends.onnx.wasm!.wasmPaths=`${m.base}assets/ort/`; env.backends.onnx.wasm!.numThreads=1;
      send({type:'status',stage:'Loading room-layout model…'});
      layout=await createPipeline('image-segmentation','layout',{dtype:'q8',device:'wasm',local_files_only:true}) as ImageSegmentationPipeline;
      send({type:'ready'});
    } else if(m.type==='depth-init') {
      send({type:'status',stage:'Loading optional depth model…'});
      depth=await createPipeline('depth-estimation','depth',{dtype:'q8',device:'wasm',local_files_only:true}) as DepthEstimationPipeline;
      // Smaller input keeps this optional branch suitable for a live demo.
      (depth.processor as any).image_processor.size={height:252,width:252};
      send({type:'depth-ready'});
    } else if(m.type==='frame') {
      const start=performance.now();
      const image=new RawImage(new Uint8ClampedArray(m.pixels),m.width,m.height,4);
      const observations:Observation[]=[];
      if(layout&&m.layout!==false) {
        const results=await layout(image,{target_sizes:[[96,128]]});
        for(const result of results) {
          if(!result.label||!wanted.has(result.label))continue;
          const {data,width,height}=result.mask;
          // Connected components prevent two doors from becoming one giant region.
          const seen=new Uint8Array(width*height);
          for(let seed=0;seed<seen.length;seed++) {
            if(seen[seed]||!data[seed])continue;
            const queue=[seed];seen[seed]=1;let minX=width,minY=height,maxX=0,maxY=0,count=0;
            for(let q=0;q<queue.length;q++){
              const index=queue[q],x=index%width,y=Math.floor(index/width);count++; minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
              for(const next of [x>0?index-1:-1,x<width-1?index+1:-1,y>0?index-width:-1,y<height-1?index+width:-1])if(next>=0&&!seen[next]&&data[next]){seen[next]=1;queue.push(next);}
            }
            if(count/(width*height)<0.018)continue;
            const box:Box=[minX/width,minY/height,(maxX-minX+1)/width,(maxY-minY+1)/height];
            observations.push({label:result.label,score:null,box,source:'layout'});
          }
        }
      }
      send({type:'layout',observations,capturedAt:m.capturedAt,ms:performance.now()-start});
      if(depth&&m.depth) {
        const dStart=performance.now(); const result=await depth(image); const output=Array.isArray(result)?result[0]:result;
        const thumb=await output.depth.resize(128,96);
        const values=new Uint8Array(thumb.data);
        send({type:'depth',values,width:thumb.width,height:thumb.height,capturedAt:m.capturedAt,ms:performance.now()-dStart});
      }
      send({type:'frame-done'});
    }
  }catch(error){send({type:'error',task:m.type,message:error instanceof Error?error.message:String(error)});}
  finally{busy=false;}
};
