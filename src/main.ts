import './styles.css';
import { Simulation, SCENARIOS, PATTERNS, NAMES, motorOn, type Lang, type PatternId, type Decision } from './engine';
import { WalkingScene } from './scene';
import { AudioOutput } from './outputs';
import { LiveView } from './live-view';
import { objectLabel } from './environment';

const icon = (name: string, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({
  play: '<path d="m8 5 11 7-11 7z"/>', pause: '<path d="M8 5v14M16 5v14"/>', reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  volume: '<path d="m11 5-6 4H2v6h3l6 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>', muted: '<path d="m11 5-6 4H2v6h3l6 4zM16 9l6 6m0-6-6 6"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  sensor: '<circle cx="12" cy="12" r="2"/><path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10M4 4a11 11 0 0 0 0 16M20 4a11 11 0 0 1 0 16"/>',
  terrain: '<path d="m2 17 4-7 4 5 5-10 7 12M3 21h18"/>', camera: '<rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="3"/><path d="m8 6 1-3h6l1 3"/>',
  pulse: '<path d="M2 12h4l3-8 5 16 3-8h5"/>', shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>', check: '<path d="m5 12 4 4L19 6"/>', chevron: '<path d="m9 6 6 6-6 6"/>',
}[name] ?? '<circle cx="12" cy="12" r="7"/>')}</svg>`;
const sim = new Simulation();
const audio = new AudioOutput();
let lang: Lang = 'en';
let mode: 'simulation' | 'real' = 'simulation';
const t = (en: string, zh: string) => lang === 'en' ? en : zh;
const pair = (value: [string, string]) => value[lang === 'en' ? 0 : 1];
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => { const el = document.querySelector<T>(selector); if (!el) throw new Error(`Missing element: ${selector}`); return el; };
type LogItem = { seconds: number; scenario: string; kind: string; en: string; zh: string; distanceM: number | null; etaS: number | null; pattern: PatternId; };
const events: LogItem[] = [];
let tour = false, tourIndex = 0, tourElapsed = 0, tourTotal = 0;
let lastEventKey = '', lastCountdown = 99, outputAge = 0, motorClock = 0, pattern: PatternId = 'off';
let subtitle = { en: 'Your next step, made clearer.', zh: '让下一步，更清楚。' };
let lastPhase = sim.phase, lastRisk = sim.decision.risk;

$('#app').innerHTML = `
<header class="site-header"><a class="brand" href="#" aria-label="STRIDE home"><span class="brand-mark"><i></i><i></i><i></i></span><span>stride<span class="brand-dot">.</span></span></a>
<span class="brand-caption">WIS TECH TANK <span>/</span> <span data-en="PROTOTYPE LAB" data-zh="原型实验室"></span></span>
<nav><button class="text-button" id="about">${icon('info', 16)}<span data-en="How it works" data-zh="工作原理"></span></button><button class="language-button" id="language" aria-label="Switch language">EN <span>/</span> 中文</button></nav></header>
<main>
<section class="intro"><div><div class="eyebrow"><span class="tiny-line"></span><span data-en="ASSISTIVE WALKING, REIMAGINED" data-zh="用感知，为行走提供更多信息"></span></div><h1 data-en="A little awareness. A better next step." data-zh="感知多一点，下一步更从容。"></h1><p data-en="Explore how distance, vision and touch work together to make a path easier to understand." data-zh="看看测距、视觉与触觉如何协作，把前方路况转化为清晰的提醒。"></p></div><div class="prototype-label"><span class="status-dot"></span><span data-en="Interactive prototype" data-zh="交互感知原型"></span><small>BUILD 0.2 / <span id="input-source-label"></span></small></div></section>
<div class="mode-bar" role="group" aria-label="Operating mode"><button id="mode-simulation" class="active" aria-pressed="true">${icon('terrain',16)}<span data-en="Simulation mode" data-zh="模拟模式"></span></button><button id="mode-real" aria-pressed="false">${icon('camera',16)}<span data-en="Real environment mode" data-zh="真实环境模式"></span></button><span data-en="One feedback system. Two ways to sense." data-zh="两种感知方式，共用一套提醒系统。"></span></div>
<div class="lab-toolbar"><div class="lab-title">${icon('sensor')}<strong data-en="Perception studio" data-zh="环境感知工作台"></strong><span class="separator"></span><span class="muted" data-en="Choose a scene. Experience the response." data-zh="选择一个场景，体验设备的反馈。"></span></div><button class="tour-button" id="tour">${icon('play', 15)}<span data-en="Guided demo" data-zh="自动演示"></span></button></div>
<section class="workspace" aria-label="Device simulation">
<aside class="scenario-panel"><div class="section-label"><span data-en="01 / ENVIRONMENT" data-zh="01 / 模拟环境"></span><span>09</span></div><div id="scenarios" class="scenario-list"></div>
<div class="settings"><label for="speed"><span data-en="Walking speed" data-zh="行走速度"></span><output id="speed-value">0.65 m/s</output></label><input id="speed" type="range" min="0" max="1.5" step="0.05" value="0.65"><div class="range-label"><span data-en="Stationary" data-zh="静止"></span><span>1.5 m/s</span></div>
<label for="duration"><span data-en="Terrain feedback" data-zh="路面提示时长"></span><select id="duration"><option value="10">10 s</option><option value="45" selected>45 s</option><option value="60">60 s</option></select></label><label for="confidence"><span data-en="Mock CV confidence" data-zh="模拟分类置信度"></span><output id="confidence-value">96%</output></label><input id="confidence" type="range" min="40" max="99" step="1" value="96"></div></aside>
<div class="simulation-panel"><div class="scene-heading"><div><div class="section-label" data-en="02 / LIVE ENVIRONMENT" data-zh="02 / 环境演示"></div><h2 id="scene-title"></h2></div><span class="badge" id="phase-badge"></span></div>
<div id="world" class="world"><div class="world-top"><span class="world-chip"><span class="status-dot"></span><span data-en="SCHEMATIC 3D VIEW" data-zh="三维示意图"></span></span><button class="view-button" id="view" data-en="Top view ↗" data-zh="俯视视角 ↗"></button></div><div class="world-legend"><span><i class="legend-line"></i><span data-en="4 m sensing envelope" data-zh="4 米模拟感知范围"></span></span><span><i class="legend-box"></i><span data-en="Detected object" data-zh="已探测物体"></span></span></div><div class="scene-caption" id="scene-caption"></div><div class="world-scale">1 m <span></span></div></div>
<div class="metrics"><div><span data-en="OBJECT DISTANCE" data-zh="障碍物距离"></span><strong id="distance">— <small>m</small></strong></div><div><span data-en="TIME TO REACH¹" data-zh="预计到达时间¹"></span><strong id="eta">— <small>s</small></strong></div><div><span data-en="PATH ASSESSMENT" data-zh="路径判断"></span><strong class="risk-value" id="risk"></strong></div></div>
<div class="playback"><button id="start" class="primary-button"></button><button id="reset" class="icon-button" aria-label="Reset simulation" title="Reset">${icon('reset', 18)}</button><div class="progress-wrap"><div class="progress-track"><div id="progress"></div></div><span id="time-label"></span></div><button id="next" class="icon-button" aria-label="Next scene" title="Next scene">${icon('arrow', 18)}</button><button id="fullscreen" class="icon-button" aria-label="Full screen" title="Full screen">${icon('expand', 18)}</button></div>
<div class="scene-footnote" data-en="¹ Distance ÷ walking speed. Movement stops before contact; lateral guidance is illustrative." data-zh="¹ 距离 ÷ 步速。模拟会在接触前停下；绕行方向只表示当前模拟场景。"></div></div>
<aside class="output-panel"><div class="section-label"><span data-en="03 / DEVICE RESPONSE" data-zh="03 / 设备反馈"></span><span class="live-label"><i></i> LIVE</span></div>
<section class="audio-card"><div class="card-heading"><span>${icon('volume', 17)}<strong data-en="Audio guidance" data-zh="语音引导"></strong></span><button id="mute" class="icon-button" aria-label="Mute audio"></button></div><div class="audio-quotes">“</div><p id="subtitle" aria-live="polite"></p><div class="audio-bottom"><span id="audio-status"></span><button id="replay" class="text-button" data-en="Replay ↻" data-zh="重播 ↻"></button></div></section>
<section class="haptic-card"><div class="card-heading"><span>${icon('pulse', 17)}<strong data-en="Haptic feedback" data-zh="振动反馈"></strong></span><span class="micro-label">3V COIN</span></div><div class="motor-row"><div class="motor" id="motor"><span></span><i></i></div><div><strong id="pattern-name"></strong><span id="pattern-code"></span></div><span class="motor-state" id="motor-state">IDLE</span></div><canvas id="waveform" width="600" height="92" aria-label="Vibration on-off waveform"></canvas><div class="waveform-label"><span>0 s</span><span data-en="Motor ON / OFF · 4 seconds" data-zh="电机开 / 关 · 4 秒"></span><span>4 s</span></div><p class="card-note" data-en="Visual motor simulation. A computer cannot drive a physical coin motor." data-zh="此处显示模拟振动。电脑未连接真实振动马达。"></p></section>
<section class="sensor-card"><div class="card-heading"><span>${icon('camera', 17)}<strong data-en="Sensor fusion" data-zh="传感信息融合"></strong></span><span class="micro-label" data-en="SIMULATED" data-zh="模拟数据"></span></div><div class="sensor-content"><div><div id="depth-grid" class="depth-grid" aria-label="Schematic eight by eight depth map"></div><span class="depth-caption">ToF / 8 × 8</span></div><div class="sensor-readings"><div><span data-en="Vision label" data-zh="视觉类别"></span><strong id="cv-label"></strong></div><div><span data-en="Confidence" data-zh="置信度"></span><strong id="cv-confidence"></strong></div><div><span data-en="Ground variation" data-zh="地面高差示意"></span><strong id="roughness"></strong></div></div></div><p class="card-note" data-en="Synthetic depth + scripted object labels. No camera or trained CV model is connected." data-zh="合成深度与预设物体标签；未连接摄像头或训练好的视觉模型。"></p></section></aside>
</section>
<section class="below-lab"><div class="pipeline"><span class="section-label" data-en="THE SIGNAL PATH" data-zh="信号处理流程"></span><div><span>${icon('sensor', 18)}<span data-en="Sense" data-zh="探测"></span></span><b>→</b><span>${icon('camera', 18)}<span data-en="Understand" data-zh="识别"></span></span><b>→</b><span>${icon('shield', 18)}<span data-en="Prioritize" data-zh="判断优先级"></span></span><b>→</b><span>${icon('pulse', 18)}<span data-en="Guide" data-zh="输出提醒"></span></span></div><p data-en="Urgent hazards interrupt terrain feedback. Uncertain readings prompt a stop." data-zh="危险提醒优先于普通路面提示；数据不可靠时提示停下确认。"></p></div><div class="session-summary"><span class="section-label" data-en="DESIGNED FOR A CLASSROOM DEMO" data-zh="为课堂展示而制作"></span><p data-en="Real decision logic. Simulated surroundings." data-zh="实际运行的判断逻辑，模拟生成的周围环境。"></p><span data-en="An exploration of an idea, not a navigation aid for real-world use." data-zh="这是概念演示，不能用于实际行走导航。"></span></div></section>
<details class="event-section" id="event-details"><summary><span>${icon('pulse', 18)}<span data-en="Explore the decision log" data-zh="查看判断记录与原型代码"></span><span class="count" id="event-count">0</span></span><span>+</span></summary><div class="event-body"><div class="log-toolbar"><span data-en="Each warning is produced from the current sensor frame." data-zh="每条提醒都由当前模拟传感器数据产生。"></span><button id="export" class="text-button">${icon('download', 16)}<span data-en="Export session" data-zh="导出记录"></span></button></div><div class="log-grid"><div id="log"></div><div class="code-panel"><div class="micro-label" data-en="CURRENT SENSOR FRAME" data-zh="当前传感器数据"></div><pre id="raw-frame"></pre><div class="micro-label" data-en="DECISION FLOW / PSEUDOCODE" data-zh="判断流程 / 伪代码"></div><pre>if sensor_missing or confidence &lt; 0.65:
    stop_and_warn()
