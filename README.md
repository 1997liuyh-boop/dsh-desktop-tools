# dsh-desktop-tools

[English](README.md) | [中文](README.zh.md)

`dsh-desktop-tools` is one DSH Desktop plugin for the selection toolbar, floating assistant, screenshots, and screen recording.

## Install

Use DSH Desktop `>=0.2.2-rc.1 <0.3.0-0`, then add this repository as one plugin:

```text
https://github.com/1997liuyh-boop/dsh-desktop-tools.git
```

Install tag `0.3.0`. The plugin includes its own helper, preload, native feature modules, static assets, and settings page. No separate `dsh-desktop-runtime`, `dsh-selection-toolbar`, `dsh-floating-ball`, or `dsh-capture` package is required.

Installation does not require an Electron `path.txt` file and does not use the `koffi` install script. The helper uses the DSH Desktop Electron executable and loads the matching prebuilt Koffi platform package.

## Replace earlier plugins

If the profile already has any of the four earlier entries, remove `dsh-selection-toolbar`, `dsh-floating-ball`, `dsh-capture`, and `dsh-desktop-runtime` before installing `dsh-desktop-tools@0.3.0`, then restart the Host. The new plugin stores settings in `desktop-tools.json`; it does not import the retired packages' separate settings files. Its defaults enable the selection toolbar and floating assistant, and disable screenshots and recording.

## Settings

The DSH settings panel adds one **Desktop tools** entry with four submenus:

- Selection toolbar: enablement, target language, model, and compatibility copy.
- Floating assistant: enablement, avatar, conversation/background models, permission preset, coordinate mode, and system permissions.
- Screenshot: enablement and an editable `Ctrl/Cmd + Shift + S` shortcut.
- Screen recording: enablement and an editable `Ctrl/Cmd + Shift + R` shortcut.

Selection and floating assistant are enabled by default. Screenshot and recording are disabled by default. Configuration is stored in the profile's `desktop-tools.json`; each save reports both persistence and actual helper application status.

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
