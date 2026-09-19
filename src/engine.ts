/** Pure decision engine. SensorFrame is the future hardware adapter boundary.
 * Demo readings are synthetic; the decision engine never accesses camera hardware.
 */
export type Lang = 'en' | 'zh';
export type Terrain = 'smooth' | 'rocky';
export type ObjectKind = 'table' | 'ball' | 'stairs' | 'pothole' | 'branch' | 'wall' | 'unknown';
export type Risk = 'clear' | 'caution' | 'danger' | 'uncertain';
export type PatternId = 'off' | 'smooth' | 'rocky' | 'obstacle' | 'drop' | 'danger' | 'uncertain';
export type Phase = 'ready' | 'running' | 'paused' | 'stopped' | 'complete';
export interface Scenario { id: string; title: [string, string]; note: [string, string]; terrain: Terrain; object?: ObjectKind; distance?: number; confidence?: number; leftClear?: boolean; rightClear?: boolean; sensorValid?: boolean; }
export interface SensorFrame { valid: boolean; ageMs: number; terrain: Terrain; roughnessMm: number; object: ObjectKind | null; distanceM: number | null; confidence: number; inPath: boolean; leftClear: boolean; rightClear: boolean; }
export interface Decision { risk: Risk; pattern: PatternId; object: ObjectKind | null; distanceM: number | null; etaS: number | null; direction: 'left' | 'right' | 'stop' | null; en: string; zh: string; mustStop: boolean; }
export const SCENARIOS: Scenario[] = [
  { id: 'smooth', title: ['Smooth pavement', '平整路面'], note: ['A gentle, steady rhythm', '轻柔、均匀的振动节奏'], terrain: 'smooth' },
  { id: 'rocky', title: ['Uneven ground', '碎石路面'], note: ['Feel the change underfoot', '用成组短脉冲提示路面变化'], terrain: 'rocky' },
  { id: 'table', title: ['Table in the path', '前方桌子'], note: ['Detect, identify, find clearance', '测距、分类、检查两侧空间'], terrain: 'smooth', object: 'table', distance: 3.6, leftClear: false, rightClear: true },
  { id: 'ball', title: ['Small obstacle', '地面小球'], note: ['Low objects still matter', '低矮物体也会造成绊倒风险'], terrain: 'smooth', object: 'ball', distance: 3.4, leftClear: true, rightClear: false },
  { id: 'stairs', title: ['Downward stairs', '下行楼梯'], note: ['Distance becomes a countdown', '根据距离与步速估算到达时间'], terrain: 'smooth', object: 'stairs', distance: 3.8, leftClear: false, rightClear: false },
  { id: 'pothole', title: ['Pothole ahead', '前方坑洞'], note: ['A drop needs a distinct signal', '高差危险使用专属振动模式'], terrain: 'rocky', object: 'pothole', distance: 3.5, leftClear: true, rightClear: true },
  { id: 'branch', title: ['Overhanging branch', '低垂树枝'], note: ['Protect the head-height zone', '识别头部高度的障碍物'], terrain: 'smooth', object: 'branch', distance: 3.6, leftClear: true, rightClear: false },
  { id: 'wall', title: ['Blocked route', '路径被墙阻挡'], note: ['No clear way? Ask the user to stop', '两侧均不明确时提示停下'], terrain: 'smooth', object: 'wall', distance: 3.6, leftClear: false, rightClear: false },
  { id: 'uncertain', title: ['Sensor uncertainty', '传感器失效'], note: ['Missing data is never a clear path', '没有数据不能等同于道路安全'], terrain: 'smooth', sensorValid: false },
];
export const PATTERNS: Record<PatternId, { timings: number[]; label: [string, string]; code: string }> = {
  off: { timings: [], label: ['Motor idle', '振动关闭'], code: 'OFF' },
  smooth: { timings: [140, 860], label: ['Steady rhythm', '均匀节奏'], code: '140 / 860 ms' },
  rocky: { timings: [100, 120, 100, 120, 100, 560], label: ['Triple short pulses', '三连短脉冲'], code: '100 · 100 · 100 ms' },
  obstacle: { timings: [220, 180, 220, 680], label: ['Double tap', '双脉冲'], code: '220 · 220 ms' },
  drop: { timings: [550, 180, 120, 180, 120, 500], label: ['Long + two short', '一长两短'], code: '550 · 120 · 120 ms' },
  danger: { timings: [120, 90, 120, 90, 120, 90, 120, 250], label: ['Rapid urgent pulses', '快速紧急脉冲'], code: '120 ms × 4' },
  uncertain: { timings: [600, 400, 600, 1000], label: ['Two long pulses', '双长脉冲'], code: '600 · 600 ms' },
};
export const NAMES: Record<ObjectKind, [string, string]> = { table: ['Table', '桌子'], ball: ['Ball', '小球'], stairs: ['Downward stairs', '下行楼梯'], pothole: ['Pothole', '坑洞'], branch: ['Head-height branch', '头部高度树枝'], wall: ['Wall', '墙'], unknown: ['Unidentified obstacle', '未知障碍物'] };
export const RANGE_M = 4;
export const STOP_DISTANCE_M = 0.65;
export function mockFrame(scenario: Scenario, traveledM: number, confidence = scenario.confidence ?? 0.96): SensorFrame {
  const d = scenario.object ? Math.max(0, (scenario.distance ?? 3.6) - traveledM) : null;
  const inRange = d !== null && d <= RANGE_M;
  return { valid: scenario.sensorValid !== false, ageMs: 20, terrain: scenario.terrain, roughnessMm: scenario.terrain === 'rocky' ? 48 : 3,
    object: inRange ? scenario.object! : null, distanceM: inRange ? d : null, confidence,
    inPath: inRange, leftClear: scenario.leftClear ?? true, rightClear: scenario.rightClear ?? true };
}
export function decide(frame: SensorFrame, speedMps: number): Decision {
  const base = { object: frame.object, distanceM: frame.distanceM, etaS: null, direction: null };
  if (!frame.valid || !Number.isFinite(frame.ageMs) || frame.ageMs > 500 || (frame.object && (frame.distanceM === null || !Number.isFinite(frame.distanceM) || frame.distanceM < 0))) {
    return { ...base, risk: 'uncertain', pattern: 'uncertain', en: 'Sensor data unavailable. Stop and check your surroundings.', zh: '传感器数据不可用。请停下并确认周围环境。', mustStop: true };
  }
  if (!frame.object || !frame.inPath || frame.distanceM === null || frame.distanceM > RANGE_M) {
    return { ...base, object: null, distanceM: null, risk: 'clear', pattern: frame.terrain, en: frame.terrain === 'rocky' ? 'Uneven ground. Slow down and take care.' : 'Smooth ground detected. Steady rhythm.', zh: frame.terrain === 'rocky' ? '前方路面不平，请减速慢行。' : '检测到平整路面，均匀振动提示。', mustStop: false };
  }
  const d = frame.distanceM;
  const eta = Number.isFinite(speedMps) && speedMps > 0 ? d / speedMps : null;
  if (!Number.isFinite(frame.confidence) || frame.confidence < 0.65 || frame.object === 'unknown') {
    return { ...base, etaS: eta, risk: 'uncertain', pattern: 'uncertain', direction: 'stop', en: `Unidentified obstacle at ${d.toFixed(1)} meters. Stop and check.`, zh: `${d.toFixed(1)} 米处有未知障碍物，请停下确认。`, mustStop: true };
  }
  const drop = frame.object === 'stairs' || frame.object === 'pothole';
  const danger = drop || frame.object === 'branch' || frame.object === 'wall';
  const direction = frame.object === 'stairs' ? 'stop' : frame.rightClear ? 'right' : frame.leftClear ? 'left' : 'stop';
  const mustStop = d <= STOP_DISTANCE_M || direction === 'stop' && !drop;
  const [name, nameZh] = NAMES[frame.object];
  const etaText = drop && eta !== null ? ` Estimated arrival in ${Math.ceil(eta)} seconds.` : '';
  const etaZh = drop && eta !== null ? `预计 ${Math.ceil(eta)} 秒后到达。` : '';
  const guidanceEn = d <= STOP_DISTANCE_M ? 'Stop now. Obstacle close.' : direction === 'stop' ? 'Stop before the obstacle.' : `${direction === 'right' ? 'Right' : 'Left'} side appears clear in this simulation. Stop, check, then move ${direction}.`;
  const guidanceZh = d <= STOP_DISTANCE_M ? '障碍物已接近，请立即停下。' : direction === 'stop' ? '请在障碍物前停下。' : `模拟环境${direction === 'right' ? '右' : '左'}侧有空间，请先停下确认再向${direction === 'right' ? '右' : '左'}绕行。`;
  return { object: frame.object, distanceM: d, etaS: eta, risk: danger ? 'danger' : 'caution', pattern: drop ? 'drop' : danger ? 'danger' : 'obstacle', direction,
    en: `${name} ahead, ${d.toFixed(1)} meters.${etaText} ${guidanceEn}`, zh: `前方 ${d.toFixed(1)} 米有${nameZh}。${etaZh}${guidanceZh}`, mustStop };
}
export function motorOn(pattern: PatternId, timeS: number): boolean {
  const ticks = PATTERNS[pattern].timings;
  if (!ticks.length) return false;
  let position = ((timeS * 1000) % ticks.reduce((a, b) => a + b, 0));
  for (let i = 0; i < ticks.length; i++) { if (position < ticks[i]) return i % 2 === 0; position -= ticks[i]; }
  return false;
}
export class Simulation {
  scenario = SCENARIOS[0]; phase: Phase = 'ready'; elapsed = 0; traveled = 0; speed = 0.65; duration = 45; confidence = 0.96;
  get frame() { return mockFrame(this.scenario, this.traveled, this.confidence); }
  get decision() { return decide(this.frame, this.speed); }
  select(id: string) { this.scenario = SCENARIOS.find(s => s.id === id) ?? SCENARIOS[0]; this.reset(); }
  reset() { this.phase = 'ready'; this.elapsed = 0; this.traveled = 0; }
  start() { if (this.phase === 'stopped' || this.phase === 'complete') this.reset(); this.phase = 'running'; }
  pause() { if (this.phase === 'running') this.phase = 'paused'; }
  tick(dt: number) {
    if (this.phase !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
    const step = Math.min(dt, 0.1);
    if (this.decision.mustStop) { this.phase = 'stopped'; return; }
    this.elapsed += step;
    if (this.scenario.object) this.traveled = Math.min(this.traveled + this.speed * step, (this.scenario.distance ?? 3.6) - STOP_DISTANCE_M);
    else this.traveled += this.speed * step;
    if (this.decision.mustStop || (this.scenario.object && (this.frame.distanceM ?? 4) <= STOP_DISTANCE_M + 1e-6)) this.phase = 'stopped';
    if (!this.scenario.object && this.elapsed >= this.duration) this.phase = 'complete';
  }
}
