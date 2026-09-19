<p align="center">WIS TECH TANK &nbsp; / &nbsp; 校园观察手记 &nbsp; / &nbsp; 0.2.0</p>

<h1 align="center">STRIDE．</h1>
<p align="center"><i>感知多一点，下一步更从容。</i></p>

<a href="https://chefzc-wis-tech-tank.vercel.app"><img src="docs/assets/woodland.webp" width="100%" alt="清晨光线穿过森林，一条浅色步道延伸进绿意之中，STRIDE 展柜原创视觉" /></a>

<p align="center"><a href="README.md">English</a> · <b>简体中文</b></p>
<p align="center"><a href="https://chefzc-wis-tech-tank.vercel.app"><b>打开实验室 ↗</b></a> &nbsp; / &nbsp; <a href="https://chefzc-homepage.vercel.app/school-gallery.html">校园展柜</a> &nbsp; / &nbsp; <a href="https://chefzc-homepage.vercel.app/post.html?article=wis-tech-tank">读观察手记</a></p>

## 01 / 把环境，变成能理解的信息

**STRIDE** 是为 **WIS TECH TANK 学校展示**制作的环境感知与辅助行走概念原型。挑一个场景，让虚拟人物迈步，再看距离、风险、语音和振动节奏如何一起变化。森林绿、鼠尾草色与温暖的纸白，让重要的信息慢慢浮出来。

主要的模拟体验**不需要摄像头，也不需要登录**。中英文切换同时覆盖界面与提示，计算在浏览器里完成。

| 可以探索什么 | 会发生什么 |
| :--- | :--- |
| **九种环境** | 平整路面、碎石、桌子、小球、下行楼梯、坑洞、树枝、被阻挡的路径与传感器失效。 |
| **可以调整的小世界** | 行走速度、模拟分类置信度、10 / 45 / 60 秒路面反馈与两种观察视角。支持开始、暂停、重置和自动演示。 |
| **看得见的反馈** | 语音字幕、可选浏览器语音、马达脉冲动画、振动开关波形与示意性的 8 × 8 传感器格子。 |
| **讲得清的判断** | 危险优先级、接触前停止、不确定数据处理、可展开的事件记录与 JSON 导出。 |

<img src="docs/assets/simulation.png" width="100%" alt="STRIDE 真实中文界面：下行楼梯模拟、三维环境与设备反馈面板" />
<p align="center"><sub>观察图版 01 / 真实应用截图；场景与传感器读数均为模拟。</sub></p>

## 02 / 再打开一扇观察环境的窗

可选的**真实环境模式**使用摄像头或手动上传的图片。COCO-SSD 检测物体，SegFormer 提供结构候选区域，Depth Anything V2 可补充相对远近信息。摄像头朝向的二维局部视图显示观察结果和未知区域，物体保留跨帧 ID，丢失后会过期。静态上传会明确标注为非实时。

模型从本站加载，推理在本地运行。摄像头画面不上传、不录制、不保存；手动导出的事件记录不含图片。只有主动启动摄像头时才会请求权限，模拟模式不需要权限。首次加载模型的数据量较大，建议使用现代桌面浏览器并等待加载完成。

**这是课堂概念原型，不能当作现实中的导航设备。** 模拟模式的米数来自预设场景。真实模式只显示未标定的相对接近程度，不冒充 ToF 测距或真实米数；局部视图也不是 SLAM 或全景重建。没有检测到物体，不代表道路安全。未连接实体马达或传感器。展示前请阅读[验证边界](VERIFICATION.md)。

## 03 / 在自己的电脑上打开

建议使用 **Node.js 22.23.1 或更新的 22.x 版本**。源码仓库包含模型权重、固定来源版本、校验记录与许可声明；构建产物和可选 Windows 运行时不进入 Git 历史。

```sh
git clone https://github.com/ChefDavid0815/wis-tech-tank.git
cd wis-tech-tank
npm ci
npm run build
npm test
npm start
```

打开 `http://127.0.0.1:4173`。构建也会生成可直接双击的 `打开演示.html`，仅支持独立模拟；摄像头和本地模型需要服务器或 HTTPS 网页版。开发模式在先构建一次后执行 `npm run dev`。

如果需要补齐模型，运行 `node scripts/prepare-models.mjs`。两个 Hugging Face 模型的固定版本见 `public/models/*/SOURCE.json`，校验值见 `public/models/manifest.json`。Vercel 配置已随项目提供：`npm ci` → `npm run build` → `dist`，无需后端函数或密钥。

| 文件 | 负责的事情 |
| :--- | :--- |
| `src/engine.ts` · `src/scene.ts` | 模拟逻辑与 Three.js 环境 |
| `src/environment.ts` · `src/live-view.ts` | 目标跟踪、风险与局部环境图 |
| `src/perception.ts` · `src/perception-worker.ts` | 本地物体、结构与相对深度模型 |
| `src/outputs.ts` · `src/main.ts` | 语音、操作与双语界面 |
| `tests/engine.test.ts` | 十四项核心行为测试 |

## 04 / 工作台旁的资料

- [完整课堂说明](docs/CLASSROOM-GUIDE.zh-CN.md) · [演示讲稿](演示讲稿.md)
- [验证报告](VERIFICATION.md) · [第三方组件与许可](THIRD-PARTY.md)
- [版本记录](CHANGELOG.md) · [视觉素材来源](docs/ARTWORK.md)

原创源码公开供查看，不对第三方模型与素材统一授予许可。各依赖和模型保留自己的许可，尤其 SegFormer 权重限非商业研究与评估使用。本项目为学校教育原型，不是商业产品。

<p align="center">探测 &nbsp; → &nbsp; 理解 &nbsp; → &nbsp; 判断优先级 &nbsp; → &nbsp; 给出提示</p>
<p align="center"><sub>ChefZC 制作 · 多一点好奇心，多看清下一步。</sub></p>
