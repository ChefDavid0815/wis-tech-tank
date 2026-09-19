import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, SCENARIOS, decide, mockFrame, motorOn, STOP_DISTANCE_M } from '../src/engine.ts';
import { EnvironmentTracker, assessEnvironment, depthInBox, sideFromBox, type Observation, type DepthFrame } from '../src/environment.ts';

test('Every simulation scenario produces the intended warning family',()=>{
  const expected=['smooth','rocky','obstacle','obstacle','drop','drop','danger','danger','uncertain'];
  SCENARIOS.forEach((s,i)=>assert.equal(decide(mockFrame(s,0),0.65).pattern,expected[i]));
});
test('Steps stop before contact and ETA changes with walking speed',()=>{
  const sim=new Simulation();sim.select('stairs');sim.start();
  assert.equal(sim.decision.etaS,3.8/0.65);
  sim.speed=1;assert.equal(sim.decision.etaS,3.8);
  for(let i=0;i<100;i++)sim.tick(0.1);
  assert.equal(sim.phase,'stopped');assert.ok(sim.frame.distanceM!>=STOP_DISTANCE_M-1e-6);
});
test('Zero speed has no ETA and pause freezes progress',()=>{
  const sim=new Simulation();sim.select('table');sim.speed=0;sim.start();sim.tick(0.1);
  assert.equal(sim.decision.etaS,null);assert.equal(sim.traveled,0);
  sim.speed=0.8;sim.tick(0.1);sim.pause();const before=sim.traveled;sim.tick(0.1);assert.equal(sim.traveled,before);
});
test('Stale, invalid and low-confidence detections cannot imply clear space',()=>{
  const frame=mockFrame(SCENARIOS[2],0);
  for(const change of [{valid:false},{ageMs:501},{confidence:0.4},{distanceM:NaN},{distanceM:-1}]){const d=decide({...frame,...change},1);assert.equal(d.risk,'uncertain');assert.ok(d.mustStop);}
});
test('Blocked route stops; allowed direction must come from clearance',()=>{
  const frame=mockFrame(SCENARIOS[2],0);
  assert.equal(decide(frame,1).direction,'right');assert.equal(decide({...frame,rightClear:false,leftClear:true},1).direction,'left');
  assert.ok(decide({...frame,rightClear:false,leftClear:false},1).mustStop);
});
test('Motor pulse timing distinguishes on/off and wraps correctly',()=>{
  assert.equal(motorOn('smooth',0.1),true);assert.equal(motorOn('smooth',0.15),false);assert.equal(motorOn('smooth',1.05),true);
  assert.equal(motorOn('off',5),false);assert.equal(motorOn('rocky',0.25),true);
});
test('Terrain duration completes and reset restores clean state',()=>{
  const sim=new Simulation();sim.duration=10;sim.start();for(let i=0;i<110;i++)sim.tick(0.1);
  assert.equal(sim.phase,'complete');sim.reset();assert.equal(sim.elapsed,0);assert.equal(sim.traveled,0);assert.equal(sim.phase,'ready');
});
const person=(x:number):Observation=>({label:'person',score:0.9,box:[x,0.1,0.2,0.75],source:'object'});
test('Environment keeps distinct people, confirms tracks and preserves their IDs',()=>{
  const tracker=new EnvironmentTracker();assert.equal(tracker.update([person(.05),person(.7)],100,null,'object').length,0);
  let tracks=tracker.update([person(.06),person(.69)],300,null,'object');assert.equal(tracks.length,2);const ids=tracks.map(t=>t.id);
  tracks=tracker.update([person(.07),person(.68)],500,null,'object');assert.deepEqual(tracks.map(t=>t.id),ids);assert.deepEqual(tracks.map(t=>t.side),['left','right']);
});
test('Missing tracks expire and cannot remain as phantom obstacles',()=>{
  const tracker=new EnvironmentTracker();tracker.update([person(.4)],100,null,'object');tracker.update([person(.4)],300,null,'object');assert.equal(tracker.visible(400).length,1);assert.equal(tracker.visible(1800).length,0);
});
test('Relative depth is sampled robustly and expires',()=>{
  const frame:DepthFrame={values:new Uint8Array(64).fill(204),width:8,height:8,capturedAt:100};
  assert.ok(Math.abs(depthInBox(frame,[0,0,1,1],200)!-.8)<.001);assert.equal(depthInBox(frame,[0,0,1,1],2700),null);
});
test('A center-overlapping large object remains a path hazard even if its center is left',()=>{
  const tracker=new EnvironmentTracker();const obs:Observation={label:'dining table',score:.9,box:[0,0.3,.68,.6],source:'object'};
  tracker.update([obs],100,null,'object');const tracks=tracker.update([obs],300,null,'object');
  assert.equal(sideFromBox(obs.box),'left');assert.ok(tracks[0].central);assert.equal(assessEnvironment(tracks,100,true).risk,'danger');
});
test('Stairs from scene segmentation get drop priority, with no invented confidence',()=>{
  const tracker=new EnvironmentTracker();const obs:Observation={label:'stairs',score:null,box:[.2,.5,.6,.4],source:'layout'};
  tracker.update([obs],100,null,'layout');const tracks=tracker.update([obs],1500,null,'layout');
  const d=assessEnvironment(tracks,100,true);assert.equal(d.pattern,'drop');assert.equal(d.track?.score,null);assert.equal(d.track?.distanceSource,'unknown');
});
test('No detection is explicitly unknown; a stale camera requests a stop',()=>{
  const d=assessEnvironment([],100,true);assert.match(d.en,/unknown/);assert.equal(d.pattern,'off');
  assert.equal(assessEnvironment([],2200,true).risk,'uncertain');assert.equal(assessEnvironment([],20,false).risk,'uncertain');
});
test('Bad boxes and low scores never enter the environment model',()=>{
  const tracker=new EnvironmentTracker();for(let i=0;i<3;i++)tracker.update([{...person(.4),score:.1},{...person(.3),box:[NaN,0,.1,.1]}],i*100,null,'object');assert.equal(tracker.visible(400).length,0);
});
