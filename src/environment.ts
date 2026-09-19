import type { Lang, PatternId, Risk } from './engine';
export type Box = [number, number, number, number];
export type Side = 'left' | 'ahead' | 'right';
export interface Observation { label: string; score: number | null; box: Box; source: 'object' | 'layout'; }
export interface DepthFrame { values: Uint8Array; width: number; height: number; capturedAt: number; }
export interface Track extends Observation { id: number; hits: number; seen: number; side: Side; proximity: number; range: 'near' | 'mid' | 'far'; distanceSource: 'relative-depth' | 'image-size' | 'unknown'; central: boolean; }
export interface EnvironmentDecision { risk: Risk; pattern: PatternId; en: string; zh: string; key: string; track: Track | null; }
const labels: Record<string, string> = { person:'人', chair:'椅子', 'dining table':'桌子', table:'桌子', wall:'墙', door:'门', stairs:'楼梯', stairway:'楼梯', escalator:'扶梯', floor:'地面', windowpane:'窗户', sidewalk:'人行道', fence:'围栏', railing:'栏杆', cabinet:'柜子', bed:'床', sofa:'沙发', couch:'沙发', bench:'长椅', car:'汽车', bicycle:'自行车', motorcycle:'摩托车', bus:'巴士', truck:'卡车', 'potted plant':'盆栽', plant:'植物', tree:'树木', bottle:'瓶子', cup:'杯子', 'cell phone':'手机', laptop:'电脑', tv:'电视', backpack:'背包', suitcase:'行李箱', 'sports ball':'球', dog:'狗', cat:'猫', book:'书', sink:'水池', toilet:'马桶', 'unknown surface':'未知表面' };
export const objectLabel = (label: string, lang: Lang) => lang === 'en' ? label : labels[label] ?? label;
export const sideLabel = (side: Side, lang: Lang) => lang === 'en' ? side : ({ left:'左侧', ahead:'正前方', right:'右侧' })[side];
export const rangeLabel = (range: Track['range'], lang: Lang) => lang === 'en' ? ({ near:'nearer', mid:'middle', far:'farther' })[range] : ({ near:'相对较近', mid:'中间距离', far:'相对较远' })[range];
const clamp = (v: number) => Math.min(1, Math.max(0, v));
export function sideFromBox(box: Box): Side { const cx = box[0] + box[2] / 2; return cx < 0.35 ? 'left' : cx > 0.65 ? 'right' : 'ahead'; }
export function overlap(a: Box, b: Box) { const w = Math.max(0, Math.min(a[0]+a[2],b[0]+b[2])-Math.max(a[0],b[0])); const h = Math.max(0,Math.min(a[1]+a[3],b[1]+b[3])-Math.max(a[1],b[1])); return w*h / Math.max(1e-6, a[2]*a[3]+b[2]*b[3]-w*h); }
export function depthInBox(depth: DepthFrame | null, box: Box, now: number): number | null {
  if (!depth || now - depth.capturedAt > 2500 || depth.width < 1 || depth.height < 1 || depth.values.length !== depth.width*depth.height) return null;
  const values: number[] = [];
  // Median of the inner box reduces background contamination at object edges.
  for (let v=0.2;v<=0.8;v+=0.1) for(let u=0.2;u<=0.8;u+=0.1) {
    const x=Math.min(depth.width-1,Math.floor(clamp(box[0]+box[2]*u)*depth.width));
    const y=Math.min(depth.height-1,Math.floor(clamp(box[1]+box[3]*v)*depth.height)); values.push(depth.values[y*depth.width+x]/255);
  }
  values.sort((a,b)=>a-b); return values[Math.floor(values.length/2)];
}
export class EnvironmentTracker {
  tracks: Track[]=[]; nextId=1;
  clear() { this.tracks=[]; this.nextId=1; }
  update(observations: Observation[], now: number, depth: DepthFrame | null, source: Observation['source']) {
    this.expire(now); const used=new Set<number>();
    for(const observation of observations) {
      if (observation.source !== source || observation.box.some(x=>!Number.isFinite(x)) || observation.box[2]<=0 || observation.box[3]<=0 || (observation.score!==null && (!Number.isFinite(observation.score) || observation.score<0.5))) continue;
      const match=this.tracks.filter(tr=>tr.source===source&&tr.label===observation.label&&!used.has(tr.id)&&overlap(tr.box,observation.box)>0.12).sort((a,b)=>overlap(b.box,observation.box)-overlap(a.box,observation.box))[0];
      const box=observation.box.map((v,i)=>clamp(match?match.box[i]*0.35+v*0.65:v)) as Box;
      const depthValue=depthInBox(depth,box,now);
      // Only a relative image-size cue. No fabricated metres or camera calibration.
      const heuristic=observation.source==='layout'?0.35:clamp(Math.max(box[3]*0.95,Math.sqrt(box[2]*box[3])*1.5));
      const raw=depthValue??heuristic;
      const proximity=match?match.proximity*0.3+raw*0.7:raw;
      const track:Track={...observation,box,id:match?.id??this.nextId++,hits:(match?.hits??0)+1,seen:now,side:sideFromBox(box),proximity,
        range:proximity>0.65?'near':proximity>0.35?'mid':'far',distanceSource:depthValue!==null?'relative-depth':observation.source==='layout'?'unknown':'image-size',
        central:box[0]<0.6&&box[0]+box[2]>0.4};
      used.add(track.id); if(match)this.tracks[this.tracks.indexOf(match)]=track;else this.tracks.push(track);
    }
    return this.visible(now);
  }
  expire(now:number) { this.tracks=this.tracks.filter(t=>now-t.seen<(t.source==='layout'?3500:1400)); }
  visible(now:number) { this.expire(now); return this.tracks.filter(t=>t.hits>=2); }
}
export function assessEnvironment(tracks:Track[], ageMs:number, ready:boolean):EnvironmentDecision {
  if(!ready||!Number.isFinite(ageMs)||ageMs>2000) return {risk:'uncertain',pattern:'uncertain',en:'Live perception unavailable or delayed. Stop and check your surroundings.',zh:'实时感知不可用或已延迟，请停下确认周围环境。',key:'stale',track:null};
  const central=tracks.filter(t=>t.central).sort((a,b)=> {
    const priority=(x:Track)=>(['stairs','stairway','escalator'].includes(x.label)?3:0)+(x.range==='near'?2:0)+(x.source==='object'?0.2:0);
    return priority(b)-priority(a);
  });
  const candidate=central.find(t=>['stairs','stairway','escalator'].includes(t.label)||t.range==='near');
  if(candidate) { const stair=['stairs','stairway','escalator'].includes(candidate.label); return {risk:'danger',pattern:stair?'drop':'danger',en:`${stair?'Possible stairs':objectLabel(candidate.label,'en')} ahead${stair?'':', appearing close'}. Stop and check.`,zh:`正前方${stair?'可能有楼梯':`有${objectLabel(candidate.label,'zh')}，看起来较近`}，请停下确认。`,key:`danger-${candidate.id}-${stair?'stairs':'near'}`,track:candidate}; }
  const any=central.find(t=>t.source==='object')??tracks.find(t=>t.source==='object')??central[0];
  if(any) return {risk:'caution',pattern:'obstacle',en:`${objectLabel(any.label,'en')} ${any.side==='ahead'?'ahead':`on your ${any.side}`}. ${any.source==='layout'?'Scene label is tentative. ':''}Check before moving.`,zh:`${sideLabel(any.side,'zh')}有${objectLabel(any.label,'zh')}。${any.source==='layout'?'场景类别仍需确认。':''}移动前请确认环境。`,key:`caution-${any.id}-${any.side}`,track:any};
  return {risk:'clear',pattern:'off',en:'No supported objects detected. Unseen and unrecognized space remains unknown.',zh:'暂未检测到支持的物体，未观察或未识别的区域仍属未知。',key:'unknown-space',track:null};
}
