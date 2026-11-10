# Desktop plugin runtime

English | [中文](README.zh.md)

Runs separately installed floating ball, selection toolbar and capture plugins in one independent Electron helper connected to official DSH services. It does not replace the official application or modify its installation files. No desktop extension API is required.

## Install and update

Install this repository in DSH's plugin manager and enable it before installing its native feature plugins. Allow Electron's installation script if the package manager requests build approval. Electron is a separate runtime dependency; its first installation downloads the platform binary. Config `electronExecutable` can instead select a locally installed compatible Electron 44 executable.

Git commits do not refresh installed packages. To upgrade, use Add plugin with the new release tag or archive, then restart the Host if requested. Existing profile data remains in the same directory.

## Behavior

The runtime starts only when a feature plugin activates. It owns authenticated RPC and stream requests, per-plugin activation acknowledgements, the helper process and tray menu. Each feature can be enabled, disabled or removed separately. Disabling the runtime stops all dependent native features and waits for window and recording cleanup before terminating Electron. No model request occurs on installation or startup.

## Configuration and limitations

`startTimeoutMs`, `operationTimeoutMs` and `stopTimeoutMs` configure startup, activation and shutdown deadlines. Native packages run with local application privileges. Official sessions, model selection and per-session permission presets are used. Custom-fork coordinate modes and background code-agent configuration are unavailable. The floating ball selects its own conversations and does not track the official main window's current conversation. Build and protocol checks do not establish GUI acceptance; exercise selection, capture and recording on each target OS.

Each pending response permits at most 8 MiB of unread body data. A reader exceeding this limit receives an error and its Host request is cancelled. This bounds the response buffer rather than providing end-to-end flow control for the IPC channel.

## Build

Run `npm install` and `npm run build` with Node 24.9 or newer. Source is included. This repository is part of [1997liuyh-boop/deepseek-harness](https://github.com/1997liuyh-boop/deepseek-harness) and retains the DeepSeek MIT notice.
