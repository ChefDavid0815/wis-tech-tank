import * as THREE from 'three';
import { type SensorFrame, type Scenario, type Risk } from './engine';

/** A schematic 3D world, not a physical optics or camera simulator. */
export class WalkingScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-6, 6, 5, -5, 0.1, 100);
  world = new THREE.Group(); obstacle = new THREE.Group(); stones = new THREE.Group();
  avatar = new THREE.Group(); scan = new THREE.Group(); marker = new THREE.Group();
  rings: THREE.Line[] = []; materials = new Map<string, THREE.MeshStandardMaterial>();
  observer: ResizeObserver; container: HTMLElement; view: 'orbit' | 'top' = 'orbit';
  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor('#e8eee8');
    this.renderer.domElement.setAttribute('aria-label', 'Schematic three-dimensional walking environment');
    container.prepend(this.renderer.domElement);
    this.scene.add(this.world);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#a4b49d', 2.8));
    const sun = new THREE.DirectionalLight('#fffaf0', 3.2);
    sun.position.set(-3, 12, 7); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -9; sun.shadow.camera.right = 9; sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
    sun.shadow.normalBias = 0.03; this.scene.add(sun);
    this.box(this.world, [18, 0.2, 22], [0, -0.3, -1], '#d8e1d4');
    this.box(this.world, [3.8, 0.22, 18], [0, -0.07, -1], '#f7f6ed');
    for (let z = -9; z <= 7; z += 1) {
      this.box(this.world, [3.8, 0.005, 0.018], [0, 0.05, z], '#dfdfd2');
      this.box(this.world, [0.04, 0.01, 0.36], [0, 0.065, z + 0.5], '#acb9a9');
    }
    for (const x of [-2.05, 2.05]) this.box(this.world, [0.14, 0.17, 18], [x, 0, -1], '#bdcbb9');
    for (let i = 0; i < 7; i++) { this.tree(i % 2 ? -3.5 : 3.5, -7 + i * 2.2, 0.9 + (i % 3) * 0.15); }
    this.box(this.world, [1.1, 0.3, 0.52], [-3.1, 0.45, 1.1], '#a4b29b');
    this.box(this.world, [1.1, 0.48, 0.12], [-3.1, 0.8, 1.34], '#a4b29b');
    this.scene.add(this.stones, this.obstacle, this.avatar, this.scan, this.marker);
    this.avatar.position.set(0, 0, 2.5);
    this.cylinder(this.avatar, 0.18, 0.21, 0.55, [0, 0.98, 0], '#2a6252');
    this.sphere(this.avatar, 0.17, [0, 1.44, 0], '#e5c9a8');
    this.box(this.avatar, [0.12, 0.5, 0.13], [-0.1, 0.42, 0], '#304f46');
    this.box(this.avatar, [0.12, 0.5, 0.13], [0.1, 0.42, -0.05], '#304f46');
    this.box(this.avatar, [0.23, 0.26, 0.13], [0, 1.01, -0.2], '#f1f3d5');
    this.sphere(this.avatar, 0.04, [0, 1.04, -0.27], '#224b42');
    this.box(this.avatar, [0.075, 0.065, 0.035], [0, 0.94, -0.28], '#e6b971');
    const cane = this.cylinder(this.avatar, 0.018, 0.018, 1.15, [0.32, 0.56, -0.25], '#f9faf0'); cane.rotation.x = -0.38;
    const disc = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.37, 48), new THREE.MeshBasicMaterial({ color: '#2d7d61', side: THREE.DoubleSide })); disc.rotation.x = -Math.PI / 2; disc.position.set(0, 0.072, 2.5); this.scene.add(disc);
    const points = [new THREE.Vector3(0, 0.075, 2.5)];
    for (let i = 0; i <= 48; i++) { const a = -0.56 + i / 48 * 1.12; points.push(new THREE.Vector3(Math.sin(a) * 4, 0.075, 2.5 - Math.cos(a) * 4)); }
    const shape = new THREE.Shape(points.map(p => new THREE.Vector2(p.x, -p.z)));
    const fan = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: '#498c6d', transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false }));
    fan.rotation.x = -Math.PI / 2; fan.position.y = 0.08; this.scan.add(fan);
    for (let r = 1; r <= 4; r++) {
      const vertices = [];
      for (let i = 0; i <= 60; i++) { const a = -0.56 + i / 60 * 1.12; vertices.push(new THREE.Vector3(Math.sin(a) * r, 0.09, 2.5 - Math.cos(a) * r)); }
      const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(vertices), new THREE.LineBasicMaterial({ color: '#4c8d6e', transparent: true, opacity: 0.25 })); this.scan.add(ring); this.rings.push(ring);
    }
    for (const a of [-0.56, 0.56]) { const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.09, 2.5), new THREE.Vector3(Math.sin(a) * 4, 0.09, 2.5 - Math.cos(a) * 4)]), new THREE.LineBasicMaterial({ color: '#6a9b80', transparent: true, opacity: 0.4 })); this.scan.add(line); }
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(container); this.resize();
  }
  material(color: string) { if (!this.materials.has(color)) this.materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.9 })); return this.materials.get(color)!; }
  mesh(parent: THREE.Group, geometry: THREE.BufferGeometry, at: number[], color: string) { const mesh = new THREE.Mesh(geometry, this.material(color)); mesh.position.set(at[0], at[1], at[2]); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; }
  box(parent: THREE.Group, size: number[], at: number[], color: string) { return this.mesh(parent, new THREE.BoxGeometry(size[0], size[1], size[2]), at, color); }
  sphere(parent: THREE.Group, radius: number, at: number[], color: string) { return this.mesh(parent, new THREE.IcosahedronGeometry(radius, 1), at, color); }
  cylinder(parent: THREE.Group, r1: number, r2: number, h: number, at: number[], color: string) { return this.mesh(parent, new THREE.CylinderGeometry(r1, r2, h, 12), at, color); }
  tree(x: number, z: number, scale: number) { const tree = new THREE.Group(); tree.position.set(x, 0, z); tree.scale.setScalar(scale); this.cylinder(tree, 0.09, 0.14, 1.6, [0, 0.8, 0], '#a6ac8e'); this.sphere(tree, 0.88, [0, 2.1, 0], '#8ca581'); this.sphere(tree, 0.63, [0.42, 1.9, 0.15], '#9fb591'); this.world.add(tree); }
  clear(group: THREE.Group) { group.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose(); if (o instanceof THREE.LineSegments) (o.material as THREE.Material).dispose(); }); group.clear(); }
  select(s: Scenario) {
    this.clear(this.obstacle); this.clear(this.stones); this.clear(this.marker);
    if (s.terrain === 'rocky') for (let i = 0; i < 95; i++) { const x = Math.sin(i * 78.2) * 1.7; const z = Math.cos(i * 39.7) * 6 - 1; const stone = this.sphere(this.stones, 0.045 + (i % 5) * 0.02, [x, 0.08, z], ['#b7b5a3', '#abae9b', '#c4c1ac'][i % 3]); stone.scale.y = 0.55; }
    const accent = '#c77a56';
    if (s.object === 'table') { this.box(this.obstacle, [1.05, 0.1, 0.65], [0, 0.84, 0], accent); for (const x of [-0.42, 0.42]) for (const z of [-0.24, 0.24]) this.box(this.obstacle, [0.08, 0.8, 0.08], [x, 0.4, z], '#9a6349'); }
    if (s.object === 'ball') { this.sphere(this.obstacle, 0.23, [0, 0.29, 0], '#dda856'); const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.231, 0.012, 6, 24), this.material('#f5edd6')); stripe.position.y = 0.29; stripe.rotation.x = Math.PI / 2; this.obstacle.add(stripe); }
    if (s.object === 'wall') { this.box(this.obstacle, [3.5, 1.9, 0.25], [0, 0.97, 0], '#c6ab8e'); for (let y = 0.25; y < 1.9; y += 0.28) this.box(this.obstacle, [3.5, 0.015, 0.26], [0, y, 0], '#b3997e'); }
    if (s.object === 'branch') { this.cylinder(this.obstacle, 0.12, 0.16, 2.3, [1.45, 1.15, -0.15], '#87785c'); const branch = this.cylinder(this.obstacle, 0.07, 0.1, 1.9, [0.55, 1.56, 0], '#87785c'); branch.rotation.z = 1.4; for (let i = 0; i < 4; i++) this.sphere(this.obstacle, 0.27, [0.1 + i * 0.35, 1.75 + Math.sin(i) * 0.15, -0.06], '#769573'); }
    if (s.object === 'pothole') { this.cylinder(this.obstacle, 0.64, 0.64, 0.015, [0, 0.06, 0], '#626c62'); this.cylinder(this.obstacle, 0.48, 0.48, 0.017, [0, 0.065, 0], '#414f46'); }
    if (s.object === 'stairs') { for (let i = 0; i < 5; i++) { this.box(this.obstacle, [3.4, 0.09, 0.3], [0, 0.07 + (4 - i) * 0.025, -i * 0.3], ['#6f847a', '#809289', '#91a39a', '#a4b5ab', '#b4c3b8'][4 - i]); this.box(this.obstacle, [3.4, 0.01, 0.025], [0, 0.12 + (4 - i) * 0.025, -i * 0.3 + 0.14], '#e6c586'); } }
    if (s.object) {
      const height = s.object === 'branch' ? 2 : s.object === 'wall' ? 2.1 : s.object === 'table' ? 1 : 0.5;
      const width = s.object === 'wall' || s.object === 'stairs' ? 3.5 : s.object === 'branch' ? 2 : 1.4;
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, 0.95)), new THREE.LineBasicMaterial({ color: '#bd7951', transparent: true, opacity: 0.75 })); edge.position.set(0, height / 2 + 0.06, 0); this.marker.add(edge);
    }
  }
  resize() { const width = this.container.clientWidth; const height = this.container.clientHeight; if (!width || !height) return; this.renderer.setSize(width, height); const aspect = width / height; this.camera.left = -4.8 * aspect; this.camera.right = 4.8 * aspect; this.camera.top = 4.8; this.camera.bottom = -4.8; this.camera.updateProjectionMatrix(); this.setView(this.view); }
  setView(view: 'orbit' | 'top') { this.view = view; this.camera.position.set(...(view === 'top' ? [0, 14, 2] : [7, 8, 9]) as [number, number, number]); this.camera.lookAt(0, 0.2, -0.3); }
  update(frame: SensorFrame, elapsed: number, active: boolean, risk: Risk) {
    const z = 2.5 - (frame.distanceM ?? 3.6); this.obstacle.position.z = z; this.marker.position.z = z;
    this.scan.visible = frame.valid;
    for (let i = 0; i < this.rings.length; i++) (this.rings[i].material as THREE.LineBasicMaterial).opacity = active ? 0.12 + 0.3 * (0.5 + Math.sin(elapsed * 4 - i) * 0.5) : 0.18;
    this.avatar.position.y = active ? Math.sin(elapsed * 8) * 0.02 : 0;
    this.marker.visible = frame.valid && frame.object !== null;
    this.marker.children.forEach(m => { if (m instanceof THREE.LineSegments) (m.material as THREE.LineBasicMaterial).color.set(risk === 'danger' ? '#b95b40' : '#b38b43'); });
    this.renderer.render(this.scene, this.camera);
  }
}
