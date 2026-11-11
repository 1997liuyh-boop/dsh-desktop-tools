# dsh-desktop-tools

[English](README.md) | [中文](README.zh.md)

`dsh-desktop-tools` is one DSH Desktop plugin for the selection toolbar, floating assistant, screenshots, long screenshots, and screen recording.

## Install

Use DSH Desktop `>=0.2.2-rc.1 <0.3.0-0`, then add this repository as one plugin:

```text
https://github.com/1997liuyh-boop/dsh-desktop-tools.git
```

Install tag `0.4.4`. The plugin includes its own helper, preload, native feature modules, static assets, and settings page. No separate `dsh-desktop-runtime`, `dsh-selection-toolbar`, `dsh-floating-ball`, or `dsh-capture` package is required.

Installation does not require an Electron `path.txt` file and does not use the `koffi` install script. The helper uses the DSH Desktop Electron executable and loads the matching prebuilt Koffi platform package.

## Prerequisite: dsh-vision-router

Extract text, Translate, and Knowledge graph on screenshots and long screenshots, and Recording to knowledge graph, recognize text with the OCR tools of [`dsh-vision-router`](https://github.com/ysr666/dsh-vision-router) (`>=3.2.0`). Install and enable it and keep its "tool" switch on. All other tools (annotations, pin, save, forward, recording, long-screenshot stitching) work without it.

The DSH plugin manager cannot install one plugin together with another, so use any of these:

- In **Settings → Desktop tools → Screenshot**, click **Install dsh-vision-router** on the prerequisite card (**Enable** when it is installed but disabled), then restart DSH when asked;
- When you use one of those three tools before it is installed, the result window shows the same install button;
- Or run `dsh plugin add dsh-vision-router` in a terminal.

`package.json` declares it as an optional `peerDependencies` entry so marketplace checks warn about an out-of-range version. The default OCR engine is `auto`: local Tesseract first, falling back to the vision model configured in vision-router (which receives the image). For strictly local OCR, set the vision-router default OCR engine to Tesseract only.

## Screenshot, long screenshot, and recording

Press the shortcut (system-wide, also while DSH is in the background) to open a toolbar at the top of the screen with three modes: Screenshot, Record screen, and Long screenshot.

Screenshot, after you select an area:

- Shape (rectangle / ellipse / line; hold Shift for a square, circle, or 45° steps), pen, arrow, text (text / auto-incrementing numbers), mosaic (brush with adjustable strength), plus color, stroke width, and font size;
- Pin to desktop (always-on-top window: drag to move, scroll to zoom, double-click or Esc to close, right-click to copy, save, or reset the size);
- Long screenshot (starts scrolling capture with the current area);
- Knowledge graph, Translate, and Extract text (need dsh-vision-router): shown in a separate result window. Translate and Knowledge graph create DSH sessions in the "Screenshots and recordings" workspace; the knowledge graph is a Mermaid diagram plus node and relation lists, saved as Markdown or exported as PNG;
- Undo (Ctrl/Cmd + Z), Forward (to a new DSH conversation with an optional message, or the system share panel), Save to disk (Ctrl/Cmd + S), Cancel (Esc), Done (copy to clipboard, Enter).

Recording:

- Scope: a selected area, an application window, or a full screen;
- Format MP4 / GIF / WebM (WebM is used when Chromium cannot encode MP4); quality SD 720p / HD 1080p / Original;
- System sound and microphone (mixed into one track when both are on); GIF has no sound;
- Recording to knowledge graph: key frames with clear visual changes (up to 12) are kept during recording and their text is turned into a knowledge graph afterwards. Speech is not transcribed;
- While recording, a control bar offers pause / resume (Space), stop and save (Enter), and discard (Esc). MP4 / WebM stop at 15 minutes or 500 MB, GIF at 3 minutes.

Long screenshot: select the scrolling area, click Start, and scroll down inside the frame with the mouse wheel. Frames are matched row by row and stitched, excluding fixed headers and footers; Auto scroll is also available. Afterwards you can copy, save, pin, extract text, translate, build a knowledge graph, or forward the result. The maximum height is 30000 pixels.

Platform limits:

| Feature | Windows | macOS | Linux |
| --- | --- | --- | --- |
| System sound | Supported | macOS 13+; falls back to video only | Not supported |
| Long screenshot auto scroll | Supported | Needs Accessibility permission | Not supported (scroll manually) |
| System share | Explorer Share panel | macOS share menu | Not supported |

## Replace earlier plugins

If the profile already has any of the four earlier entries, remove `dsh-selection-toolbar`, `dsh-floating-ball`, `dsh-capture`, and `dsh-desktop-runtime` before installing `dsh-desktop-tools@0.4.4`, then restart the Host. The new plugin stores settings in `desktop-tools.json`; it does not import the retired packages' separate settings files. Its defaults enable the selection toolbar and floating assistant, and disable screenshots and recording.

## Settings

The DSH settings panel adds one **Desktop tools** entry with four submenus:

- Selection toolbar: enablement, target language, model, and compatibility copy.
- Floating assistant: enablement, avatar, conversation/background models, permission preset, coordinate mode, and system permissions.
- Screenshot: enablement, the screenshot shortcut (default `Ctrl/Cmd + Shift + S`), an optional long-screenshot shortcut, and dsh-vision-router status with one-click install.
- Screen recording: enablement, the recording shortcut (default `Ctrl/Cmd + Shift + R`), and default format, quality, system sound, microphone, and knowledge graph.

Shortcuts are global; a combination already taken by another program is not registered, so choose another one. Selection and floating assistant are enabled by default. Screenshot and recording are disabled by default. Configuration is stored in the profile's `desktop-tools.json`; each save reports both persistence and actual helper application status.

## Build

Use Node 24.9 or newer:

```sh
npm install --ignore-scripts
npm test
npm run build
```

The build creates the Host, helper, preload, Remote descriptor, Client settings bundle, and TwCSS-based assets. macOS native modules are compiled when the build runs on macOS; Windows and Linux keep the Darwin-only modules unavailable.

## License

MIT. The repository includes the DeepSeek MIT notice and third-party package licenses.
