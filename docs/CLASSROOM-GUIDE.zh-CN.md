# STRIDE · WIS TECH TANK

辅助行走设备的课堂演示原型，包含 **Simulation mode** 和 **Real environment mode**。界面、提醒和说明支持英文 / 中文切换。

## 直接运行

1. 双击 **启动完整演示.cmd**。
2. 浏览器打开 `http://127.0.0.1:4173`。建议使用 Edge / Chrome。
3. 选 **Simulation mode** 演示预设场景；选 **Real environment mode → Start camera** 使用摄像头。
4. 浏览器询问时允许摄像头。摄像头朝向预计行走方向，画面不镜像。
5. 根据电脑性能勾选 **Monocular depth**。关闭它仍可进行多物体识别和环境建模。

项目已包含 Windows x64 Node 运行时、三个模型及浏览器推理组件，不需要安装 npm 或 Python。完整演示由只监听本机的静态服务器提供，没有云端推理服务。摄像头帧不上传、不录制、不写入磁盘；只有点击导出时才保存不含图像的事件 JSON。

**只展示模拟：** 双击 `打开演示.html`，无需服务器或网络。摄像头与模型模式使用完整启动器。复制到其他电脑时请复制整个便携包，不能只复制 HTML。

语音使用浏览器和 Windows 已安装的语音。选择电脑的扬声器 / 耳机输出即可；离线播放建议提前安装英文和中文系统语音。本程序没有连接实物 3V 马达，振动显示为实时波形与电机动画。

## 已实现

| 模块 | 功能 |
| --- | --- |
| 模拟场景 | 平整路、碎石路、桌子、小球、下行楼梯、坑洞、树枝、堵路的墙、传感器失效 |
| 模拟控制 | 开始 / 暂停 / 重置、逐场切换、自动演示、步速、模拟分类置信度、10/45/60 秒路面提示 |
| 实时物体检测 | COCO-SSD 检测多个物体，如人、桌子、椅子、沙发、背包、车辆等 |
| 场景区域 | SegFormer ADE20K 分割候选墙、门、楼梯、扶梯、栏杆等区域，与物体检测同时运行 |
| 环境模型 | 跨帧编号、位置平滑、左 / 正前 / 右、相对远近、超时清除、多个物体共同影响风险 |
| Environment view | 摄像头朝向的二维示意图，以用户为中心；身后及视野外明确为未知 |
| 可选单目深度 | Depth Anything V2 Small，量化模型在 Web Worker 中运行；慢推理不阻塞主物体检测循环 |
| 反馈 | 语音字幕、浏览器语音、不同振动模式、危险优先、重复提醒限频 |
| 演示兜底 | 支持选择自己的图片运行真实模型；此时显著显示“图片测试，非实时” |
| 可解释性 | 环境物体列表、模型状态 / 时延、当前传感器帧、判断记录、JSON 导出 |

## 真实模式的边界

- 默认远近是**图像占比启发式**；开启深度后使用**每帧归一化的相对逆深度**。这些都不是 ToF 测距，**不显示虚构的米数或到达倒计时**。不同大小的物体会使图像占比产生误导；深度归一化也会随画面内容改变。
- 场景分割的墙 / 门 / 楼梯带 `?`，表示候选类别。区域分割没有输出校准的类别置信度，界面不会编造百分比。不能判断门是否能通行、楼梯向上还是向下。
- 未开启深度时，场景区域距离为未知，环境图用虚线方框示意；不把墙的区域面积直接换算成距离。
- 这是**相对于摄像头当前视野的局部模型**，不是全景地图、SLAM、定位或专业三维重建。移动或转动摄像头时，模型随画面更新；离开视野的物体会过期，不永久“记住”在原地。
- 真实模式不会测量地面材质 / 高差，不能可靠识别坑洞、所有悬空树枝、玻璃或所有小障碍。没有检测到物体不代表可以安全前进。
- 实时反馈只提示“停下 / 检查”，不输出“向左走两步就安全”这类未经几何验证的指令。
- 这是课堂概念验证，不能代替真实导航辅助设备。

## 原邮件中需要澄清的点

ToF 是 **Time of Flight（飞行时间）**，不是 Time of Light。以 ST VL53L5CX 为例，官方最高量程约 4 米、8×8 分区；不是 4 英里半径。多区深度提供几何信息，并不自动等同于材质识别。实际量程、光照影响和眼安全等级需查具体器件规格。

墙挡路同样有风险，因此没有“墙永远安全”的规则。正常路面与危险提醒也不能同时持续占用一个马达：危险信号应中断普通路面提示。

官方资料：[ST VL53L5CX](https://www.st.com/en/imaging-and-photonics-solutions/vl53l5cx.html)、[COCO-SSD](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd)、[SegFormer ONNX](https://huggingface.co/Xenova/segformer-b0-finetuned-ade-512-512)、[Depth Anything V2 Small ONNX](https://huggingface.co/onnx-community/depth-anything-v2-small)。

## 演示建议

参见 [演示讲稿.md](演示讲稿.md)。先展示可重复的模拟逻辑，再启动摄像头展示多物体空间理解；深度作为增强项最后打开。实物摄像头、系统扬声器、教室光线和电脑性能需要在实际展示设备上排练。

## 开发

```powershell
npm ci
node scripts/prepare-models.mjs  # 已有模型时复用本地文件与已记录的版本
npm run build                  # TypeScript 检查 + 离线 HTML + worker + 本地模型资源
npm test                       # 14 个核心逻辑测试
node scripts/server.mjs        # localhost:4173，直接服务 dist
npm run dev                    # 开发服务器；请先 build 生成 worker 与 WASM
```

`src/engine.ts` 是模拟传感器与规则引擎；`src/environment.ts` 是多目标跟踪和环境风险判断；`src/perception.ts` 管理摄像头与快循环；`src/perception-worker.ts` 负责场景分割和深度；`src/live-view.ts` 画环境图；`src/outputs.ts` 负责语音。以后接硬件时替换传感器适配层，使用电机驱动器输出 `PATTERNS` 中的节奏，不能直接用 GPIO 驱动马达。

`scripts/browser-check.mjs` 用 Chromium 虚拟摄像头与真实本地模型进行端到端检查，**不会打开实物摄像头**。测试图片来源于 Hugging Face 官方 Transformers.js 文档样例，仅放在开发用 `artifacts` 中。可通过 `STRIDE_CHROME` 指定测试用 Chrome 路径。结果见 `artifacts/browser-check.json`。

## 模型与许可

模型精确来源版本见 `dist/models/*/SOURCE.json`，文件校验值见 `dist/models/manifest.json`。第三方许可证放在 `licenses`。SegFormer 的原模型采用 NVIDIA 的非商业研究 / 评估许可；本包按学校研究演示用途提供，不能将此模型直接当作商业产品组件。其他组件与模型见 [THIRD-PARTY.md](THIRD-PARTY.md)。

---

## English quick start

Double-click **启动完整演示.cmd**, then choose **Simulation mode** or **Real environment mode**. Allow camera access when prompted. The complete Windows portable folder includes the runtime and models; camera frames are processed locally. You can also upload your own image for a clearly labeled static-image test.

The environment view is camera-relative and uses left / ahead / right plus relative proximity. Optional monocular depth improves spatial cues but does not produce calibrated metres. Wall, door and stair regions are tentative; unknown space is never treated as a clear path. Speech uses system voices; haptics are visualized because no physical motor is connected. This is a classroom prototype, not a navigation aid.
