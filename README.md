# dsh-desktop-runtime

English | [中文](README.zh.md)

Repository name: `dsh-desktop-runtime`

Repository description: Independent native plugin runtime for the official DSH desktop application.

## Description

`dsh-desktop-runtime` runs the floating ball, selection toolbar, and capture plugins in one independent Electron helper connected to official DSH services. It leaves the official application files unchanged and does not require the old Desktop extension API.

## Features

- Starts the helper only when a feature plugin activates.
- Owns authenticated RPC and stream requests, activation acknowledgements, helper lifecycle, and the tray menu.
- Lets each feature be enabled, disabled, or removed independently.
- Waits for window and recording cleanup before stopping Electron.
- Uses official sessions, model selection, and per-session permission presets.
- Limits each unread pending response body to 8 MiB and cancels the related Host request when the limit is exceeded.

Installation and startup do not send a model request. The floating ball keeps its own conversation selection and does not follow the official main window's current conversation.

## Installation

1. Use a DSH Desktop release that satisfies `>=0.2.2-rc.1 <0.3.0-0`.
2. In the DSH plugin manager, choose **Add plugin**, enter `https://github.com/1997liuyh-boop/dsh-desktop-runtime.git`, and select the exact tag `0.1.1`.
3. Enable `dsh-desktop-runtime`, then install the feature plugins at their `v0.2.1` tags.
4. Allow the Electron install script if the package manager asks for build approval. Restart the Host when DSH requests it.

The `electronExecutable` setting can select a locally installed compatible Electron 44 executable. Existing profile data stays in the same directory when the runtime is disabled or replaced. Git commits do not update an installed copy; install the exact release tag or archive to upgrade.

## Build

Run `npm install` and `npm run build` with Node 24.9 or newer. The package includes the source and prebuilt `dist` entry. Build and protocol checks do not establish GUI acceptance; exercise selection, capture, and recording on each target OS.

## Origin

This repository is part of [1997liuyh-boop/deepseek-harness](https://github.com/1997liuyh-boop/deepseek-harness) and retains the DeepSeek MIT notice.

## Limitations

Native feature packages run with local application privileges. Custom-fork coordinate modes and background code-agent configuration are unavailable. Electron's first installation downloads a platform binary unless `electronExecutable` is configured. GUI behavior still depends on the host OS and its capture, accessibility, and permission settings.

## Version

This README documents release `0.1.1`. The reproducible source is the `0.1.1` Git tag in this repository.
