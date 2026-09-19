# Web publication / 网页发布

Published on 2026-09-19 as STRIDE 0.2.0, retaining the existing classroom prototype version.

- Web: https://chefzc-wis-tech-tank.vercel.app
- Source: https://github.com/ChefDavid0815/wis-tech-tank
- Exhibition: https://chefzc-homepage.vercel.app/school-gallery.html
- Notes: https://chefzc-homepage.vercel.app/post.html?article=wis-tech-tank

## Checks performed for this publication

- TypeScript and browser bundle build passed locally and on Vercel.
- All 14 core tests passed on the current source.
- Production browser: the 3D scene rendered; table scenario, start, pause and Chinese switching worked, with a corresponding obstacle caption and no captured console errors.
- Local browser: the stairs simulation stopped at 0.65 m before contact.
- Production HTTP checks: page, COCO graph, layout/depth ONNX files and ONNX WASM resource returned 200 with appropriate content types.
- Portfolio: four main-project cards remain in Gallery; School Lab is a separate page. The scene selector retains its selected scene across language changes. Screenshot dialog opens, closes with Escape and returns focus.
- Responsive layouts inspected at desktop size and 390 px. Six Post overview cards and ten Now entries are present.

The existing real-model fixture report is preserved in `VERIFICATION.md`. Camera inference and physical devices were not re-tested during publication. The web deployment was performed with the Vercel CLI; automatic deployment on Git push has not been connected because the Vercel Git connection rejected access to the new repository. Manual `vercel deploy --prod` is available from the linked project directory.

本次验证覆盖构建、14 项核心逻辑、线上模拟流程与双语切换、资源可访问性、展柜交互和手机布局；未重新验证摄像头推理或实体硬件。网站使用 Vercel CLI 发布，Git 自动部署连接暂未建立。
