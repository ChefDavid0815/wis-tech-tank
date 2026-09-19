import { mkdir, writeFile, stat, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
const root = 'public/models';
async function download(url, destination) {
  try { if ((await stat(destination)).size > 50) { console.log('Cached:', destination); return; } } catch {}
  console.log('Downloading:', destination);
  const response = await fetch(url, { signal: AbortSignal.timeout(240000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  const data = Buffer.from(await response.arrayBuffer());
  await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, data);
  console.log('Saved:', destination, `${(data.length / 1048576).toFixed(1)} MB`);
}
const base = 'https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/';
await download(base + 'model.json', `${root}/coco/model.json`);
const graph = JSON.parse(await readFile(`${root}/coco/model.json`, 'utf8'));
for (const group of graph.weightsManifest) for (const path of group.paths) await download(base + path, `${root}/coco/${path}`);
const models = [
  ['layout', 'Xenova/segformer-b0-finetuned-ade-512-512'],
  ['depth', 'onnx-community/depth-anything-v2-small'],
];
for (const [name, repo] of models) {
  // Pin the Hub revision resolved on preparation, and record it in the manifest.
  let revision;
  try { revision = JSON.parse(await readFile(`${root}/${name}/SOURCE.json`, 'utf8')).revision; } catch {}
  if (!revision) revision = (await (await fetch(`https://huggingface.co/api/models/${repo}`)).json()).sha;
  for (const file of ['config.json', 'preprocessor_config.json', 'onnx/model_quantized.onnx']) await download(`https://huggingface.co/${repo}/resolve/${revision}/${file}`, `${root}/${name}/${file}`);
  await writeFile(`${root}/${name}/SOURCE.json`, JSON.stringify({ repository: repo, revision, url: `https://huggingface.co/${repo}` }, null, 2));
}
const files = [];
for (const file of ['coco/model.json', ...graph.weightsManifest.flatMap(g => g.paths.map(p => `coco/${p}`)), 'layout/onnx/model_quantized.onnx', 'depth/onnx/model_quantized.onnx']) {
  const data = await readFile(`${root}/${file}`); files.push({ file, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}
await writeFile(`${root}/manifest.json`, JSON.stringify({ preparedAt: new Date().toISOString(), files }, null, 2));
console.log('All model files prepared locally. Camera frames never need to be uploaded.');
