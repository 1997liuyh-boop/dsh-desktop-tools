import { t as DESKTOP_IPC } from "./ipc-BHEFtoh4.js";
import { n as readDesktopToolsConfig } from "./desktop-tools-config-DevUlYAh.js";
import { randomUUID } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { copyFile, mkdir, open, rename, rm } from "node:fs/promises";
import { BrowserWindow, ClipboardItem, clipboard, desktopCapturer, dialog, ipcMain, nativeImage, screen, session, shell } from "electron";
// source/apps/desktop/src/desktop-capture.ts
/** 用户框选桌面区域后的截图与录屏；采集结果只写入本机目录。 */
/** 原生窗口拥有采集授权、顺序写盘和取消清理，不读取其他程序的登录凭据。 */
var DesktopCapture = class {
	directory;
	preload;
	messages;
	entries = /* @__PURE__ */ new Map();
	cleanups = /* @__PURE__ */ new Set();
	constructor(directory, preload, messages) {
		this.directory = directory;
		this.preload = preload;
		this.messages = messages;
	}
	/**
	* 显示桌面框选与标注工具栏，完成后由用户选择保存位置；关闭会清理未保存文件。
	* @param mode 初始显示截图或录屏操作。
	* @returns 用户实际保存的本地文件路径。
	*/
	open(mode = "image") {
		const window = new BrowserWindow({
			width: 580,
			height: 460,
			show: false,
			frame: false,
			resizable: false,
			movable: true,
			alwaysOnTop: true,
			skipTaskbar: true,
			hasShadow: false,
			roundedCorners: false,
			webPreferences: {
				preload: this.preload,
				nodeIntegration: false,
				contextIsolation: true,
				sandbox: true,
				webSecurity: true,
				backgroundThrottling: false
			}
		});
		window.setContentProtection(true);
		window.setAlwaysOnTop(true, process.platform === "win32" ? "screen-saver" : "floating");
		return new Promise((resolve) => {
			const entry = {
				window,
				sources: /* @__PURE__ */ new Map(),
				size: 0,
				started: 0,
				audio: false,
				queue: Promise.resolve(),
				settle: resolve
			};
			const contentsId = window.webContents.id;
			this.entries.set(contentsId, entry);
			window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
			window.webContents.on("will-navigate", (event) => {
				event.preventDefault();
			});
			window.once("closed", () => {
				this.entries.delete(contentsId);
				const cleanup = entry.queue.then(async () => {
					await entry.file?.close();
					entry.file = void 0;
					if (entry.path && entry.path !== entry.saved) await rm(entry.path, { force: true });
				}).catch((error) => {
					console.warn("desktop capture cleanup:", error);
				}).finally(() => {
					entry.settle(entry.saved);
				});
				this.cleanups.add(cleanup);
				cleanup.finally(() => {
					this.cleanups.delete(cleanup);
				});
			});
			window.loadURL("dsh-app://shell/capture.html?mode=" + mode);
		});
	}
	/**
	* 仅本功能拥有的主框架能够列出来源、请求采集和写入媒体。
	* @param ipc 桌面 IPC 注册表。
	* @returns 停止采集并释放窗口的卸载操作。
	*/
	register(ipc) {
		session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
			const entry = [...this.entries.values()].find((item) => item.window.webContents.mainFrame === request.frame);
			const source = entry?.selected;
			if (!entry || !source || !entry.file || entry.started === 0) {
				callback({});
				return;
			}
			entry.selected = void 0;
			callback({
				video: source,
				...entry.audio && process.platform === "win32" ? { audio: "loopback" } : {}
			});
		});
		ipc.handle(DESKTOP_IPC.captureResult, async (event, operation, input) => {
			const entry = this.entries.get(event.sender.id);
			if (!entry || event.senderFrame !== entry.window.webContents.mainFrame) throw new Error("Unowned capture renderer");
			const value = typeof input === "object" && input !== null ? input : {};
			const task = entry.queue.then(() => this.invoke(entry, operation, value));
			entry.queue = task.catch(() => {});
			try {
				return {
					ok: true,
					value: await task
				};
			} catch (error) {
				return {
					ok: false,
					error: this.messages().captureFailed,
					details: error instanceof Error ? error.message : String(error)
				};
			}
		});
		return async () => {
			ipc.removeHandler(DESKTOP_IPC.captureResult);
			session.defaultSession.setDisplayMediaRequestHandler(null);
			const entries = [...this.entries.values()];
			for (const entry of entries) entry.window.close();
			await Promise.all(this.cleanups);
		};
	}
	/** @param event IPC 调用方。 @returns 是否为本功能拥有的主框架。 */
	owns(event) {
		return this.entries.has(event.sender.id) && event.senderFrame === event.sender.mainFrame;
	}
	/** @param contents 发起屏幕共享的窗口。 @returns 是否已由用户选择来源并点击开始，尚未交付来源。 */
	allowsDisplayMedia(contents) {
		const entry = this.entries.get(contents.id);
		return entry !== void 0 && entry.selected !== void 0 && entry.file !== void 0 && entry.started > 0;
	}
	async save(entry) {
		if (!entry.pending || !entry.path) throw new Error("No capture to save");
		const copied = entry.copied;
		let temporary;
		try {
			const extension = entry.pending === "image" ? "png" : "webm";
			const target = await dialog.showSaveDialog(entry.window, {
				title: this.messages().captureSelectSave,
				defaultPath: basename(entry.path),
				filters: [{
					name: extension.toUpperCase(),
					extensions: [extension]
				}],
				properties: ["showOverwriteConfirmation", "createDirectory"]
			});
			if (target.canceled || !target.filePath || entry.window.isDestroyed()) return {
				pending: true,
				copied
			};
			const path = target.filePath;
			if (resolve(path) !== resolve(entry.path)) {
				temporary = join(dirname(path), ".dsh-capture-" + randomUUID());
				await copyFile(entry.path, temporary);
				await rename(temporary, path);
				temporary = void 0;
			}
			const source = entry.path;
			entry.saved = path;
			entry.path = void 0;
			entry.pending = void 0;
			entry.settle(path);
			if (resolve(source) !== resolve(path)) await rm(source, { force: true }).catch((error) => {
				console.warn("desktop capture temporary cleanup:", error);
			});
			return {
				path,
				copied,
				pending: false
			};
		} catch (error) {
			return {
				pending: true,
				copied,
				saveError: error instanceof Error ? error.message : String(error)
			};
		} finally {
			if (temporary) await rm(temporary, { force: true }).catch((error) => {
				console.warn("desktop capture temporary cleanup:", error);
			});
		}
	}
	async invoke(entry, operation, value) {
		const directory = join(this.directory, "captures");
		switch (operation) {
			case "desktop": {
				if (entry.file || entry.path) throw new Error("Finish or discard the capture first");
				const displays = screen.getAllDisplays();
				if (displays.length === 0) throw new Error("No desktop display is available");
				const left = Math.min(...displays.map((display) => display.bounds.x)), top = Math.min(...displays.map((display) => display.bounds.y));
				const width = Math.max(...displays.map((display) => display.bounds.x + display.bounds.width)) - left;
				const height = Math.max(...displays.map((display) => display.bounds.y + display.bounds.height)) - top;
				const captures = /* @__PURE__ */ new Map();
				const sources = [], images = [];
				for (const display of displays) {
					const thumbnailSize = {
						width: Math.round(display.bounds.width * display.scaleFactor),
						height: Math.round(display.bounds.height * display.scaleFactor)
					};
					const key = `${thumbnailSize.width}x${thumbnailSize.height}`;
					let candidates = captures.get(key);
					if (!candidates) {
						candidates = await desktopCapturer.getSources({
							types: ["screen"],
							thumbnailSize,
							fetchWindowIcons: false
						});
						captures.set(key, candidates);
					}
					const source = candidates.find((item) => item.display_id === String(display.id));
					if (!source || source.thumbnail.isEmpty()) throw new Error("A desktop display is unavailable");
					sources.push(source);
					images.push({
						id: source.id,
						x: display.bounds.x - left,
						y: display.bounds.y - top,
						width: display.bounds.width,
						height: display.bounds.height,
						scaleFactor: display.scaleFactor,
						image: source.thumbnail.toDataURL()
					});
				}
				entry.sources = new Map(sources.map((source) => [source.id, source]));
				entry.desktop = {
					x: left,
					y: top,
					width,
					height
				};
				entry.window.setBounds(entry.desktop);
				const cursor = screen.getCursorScreenPoint();
				return {
					width,
					height,
					images,
					pointer: {
						x: cursor.x - left,
						y: cursor.y - top
					}
				};
			}
			case "ready":
				entry.window.show();
				entry.window.focus();
				return;
			case "compact": {
				const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
				const height = "recording" in value && value.recording === true ? 96 : 164;
				entry.window.setBounds({
					x: area.x + Math.max(0, Math.floor((area.width - 600) / 2)),
					y: area.y + 16,
					width: Math.min(600, area.width),
					height
				});
				entry.window.show();
				return;
			}
			case "close":
				if (entry.file || entry.path) throw new Error("Finish or discard the capture first");
				entry.window.close();
				return;
			case "image-data": {
				if (entry.path || entry.file || !("data" in value) || !(value.data instanceof Uint8Array) || value.data.byteLength > 64e6) throw new Error("Invalid screenshot data");
				const image = nativeImage.createFromBuffer(Buffer.from(value.data));
				if (image.isEmpty()) throw new Error("Screenshot is not a readable image");
				const size = image.getSize();
				if (size.width * size.height > 12e7) throw new Error("Screenshot dimensions exceed the limit");
				const png = image.toPNG();
				if ("copy" in value && value.copy === true) {
					await clipboard.write([new ClipboardItem({ "image/png": new Blob([new Uint8Array(png)]) })]);
					return { copied: true };
				}
				await mkdir(directory, { recursive: true });
				const path = join(directory, "screenshot-" + randomUUID() + ".png");
				const file = await open(path, "wx");
				try {
					try {
						await file.writeFile(png);
					} finally {
						await file.close();
					}
				} catch (error) {
					await rm(path, { force: true }).catch((cleanupError) => {
						console.warn("desktop capture partial image cleanup:", cleanupError);
					});
					throw error;
				}
				entry.path = path;
				entry.pending = "image";
				return this.save(entry);
			}
			case "sources": {
				if (entry.file) throw new Error("Recording is active");
				const sources = await desktopCapturer.getSources({
					types: ["window", "screen"],
					thumbnailSize: {
						width: 0,
						height: 0
					},
					fetchWindowIcons: false
				});
				entry.sources = new Map(sources.map((source) => [source.id, source]));
				return [...entry.sources.values()].map((source) => ({
					id: source.id,
					name: source.name
				}));
			}
			case "image": {
				if (!("source" in value) || typeof value.source !== "string" || !entry.sources.has(value.source) || entry.path) throw new Error("Select a capture source and save or discard the previous capture first");
				const source = (await desktopCapturer.getSources({
					types: [value.source.startsWith("screen:") ? "screen" : "window"],
					thumbnailSize: {
						width: 4096,
						height: 4096
					},
					fetchWindowIcons: false
				})).find((item) => item.id === value.source);
				if (!source || source.thumbnail.isEmpty()) throw new Error("Selected window is no longer available");
				await mkdir(directory, { recursive: true });
				const png = source.thumbnail.toPNG();
				entry.path = join(directory, "screenshot-" + randomUUID() + ".png");
				const file = await open(entry.path, "wx");
				try {
					await file.writeFile(png);
				} finally {
					await file.close();
				}
				entry.pending = "image";
				entry.copied = true;
				try {
					await clipboard.write([new ClipboardItem({ "image/png": new Blob([new Uint8Array(png)]) })]);
				} catch (error) {
					entry.copied = false;
					console.warn("desktop capture clipboard:", error);
				}
				return this.save(entry);
			}
			case "begin": {
				if (!("source" in value) || typeof value.source !== "string" || entry.path) throw new Error("Select a capture source and save or discard the previous capture first");
				const source = entry.sources.get(value.source);
				if (!source) throw new Error("Capture source has changed; refresh the list");
				await mkdir(directory, { recursive: true });
				entry.path = join(directory, "recording-" + randomUUID() + ".webm");
				entry.file = await open(entry.path, "wx");
				entry.selected = source;
				entry.started = Date.now();
				entry.size = 0;
				delete entry.copied;
				entry.audio = "audio" in value && value.audio === true;
				return;
			}
			case "chunk":
				if (!entry.file || !("data" in value) || !(value.data instanceof Uint8Array) || value.data.byteLength === 0 || value.data.byteLength > 4e6 || entry.size + value.data.byteLength > 5e8 || Date.now() - entry.started > 91e4) throw new Error("Recording data exceeds its size or time limit");
				await entry.file.writeFile(value.data);
				entry.size += value.data.byteLength;
				return;
			case "finish": {
				if (!entry.file || !entry.path || entry.size === 0) throw new Error("No recorded video was received");
				await entry.file.close();
				entry.file = void 0;
				const source = await open(entry.path, "r");
				try {
					const header = Buffer.alloc(4);
					await source.read(header, 0, 4, 0);
					if (!header.equals(Buffer.from([
						26,
						69,
						223,
						163
					]))) throw new Error("Recorded file is not WebM");
				} finally {
					await source.close();
				}
				entry.pending = "video";
				entry.selected = void 0;
				return this.save(entry);
			}
			case "save": return this.save(entry);
			case "cancel":
				await entry.file?.close();
				entry.file = void 0;
				entry.selected = void 0;
				if (entry.path && entry.path !== entry.saved) await rm(entry.path, { force: true });
				entry.path = void 0;
				entry.pending = void 0;
				delete entry.copied;
				return;
			case "reveal":
				if (!entry.saved) throw new Error("No saved capture");
				shell.showItemInFolder(entry.saved);
				return;
			default: throw new Error("Unknown capture operation");
		}
	}
};
// source/apps/desktop/src/desktop-capture-plugin.ts
/** 截图录屏扩展独立提供菜单入口、采集窗口和异步写盘清理。 */
/** 采集界面仅在插件安装期间通过自定义协议提供。 */
const shellAssets = [
	"/capture.html",
	"/capture.js",
	"/capture.css",
	"/capture.tw.css",
	"/shell-theme.js",
	"/assets/window-material.css"
];
/** @param context 当前安装包的原生资源作用域。 */
function activate(context) {
	const environment = context.environment;
	const config = readDesktopToolsConfig(environment.profile);
	const capture = new DesktopCapture(environment.profile, environment.preload, () => environment.locale().messages);
	context.effect(capture.register(ipcMain));
	const open = (mode) => {
		if (!(mode === "image" ? config.screenshot.enabled : config.recording.enabled)) throw new Error(mode === "image" ? "截图功能未启用" : "录屏功能未启用");
		return capture.open(mode);
	};
	context.provide("capture", {
		open,
		allowsDisplayMedia: (contents) => capture.allowsDisplayMedia(contents)
	});
	context.registerSender((event) => capture.owns(event));
	context.menu(() => [...config.screenshot.enabled ? [{
		label: environment.locale().messages.captureScreenshot,
		click: () => {
			open("image").catch((error) => {
				console.error("截图录屏启动失败", error);
			});
		}
	}] : [], ...config.recording.enabled ? [{
		label: environment.locale().messages.captureVideo,
		click: () => {
			open("video").catch((error) => {
				console.error("截图录屏启动失败", error);
			});
		}
	}] : []]);
}
export { activate, shellAssets };
