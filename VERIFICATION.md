# Verification · STRIDE 0.2

Verified on 2026-09-19 in the Windows workspace. Build: TypeScript checking and bundled browser build passed. Dependency audit: zero reported vulnerabilities after updating the image utility dependency.

## Core logic

`npm test`: **14 / 14 passed**. Covers scenario warning selection, computed arrival time, zero walking speed, pre-contact stopping, pause/reset, stale/invalid sensor data, clearance rules, motor timing, multi-object identity, track expiry, relative-depth expiry, path overlap, structural hazards and unknown-space behavior.

## Browser / real-model integration

`node scripts/browser-check.mjs`: **13 flow checks passed**, zero captured browser exceptions, zero off-machine requests during execution. Detailed evidence: `artifacts/browser-check.json`.

| Boundary | Result |
| --- | --- |
| Simulation rendering | Real 3D canvas loaded |
| Steps → warnings | Observed speech calls for 3, 2, 1 and stop; motion stopped at 0.65 m |
| Pause → outputs | Position held and motor became idle |
| Video input → object model → map | Chromium virtual webcam fed a fixture through actual COCO-SSD; two cats retained separate IDs and left/right positions |
| Optional depth worker | Actual quantized Depth Anything V2 inference produced a depth image and updated proximity |
| Camera stop | All acquired video tracks ended; environment list cleared |
| Mode change | Camera tracks ended before returning to simulation |
| Chinese localization | Simulation retained state and Chinese labels rendered |
| Room structure | Actual SegFormer inference on a fixture produced a candidate wall region |
| Permission error | Simulated permission rejection displayed an actionable error |
| Small screen | 390 px viewport had no horizontal page overflow |
| Session export | JSON contained both simulation and real-model inference events |
| Locality / browser health | No browser exceptions and no non-local HTTP requests during the check |

Observed on this machine during the virtual-camera fixture test: object loop **5.0 FPS**, object inference **33 ms**, layout inference about **510–725 ms**, optional depth inference about **700 ms**. These are one-machine demonstration measurements, not performance guarantees or model-accuracy benchmarks.

## What these checks do not establish

- **Physical webcam not tested.** Browser camera lifecycle was tested using Chromium's virtual camera with a known image fixture. An actual camera and classroom setting still require rehearsal.
- **Physical speaker output not evaluated.** Speech API calls and warning strings were observed; this does not prove audible volume or voice availability on another PC.
- **No physical motor, ToF or audio jack hardware connected.** Haptic patterns are visualized. Computer speakers/headphones follow the operating system's selected output.
- Door and stair classes are supported in the segmentation model, but reliable recognition of real doors/stairs was not validated in diverse scenes. The only structural image fixture verified here produced a wall region.
- Relative depth has no metric scale calibration. No SLAM, room-wide mapping, safe walking route or accessibility certification is claimed.

Screenshots in `artifacts` include the Chinese simulation, real model outputs with virtual camera input, optional depth, and the mobile view. Test fixtures and virtual-camera images are not shipped as a fake live-camera feed.