elif obstacle_in_path:
    arrival_time = distance / walking_speed
    interrupt_terrain_feedback()
    speak_warning_and_pulse_motor()
else:
    play_terrain_rhythm(up_to=45_seconds)</pre></div></div></div></details>
<footer><span>STRIDE <span class="footer-slash">/</span> WIS TECH TANK</span><span data-en="A clearer path starts with a better signal." data-zh="更清楚的信号，更从容的下一步。"></span><span>PROTOTYPE 0.2</span></footer>
</main>
<dialog id="about-dialog"><button id="close-about" class="close-dialog" aria-label="Close">×</button><div class="eyebrow">STRIDE / <span data-en="BEHIND THE PROTOTYPE" data-zh="原型工作原理"></span></div><h2 data-en="From a measurement to a meaningful warning." data-zh="从测量数据，到有意义的提醒。"></h2><div class="about-body"></div></dialog><div class="toast" id="toast" role="status"></div>`;

$('#scenarios').innerHTML = SCENARIOS.map((s, i) => `<button class="scenario" data-scenario="${s.id}"><span class="scenario-number">${String(i + 1).padStart(2, '0')}</span><span class="scenario-copy"><strong data-en="${s.title[0]}" data-zh="${s.title[1]}"></strong><small data-en="${s.note[0]}" data-zh="${s.note[1]}"></small></span>${icon('chevron', 14)}</button>`).join('');
$('#depth-grid').innerHTML = Array.from({ length: 64 }, () => '<i></i>').join('');
let scene: WalkingScene | null = null;
try { scene = new WalkingScene($('#world')); scene.select(sim.scenario); } catch { const warning = document.createElement('p'); warning.className = 'webgl-fallback'; warning.textContent = '3D rendering unavailable. Try Edge/Chrome with graphics acceleration. All simulation controls and outputs remain available. / 三维渲染不可用，其他功能仍可使用。'; $('#world').append(warning); }
const depthCells = Array.from(document.querySelectorAll<HTMLElement>('#depth-grid i'));
const wave = $<HTMLCanvasElement>('#waveform');
const waveCtx = wave.getContext('2d')!;
const live = new LiveView();
let liveCandidate = '', liveCandidateSince = 0, lastLiveKey = '', lastLiveSpoken = -Infinity, previousLiveStatus = 'idle';
function setMode(next: 'simulation' | 'real') {
  audio.cancel(); tour = false; sim.pause(); live.perception.stop();
  mode = next; lastLiveKey = ''; liveCandidate = ''; lastLiveSpoken = -Infinity;
  $('.workspace').classList.toggle('real-mode', next === 'real');
  live.element.hidden = next !== 'real'; $('#tour').hidden = next === 'real';
  $('#mode-simulation').classList.toggle('active', next === 'simulation'); $('#mode-real').classList.toggle('active', next === 'real');
  $('#mode-simulation').setAttribute('aria-pressed', String(next === 'simulation')); $('#mode-real').setAttribute('aria-pressed', String(next === 'real'));
  subtitle = next === 'real' ? { en: 'Start the camera to build a live environment model.', zh: '启动摄像头，开始构建实时环境模型。' } : { en: 'Ready when you are. Start the scene to hear the guidance.', zh: '准备就绪，开始场景即可听到语音提醒。' };
  localize();
}
$('#mode-simulation').addEventListener('click', () => setMode('simulation'));
$('#mode-real').addEventListener('click', () => setMode('real'));
function localize() {
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  document.querySelectorAll<HTMLElement>('[data-en]').forEach(el => { el.textContent = el.dataset[lang] ?? el.dataset.en!; });
  $('#language').innerHTML = lang === 'en' ? '<strong>EN</strong> <span>/</span> 中文' : 'EN <span>/</span> <strong>中文</strong>';
  $('#input-source-label').textContent=mode==='real'?t('LOCAL CAMERA MODE','本机摄像头模式'):t('SIMULATED INPUTS','模拟输入');
  if(mode==='simulation')$('.depth-caption').textContent='ToF / 8 × 8';
  $('#about-dialog .about-body').innerHTML = lang === 'en' ? `
    <p><b>1. Sense.</b> A simulated multizone Time-of-Flight sensor measures distances within a 4 m envelope. The colored 8 × 8 panel is a schematic visualization, not a ray-traced depth image.</p>
    <p><b>2. Understand.</b> Predefined object labels stand in for a future camera classifier. Ground geometry and a vision model would need to work together to distinguish surfaces. This version does not run computer vision.</p>
    <p><b>3. Prioritize.</b> Missing data or confidence below 65% prompts a stop. Drops, head-height hazards and blocked paths override ordinary terrain feedback. Estimated arrival = distance ÷ selected walking speed.</p>
    <p><b>4. Guide.</b> Speech uses your browser and installed system voices. Speakers or headphones use your computer’s selected output. The coin motor is visualized below; it is not physically connected.</p>
    <h3>A small vocabulary of touch</h3><div class="pattern-legend">${Object.entries(PATTERNS).filter(([key]) => key !== 'off').map(([key, p]) => `<div><b>${key}</b><span>${p.label[0]}</span><code>${p.code}</code></div>`).join('')}</div>
    <p>Terrain feedback defaults to 45 seconds, with 10 / 45 / 60-second options. These patterns are design proposals, not validated accessibility conventions. User testing is a future step.</p>
    <p><b>What needs hardware?</b> Real depth data, a calibrated camera and classifier, a motor driver, accurate motion sensing, and testing with intended users. A 3 V motor must use a suitable driver and power supply.</p>
    <p class="source-note">ToF means Time of Flight. <a href="https://www.st.com/en/imaging-and-photonics-solutions/vl53l5cx.html" target="_blank" rel="noopener">ST VL53L5CX specifications</a> list up to 4 m and 8 × 8 zones, not a four-mile radius. Range and optical coverage depend on the chosen device.</p>` : `
    <p><b>1. 探测。</b> 模拟多区 ToF（飞行时间）传感器测量 4 米范围内的距离。8 × 8 色块是示意图，不是光学仿真生成的深度图。</p>
    <p><b>2. 识别。</b> 预设物体标签代替未来摄像头分类器的输出。路面材质识别需要结合深度几何与视觉模型；本版没有运行真实计算机视觉。</p>
    <p><b>3. 判断。</b> 数据缺失或分类置信度低于 65% 时提示停下。高差、头部障碍和路径阻挡优先于路面提示。预计到达时间 = 距离 ÷ 所选步速。</p>
    <p><b>4. 提醒。</b> 浏览器调用系统语音，声音经电脑当前选定的扬声器或耳机播放。振动马达用波形与动画展示，尚未连接真实硬件。</p>
    <h3>不同情况，不同触觉信号</h3><div class="pattern-legend">${Object.entries(PATTERNS).filter(([key]) => key !== 'off').map(([key, p]) => `<div><b>${key}</b><span>${p.label[1]}</span><code>${p.code}</code></div>`).join('')}</div>
    <p>路面提示默认 45 秒，可选 10 / 45 / 60 秒。以上模式是设计提案，尚未经目标用户验证，不代表既有无障碍标准。</p>
    <p><b>以后接硬件需要什么？</b> 真实深度数据、校准后的摄像头与分类模型、电机驱动、步速估计，以及目标用户测试。3V 马达需要合适的驱动器与电源。</p>
    <p class="source-note">ToF 是 Time of Flight。<a href="https://www.st.com/en/imaging-and-photonics-solutions/vl53l5cx.html" target="_blank" rel="noopener">ST VL53L5CX 官方规格</a>标注最高约 4 米、8 × 8 分区，不是 4 英里。实际量程和覆盖范围由所选器件决定。</p>`;
  $('#about-dialog .about-body').insertAdjacentHTML('afterbegin',lang==='en'?`<p><b>Two operating modes.</b> The simulation below uses synthetic sensor data. Real environment mode uses local COCO-SSD object detection, SegFormer room segmentation and optional Depth Anything V2 in a worker. It tracks multiple observations, places them in a camera-relative map, and uses the same speech and haptic outputs.</p><p>Real-mode distance is relative depth or an image-size heuristic, never measured metres. Wall/door/stairs labels are tentative semantic regions. It does not infer door passability, stairs direction, safe sidesteps or real ground texture. Out-of-view space stays unknown.</p>`:`<p><b>两种工作模式。</b> 模拟模式使用合成传感器数据；真实环境模式使用本机 COCO-SSD 物体检测、SegFormer 场景分割，以及可选的 Depth Anything V2。系统跟踪多个观测目标，构建相对于摄像头的环境图，共用语音和振动输出。</p><p>真实模式的远近来自相对深度或图像尺寸启发式，不是实测米数。墙、门、楼梯是候选分割区域，不推断门的通行性、楼梯上下方向、安全侧移或真实路面材质。视野以外始终标记为未知。</p>`);
  $('.session-summary>p').textContent=mode==='real'?t('Live models. A changing environment.','真实模型，持续更新的周围环境。'):t('Real decision logic. Simulated surroundings.','实际运行的判断逻辑，模拟生成的周围环境。');
  renderLog(); render(true);
}
function toast(en: string, zh: string) { $('#toast').textContent = t(en, zh); $('#toast').classList.add('show'); window.setTimeout(() => $('#toast').classList.remove('show'), 3500); }
function logEvent(kind: string, en: string, zh: string, decision = sim.decision) { events.unshift({ seconds: mode === 'real' ? +(performance.now()/1000).toFixed(2) : +sim.elapsed.toFixed(2), scenario: mode === 'real' ? `real-${live.perception.source}` : sim.scenario.id, kind, en, zh, distanceM: mode === 'real' ? null : decision.distanceM, etaS: mode === 'real' ? null : decision.etaS, pattern: mode === 'real' ? live.perception.decision.pattern : decision.pattern }); if (events.length > 200) events.pop(); renderLog(); }
function renderLog() {
  $('#event-count').textContent = String(events.length);
  $('#log').innerHTML = events.length ? events.slice(0, 25).map(e => `<div class="log-item"><span>${e.seconds.toFixed(1)}s</span><div><b>${e.scenario} / ${e.kind}</b><p>${e[lang]}</p></div></div>`).join('') : `<p class="empty-log">${t('Start a scene to see how the device makes decisions.', '开始场景后，这里会显示设备的判断记录。')}</p>`;
}
function selectScene(id: string, keepTour = false) {
  if (!keepTour) tour = false;
  audio.cancel(); sim.select(id); scene?.select(sim.scenario); lastPhase = sim.phase;
  lastEventKey = ''; lastCountdown = 99; outputAge = 0; motorClock = 0;
  subtitle = { en: 'Ready when you are. Start the scene to hear the guidance.', zh: '准备就绪，开始场景即可听到语音提醒。' };
  render(true);
}
function shortWarning(d: Decision) {
  if (!d.object || d.risk === 'uncertain') return { en: d.en, zh: d.zh };
  const sideEn = d.direction === 'stop' ? 'Stop and check.' : `Check the ${d.direction} side.`;
  const sideZh = d.direction === 'stop' ? '请停下确认。' : `请检查${d.direction === 'right' ? '右' : '左'}侧空间。`;
  return { en: `${NAMES[d.object][0]}, ${d.distanceM?.toFixed(1)} meters ahead. ${sideEn}`, zh: `前方 ${d.distanceM?.toFixed(1)} 米有${NAMES[d.object][1]}。${sideZh}` };
}
function announce(kind: string, message: { en: string; zh: string }, spoken = message) { subtitle = message; audio.speak(spoken[lang], lang); outputAge = 0; logEvent(kind, message.en, message.zh); }
function begin() {
  sim.start(); lastEventKey = ''; lastCountdown = 99; motorClock = 0; outputAge = 0; lastPhase = 'running';
  const d = sim.decision; lastRisk = d.risk;
  announce('detection', d, shortWarning(d)); lastEventKey = `${d.object}-${d.risk}-${d.direction}`; render(true);
}
function togglePlayback() {
  if (sim.phase === 'running') { sim.pause(); audio.cancel(); tour = false; logEvent('paused', 'Simulation paused. Outputs are idle.', '模拟已暂停，输出停止。'); }
  else begin(); render(true);
}
function updateDecision(dt: number) {
  if (sim.phase === 'ready' || sim.phase === 'paused' || sim.phase === 'complete') return;
  outputAge += dt; motorClock += dt;
  const d = sim.decision;
  const key = `${d.object}-${d.risk}-${d.direction}`;
  if (sim.phase === 'running' && key !== lastEventKey) { announce('priority-change', d, shortWarning(d)); lastEventKey = key; }
  const moving = sim.phase === 'running' && sim.speed > 0;
  if (moving && (d.object === 'stairs' || d.object === 'pothole') && d.etaS !== null) {
    const count = Math.ceil(d.etaS);
    if (count <= 3 && count > 0 && count !== lastCountdown) {
      lastCountdown = count;
      announce('countdown', { en: `${NAMES[d.object][0]}: approximately ${count} seconds away. Prepare to stop.`, zh: `${NAMES[d.object][1]}：预计 ${count} 秒后到达，请准备停下。` }, { en: `${count}. Prepare to stop.`, zh: `${count}，准备停下。` });
    }
  }
  if (sim.phase === 'stopped' && lastPhase !== 'stopped') {
    const finishCountdown=(d.object==='stairs'||d.object==='pothole')&&d.etaS!==null&&d.etaS<=1.05&&lastCountdown>1;
    const msg = d.risk === 'uncertain' ? d : { en: `${finishCountdown?'1. ':''}Stop. ${d.object ? NAMES[d.object][0] : 'Obstacle'} ${d.distanceM?.toFixed(2)} meters ahead. Check your surroundings before continuing.`, zh: `${finishCountdown?'1。':''}请停下。前方 ${d.distanceM?.toFixed(2)} 米有${d.object ? NAMES[d.object][1] : '障碍物'}，请确认周围环境。` };
    announce('stop', msg); lastPhase = 'stopped';
  }
  lastRisk = d.risk;
}
function render(force = false) {
  if (mode === 'real') { renderLive(); return; }
  const d = sim.decision, active = sim.phase === 'running';
  $('#scene-title').textContent = pair(sim.scenario.title);
  const phases = { ready: ['Ready to explore', '准备就绪'], running: ['Simulation running', '模拟运行中'], paused: ['Paused', '已暂停'], stopped: ['Stopped for safety', '已停下确认'], complete: ['Scene complete', '场景完成'] };
  $('#phase-badge').textContent = phases[sim.phase][lang === 'en' ? 0 : 1]; $('#phase-badge').className = `badge ${sim.phase}`;
  $('#scene-caption').textContent = sim.scenario.sensorValid === false ? t('Sensor signal lost · stopping is the response', '传感器信号丢失 · 提示停下') : sim.scenario.object ? `${pair(NAMES[sim.scenario.object])} · ${d.distanceM?.toFixed(1)} m` : t('Ground profile · ', '路面类型 · ') + pair(sim.scenario.terrain === 'smooth' ? ['Smooth', '平整'] : ['Uneven', '不平整']);
  $('#distance').innerHTML = `${d.distanceM === null || !sim.frame.valid ? '—' : d.distanceM.toFixed(2)} <small>m</small>`;
  $('#eta').innerHTML = `${d.etaS === null || sim.phase === 'stopped' ? '—' : d.etaS.toFixed(1)} <small>s</small>`;
  const risks = { clear: ['No obstacle detected', '未检测到障碍'], caution: ['Caution', '注意绕行'], danger: ['High priority', '高优先级危险'], uncertain: ['Stop & check', '停下确认'] };
  $('#risk').textContent = risks[d.risk][lang === 'en' ? 0 : 1]; $('#risk').className = `risk-value ${d.risk}`;
  $('#subtitle').textContent = subtitle[lang];
  $('#start').innerHTML = `${icon(active ? 'pause' : 'play', 16)}<span>${active ? t('Pause', '暂停') : sim.phase === 'paused' ? t('Resume', '继续') : sim.phase === 'stopped' || sim.phase === 'complete' ? t('Run again', '重新演示') : t('Start simulation', '开始模拟')}</span>`;
  $('#start').setAttribute('aria-label', active ? 'Pause simulation' : 'Start simulation');
  $('#tour').innerHTML = `${icon(tour ? 'stop' : 'play', 15)}<span>${tour ? t(`Demo ${tourIndex + 1} / 9 · Stop`, `演示 ${tourIndex + 1} / 9 · 停止`) : t('Guided demo', '自动演示')}</span>`;
  const duration = sim.scenario.object ? Math.max(1, ((sim.scenario.distance ?? 3.6) - 0.65) / (sim.speed || 0.65)) : sim.duration;
  $('#progress').style.width = `${Math.min(100, sim.elapsed / duration * 100)}%`;
  $('#time-label').textContent = `${sim.elapsed.toFixed(1)} s ${sim.scenario.object || sim.scenario.sensorValid === false ? '' : `/ ${sim.duration} s`}`;
  const dangerHold = sim.phase === 'stopped' && outputAge < 5;
  pattern = active || dangerHold ? d.pattern : 'off';
  const motor = motorOn(pattern, motorClock);
  $('#motor').classList.toggle('on', motor); $('#motor-state').textContent = motor ? 'ON' : pattern === 'off' ? 'IDLE' : 'OFF';
  $('#pattern-name').textContent = pair(PATTERNS[pattern].label); $('#pattern-code').textContent = PATTERNS[pattern].code;
  $('#cv-label').textContent = !sim.frame.valid ? t('Unavailable', '不可用') : d.object ? pair(NAMES[d.object]) : t('No object', '无障碍物');
  $('#cv-confidence').textContent = sim.frame.valid && d.object ? `${Math.round(sim.confidence * 100)}%` : '—';
  $('#roughness').textContent = sim.frame.valid ? `${sim.frame.roughnessMm} mm (${t('mock', '模拟')})` : '—';
  const voice = audio.voiceInfo(lang);
  $('#audio-status').textContent = !audio.enabled ? t('Audio muted', '语音已静音') : audio.status === 'unavailable' ? t('Speech unavailable · captions active', '语音不可用 · 请看字幕') : audio.status === 'error' ? t('Voice failed · try a system voice', '语音失败 · 请安装系统语音') : audio.status === 'speaking' ? t('Speaking through system output', '正在通过系统设备播放') : voice.local ? t('System voice · ready', '本地系统语音 · 就绪') : t('Voice depends on browser / OS', '语音取决于浏览器与系统');
  $('#mute').innerHTML = icon(audio.enabled ? 'volume' : 'muted', 17); $('#mute').setAttribute('aria-label', audio.enabled ? 'Mute audio' : 'Enable audio'); $('#mute').setAttribute('aria-pressed', String(!audio.enabled));
  const currentPeriod = PATTERNS[pattern].timings.reduce((a, b) => a + b, 0) / 1000;
  drawWave(pattern, currentPeriod ? motorClock % 4 : 0);
  depthCells.forEach((el, i) => {
    const row = Math.floor(i / 8), col = i % 8;
    const selected = d.object && col >= 2 && col <= 5 && (d.object === 'branch' ? row < 3 : d.object === 'stairs' || d.object === 'pothole' ? row > 4 : row >= 2 && row <= 5);
    el.style.background = !sim.frame.valid ? '#dedfd7' : selected ? `hsl(${d.risk === 'danger' ? 20 : 39}, ${40 + (4 - (d.distanceM ?? 4)) * 10}%, ${63 - (4 - (d.distanceM ?? 4)) * 7}%)` : `hsl(144, ${12 + row * 2}%, ${86 - row * 5 + Math.sin(i * 7) * (sim.scenario.terrain === 'rocky' ? 8 : 1)}%)`;
  });
  if ($<HTMLDetailsElement>('#event-details').open || force) $('#raw-frame').textContent = JSON.stringify({ source: 'SYNTHETIC', ...sim.frame, distanceM: sim.frame.distanceM === null ? null : +sim.frame.distanceM.toFixed(3), speedMps: sim.speed, output: { risk: d.risk, pattern, phase: sim.phase } }, null, 2);
  if (force) document.querySelectorAll<HTMLButtonElement>('[data-scenario]').forEach(el => { const selected = el.dataset.scenario === sim.scenario.id; el.classList.toggle('selected', selected); el.setAttribute('aria-pressed', String(selected)); });
}
function renderLive() {
  const now=performance.now(), info=live.render(now,lang), p=live.perception, d=info.decision;
  if(previousLiveStatus!==p.status){
    audio.cancel(); lastLiveKey=''; liveCandidate=''; lastLiveSpoken=-Infinity;
    previousLiveStatus=p.status;
    if(!p.active)subtitle={en:p.status==='error'?'Perception unavailable. Check the camera status.':'Start the camera or choose an image to begin.',zh:p.status==='error'?'感知不可用，请检查摄像头状态。':'启动摄像头或选择图片开始。'};
  }
  if(d.key!==liveCandidate){liveCandidate=d.key;liveCandidateSince=now;}
  if(p.active&&now-liveCandidateSince>500&&(d.key!==lastLiveKey||now-lastLiveSpoken>10000)){
    subtitle={en:d.en,zh:d.zh};
    if(d.risk!=='clear'){audio.speak(subtitle[lang],lang);lastLiveSpoken=now;logEvent('environment-warning',d.en,d.zh);}
    else if(lastLiveKey!==d.key){audio.cancel();lastLiveSpoken=-Infinity;logEvent('environment-update',d.en,d.zh);}
    lastLiveKey=d.key;
  }
  $('#subtitle').textContent=subtitle[lang];
  pattern=p.active&&now-lastLiveSpoken<3200?d.pattern:'off';
  const on=motorOn(pattern,now/1000);
  $('#motor').classList.toggle('on',on);$('#motor-state').textContent=on?'ON':pattern==='off'?'IDLE':'OFF';
  $('#pattern-name').textContent=pair(PATTERNS[pattern].label);$('#pattern-code').textContent=PATTERNS[pattern].code;drawWave(pattern,(now/1000)%4);
  $('#mute').innerHTML=icon(audio.enabled?'volume':'muted',17);$('#mute').setAttribute('aria-label',audio.enabled?'Mute audio':'Enable audio');$('#mute').setAttribute('aria-pressed',String(!audio.enabled));
  $('#audio-status').textContent=!audio.enabled?t('Audio muted','语音已静音'):audio.status==='error'?t('Voice failed · captions active','语音失败 · 请看字幕'):audio.status==='unavailable'?t('Speech unavailable','语音不可用'):audio.status==='speaking'?t('Speaking through system output','正在通过系统设备播放'):t('System audio · ready','系统音频 · 就绪');
  $('#cv-label').textContent=d.track?objectLabel(d.track.label,lang):t('Environment','周围环境');
  $('#cv-confidence').textContent=d.track?.score?`${Math.round(d.track.score*100)}%`:t('No calibrated score','无校准置信度');
  $('#roughness').textContent=t('Not measured','未测量');
  $('.sensor-card .micro-label').textContent=t('CAMERA / LOCAL','摄像头 / 本机');
  $('.sensor-card .depth-caption').textContent=p.depthEnabled?t('Relative depth','相对深度'):t('Depth off','深度关闭');
  $('.sensor-card .card-note').textContent=t('Real model inference. Relative position only; no ToF, measured distance or ground texture sensor is connected.','真实模型推理；位置是相对估计，未连接 ToF、测距或路面纹理传感器。');
  const fresh=p.depthEnabled&&p.depth&&now-p.depth.capturedAt<2500;
  depthCells.forEach((el,i)=>{const value=fresh?p.depth!.values[Math.floor(i/8)*12*p.depth!.width+(i%8)*16]:0;el.style.background=fresh?`hsl(100,20%,${20+value/255*65}%)`:'#e4e8de';});
  if($<HTMLDetailsElement>('#event-details').open)$('#raw-frame').textContent=JSON.stringify({source:p.source,models:{objects:p.modelStatus,layout:p.layoutStatus,depth:p.depthStatus},ageMs:p.lastFrame?Math.round(info.age):null,metricDistanceAvailable:false,tracks:info.tracks.map(tr=>({id:tr.id,label:tr.label,side:tr.side,range:tr.distanceSource==='unknown'?'unknown':tr.range,distanceSource:tr.distanceSource,source:tr.source})),output:{risk:d.risk,pattern}},null,2);
}
function drawWave(p: PatternId, cursor: number) {
  const ctx = waveCtx; ctx.clearRect(0, 0, 600, 92); ctx.strokeStyle = '#e0e7de'; ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(i * 75, 0); ctx.lineTo(i * 75, 92); ctx.stroke(); }
  ctx.strokeStyle = p === 'danger' || p === 'drop' ? '#b36542' : '#35765c'; ctx.fillStyle = '#35765c15'; ctx.lineWidth = 2.5; ctx.beginPath();
  let lastY = 74;
  for (let x = 0; x <= 600; x++) { const y = motorOn(p, x / 600 * 4) ? 18 : 74; if (x === 0) ctx.moveTo(x, y); else { ctx.lineTo(x, lastY); ctx.lineTo(x, y); } lastY = y; }
  ctx.stroke(); ctx.lineTo(600, 92); ctx.lineTo(0, 92); ctx.closePath(); ctx.fill();
  if (p !== 'off') { ctx.strokeStyle = '#253f33'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cursor / 4 * 600, 4); ctx.lineTo(cursor / 4 * 600, 86); ctx.stroke(); }
}
$('#scenarios').addEventListener('click', e => { const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-scenario]'); if (button) selectScene(button.dataset.scenario!); });
$('#start').addEventListener('click', togglePlayback);
$('#reset').addEventListener('click', () => selectScene(sim.scenario.id));
$('#next').addEventListener('click', () => selectScene(SCENARIOS[(SCENARIOS.indexOf(sim.scenario) + 1) % SCENARIOS.length].id));
$('#language').addEventListener('click', () => { audio.cancel(); lang = lang === 'en' ? 'zh' : 'en'; localize(); });
$('#mute').addEventListener('click', () => { audio.enabled = !audio.enabled; if (!audio.enabled) audio.cancel(); render(); });
$('#replay').addEventListener('click', () => { if (!audio.enabled) { audio.enabled = true; } audio.speak(subtitle[lang], lang); });
$('#speed').addEventListener('input', e => { sim.speed = +(e.target as HTMLInputElement).value; $('#speed-value').textContent = `${sim.speed.toFixed(2)} m/s`; lastCountdown = 99; render(); });
$('#duration').addEventListener('change', e => { sim.duration = +(e.target as HTMLSelectElement).value; });
$('#confidence').addEventListener('input', e => { sim.confidence = +(e.target as HTMLInputElement).value / 100; $('#confidence-value').textContent = `${Math.round(sim.confidence * 100)}%`; render(); });
$('#view').addEventListener('click', () => { scene?.setView(scene.view === 'orbit' ? 'top' : 'orbit'); $('#view').textContent = scene?.view === 'top' ? t('Perspective ↗', '透视视角 ↗') : t('Top view ↗', '俯视视角 ↗'); });
$('#fullscreen').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { toast('Use F11 for full screen in your browser.', '可按 F11 进入浏览器全屏。'); } });
$('#tour').addEventListener('click', () => { if (tour) { tour = false; sim.pause(); audio.cancel(); render(); return; } tour = true; tourIndex = 0; tourElapsed = 0; tourTotal = 0; selectScene(SCENARIOS[0].id, true); begin(); });
$('#about').addEventListener('click', () => { if (sim.phase === 'running') { sim.pause(); tour = false; audio.cancel(); } $<HTMLDialogElement>('#about-dialog').showModal(); render(); });
$('#close-about').addEventListener('click', () => $<HTMLDialogElement>('#about-dialog').close());
$('#about-dialog').addEventListener('click', e => { if (e.target === $('#about-dialog')) $<HTMLDialogElement>('#about-dialog').close(); });
$('#event-details').addEventListener('toggle', () => render(true));
$('#export').addEventListener('click', () => { const data = { prototype: 'STRIDE 0.2', generatedAt: new Date().toISOString(), inputSource: mode === 'real' ? live.perception.source : 'synthetic', metricDistanceAvailable: mode === 'simulation', configuration: { speedMps: sim.speed, terrainFeedbackSeconds: sim.duration, mockConfidence: sim.confidence }, environment: mode === 'real' ? live.perception.tracker.visible(performance.now()) : null, events: [...events].reverse() }; const link = document.createElement('a'); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); link.href = url; link.download = `stride-session-${Date.now()}.json`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Session log exported.', '演示记录已导出。'); });
document.addEventListener('keydown', e => { if (mode==='simulation' && e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLButtonElement) && !$<HTMLDialogElement>('#about-dialog').open) { e.preventDefault(); togglePlayback(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) { sim.pause(); live.perception.stop(); tour = false; audio.cancel(); render(); } });
window.addEventListener('pagehide', () => {audio.cancel();live.perception.stop();});
let previousTime = performance.now(), lastRender = 0;
function loop(now: number) {
  const dt = Math.min((now - previousTime) / 1000, 0.1); previousTime = now;
  if(mode==='real'){if(now-lastRender>90){renderLive();lastRender=now;}requestAnimationFrame(loop);return;}
  const before = sim.phase; sim.tick(dt); updateDecision(dt);
  if (before === 'running' && sim.phase === 'complete') { announce('complete', { en: 'Terrain feedback complete. Choose another scene to continue.', zh: '路面提示演示完成，可以选择下一个场景。' }); }
  if (tour) { tourElapsed += dt; tourTotal += dt; if (tourElapsed >= 8.5) { tourIndex++; tourElapsed = 0; if (tourIndex >= SCENARIOS.length) { tour = false; audio.cancel(); toast('Guided demo complete. Explore any scene on your own.', '自动演示完成，可以自由选择场景。'); } else { selectScene(SCENARIOS[tourIndex].id, true); begin(); } } }
  scene?.update(sim.frame, sim.elapsed, sim.phase === 'running', sim.decision.risk);
  if (now - lastRender > 90) { render(); lastRender = now; }
  requestAnimationFrame(loop);
}
localize(); requestAnimationFrame(loop);
