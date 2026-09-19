# Third-party components

STRIDE is an educational prototype. The following original components retain their own licenses.

| Component | Source | License / included notice |
| --- | --- | --- |
| Three.js | https://github.com/mrdoob/three.js | MIT, licenses/THREE.txt |
| TensorFlow.js and COCO-SSD | https://github.com/tensorflow/tfjs-models | Apache-2.0, licenses/COCO-SSD.txt |
| Transformers.js | https://github.com/huggingface/transformers.js | Apache-2.0, licenses/TRANSFORMERS.txt |
| ONNX Runtime | https://github.com/microsoft/onnxruntime | MIT, licenses/ONNXRUNTIME.txt |
| SegFormer B0 ADE20K | https://huggingface.co/Xenova/segformer-b0-finetuned-ade-512-512 and https://huggingface.co/nvidia/segformer-b0-finetuned-ade-512-512 | NVIDIA Source Code License for SegFormer; non-commercial research/evaluation, licenses/SEGFORMER.txt |
| Depth Anything V2 Small | https://huggingface.co/onnx-community/depth-anything-v2-small and https://github.com/DepthAnything/Depth-Anything-V2 | Small model Apache-2.0; see licenses/DEPTH-ANYTHING.txt and model card |
| Node.js 22.23.1 Windows x64 runtime | https://nodejs.org/ and https://github.com/nodejs/node | Node and bundled dependencies, licenses/NODE.txt |

Browser test fixtures are downloaded from the official Transformers.js documentation dataset: `https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/cats.jpg` and `house.jpg`. They are development test inputs, not bundled demo camera content. A virtual-camera test is explicitly labeled as such in the verification report; it is not evidence of physical-camera validation.

All model weights are unmodified. Inference settings use a smaller depth input for throughput. Exact resolved source revisions and local file checksums are recorded in `models/*/SOURCE.json` and `models/manifest.json` within the built distribution.
