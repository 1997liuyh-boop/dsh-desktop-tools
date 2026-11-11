import { n as SCHEME, t as DESKTOP_IPC } from "./ipc-DldzT79T.js";
import { _ as raiseOverlayAboveObservationFrame, a as applyFloatingOverlayGuard, c as moveFloatingBall, d as resetFloatingOverlayGuard, f as setFloatingExpanded, g as hideObservationFrame, h as createObservationFrameWindow, i as writeOrbAgentModels, l as overlayWindowExcludeIds, o as clampFloatingWindow, p as unsnapDockedBall, r as readOrbAgentModels, s as createFloatingWindow, t as isOrbAgentModelSelection, v as showObservationFrame } from "./orb-agent-models--nZzToFZ.js";
import { n as readDesktopToolsConfig, r as writeDesktopToolsConfig } from "./desktop-tools-config-CoArygqo.js";
import { a as installOrbAvatarFromPath, c as orbSettingsSupported, d as serveOrbAvatar, o as orbAvatarCacheToken, r as assertOrbSettingsWritable, s as orbAvatarUrl, t as DEFAULT_ORB_AVATAR_FILE, u as restoreOrbAvatar } from "./orb-avatar-DgC5zfjx.js";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { BrowserWindow, app, dialog, screen, shell, systemPreferences } from "electron";
// source/apps/desktop/src/macos-sck-napi.ts
let binding;
function loadBinding() {
	if (binding !== void 0) return binding;
	if (process.platform !== "darwin") throw new Error("dsh desktop: overlay-exclude capture is Darwin-only");
	binding = createRequire(import.meta.url)(join(dirname(fileURLToPath(import.meta.url)), "macos-sck-napi.node"));
	return binding;
}
async function captureExcludedRegionOnElectron(input) {
	await loadBinding().capture(input.region, input.excludeWindowIds.join(","), input.output);
}
// source/apps/desktop/src/floating-session.ts
const FLOATING_SESSION_FILE = "floating-session.json";
function readFloatingSessionId(profileDir) {
	try {
		const value = JSON.parse(readFileSync(join(profileDir, FLOATING_SESSION_FILE), "utf8"));
		if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
		const sessionId = value.sessionId;
		return typeof sessionId === "string" && sessionId !== "" ? sessionId : void 0;
	} catch {
		return;
	}
}
function writeFloatingSessionId(profileDir, sessionId) {
	writeFileSync(join(profileDir, FLOATING_SESSION_FILE), `${JSON.stringify({ sessionId }, void 0, 2)}\n`);
}
function ensureOrbWorkspaceDir(path) {
	mkdirSync(path, { recursive: true });
	return path;
}
// source/apps/desktop/src/orb-permission.ts
const ORB_PERMISSION_PRESETS = [
	"read-only",
	"workspace-write",
	"danger-full-access"
];
const DEFAULT_ORB_PERMISSION = "danger-full-access";
function isOrbPermissionPreset(value) {
	return typeof value === "string" && ORB_PERMISSION_PRESETS.includes(value);
}
function readOrbPermission(profileDir) {
	const preset = readDesktopToolsConfig(profileDir).floatingBall.permissionPreset;
	return isOrbPermissionPreset(preset) ? preset : DEFAULT_ORB_PERMISSION;
}
function writeOrbPermission(profileDir, preset) {
	const current = readDesktopToolsConfig(profileDir);
	writeDesktopToolsConfig(profileDir, {
		...current,
		floatingBall: {
			...current.floatingBall,
			permissionPreset: preset
		}
	});
}
// source/apps/desktop/src/millifraction-coordinates.ts
function readMillifractionCoordinates(profileDir) {
	return { enabled: readDesktopToolsConfig(profileDir).floatingBall.coordinateMode === "millifraction" };
}
function writeMillifractionCoordinates(profileDir, config) {
	const current = readDesktopToolsConfig(profileDir);
	writeDesktopToolsConfig(profileDir, {
		...current,
		floatingBall: {
			...current.floatingBall,
			coordinateMode: config.enabled ? "millifraction" : "pixel"
		}
	});
}
function orbCoordinateModeFor(enabled) {
	return enabled ? "millifraction" : "pixel";
}
// source/apps/desktop/src/millifraction-coordinates-apply.ts
async function applyMillifractionCoordinates(input) {
	if (input.requestedEnabled === input.currentEnabled) return { applied: false };
	if (!await input.dialog.show({
		title: input.messages.millifractionConfirmTitle,
		message: input.messages.millifractionConfirmMessage,
		detail: input.messages.millifractionConfirmDetail,
		confirm: input.messages.millifractionConfirmOk,
		cancel: input.messages.millifractionConfirmCancel
	})) return { applied: false };
	input.persist(input.requestedEnabled);
	input.pushHost(orbCoordinateModeFor(input.requestedEnabled));
	input.createOverlaySession();
	return {
		applied: true,
		enabled: input.requestedEnabled
	};
}
// source/apps/desktop/src/tcc.ts
const TCC_SETTINGS_URL = {
	screen: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
	accessibility: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
};
function isTccRight(value) {
	return value === "screen" || value === "accessibility";
}
function rightState(granted, opened) {
	if (granted) return "granted";
	return opened ? "needsRelaunch" : "missing";
}
var TccController = class {
	host;
	opened = /* @__PURE__ */ new Set();
	constructor(host) {
		this.host = host;
	}
	status() {
		const appName = this.host.appName();
		if (this.host.platform !== "darwin") return {
			applicable: false,
			appName,
			screen: "granted",
			accessibility: "granted"
		};
		return {
			applicable: true,
			appName,
			screen: rightState(this.host.screenGranted(), this.opened.has("screen")),
			accessibility: rightState(this.host.accessibilityGranted(), this.opened.has("accessibility"))
		};
	}
	async open(right) {
		if (this.host.platform !== "darwin") return;
		this.opened.add(right);
		await this.host.openExternal(TCC_SETTINGS_URL[right]);
	}
};
// source/apps/desktop/src/desktop-floating-plugin.ts
/** 悬浮球扩展拥有窗口、模型配置、系统权限与原生覆盖处理。 */
/** 本扩展声明的协议资源；未安装时桌面不提供这些文件。 */
const shellAssets = [
	"/floating.html",
	"/floating.js",
	"/floating.css",
	"/floating-mentions.css",
	"/floating-mentions.tw.css",
	"/deepseek-avatar-square.gif",
	"/observation-frame.html",
	"/observation-frame.css",
	"/selection-markdown.js",
	"/shell-theme.js",
	"/assets/window-material.css"
];
/** @param context 当前安装包的原生资源作用域。 @returns 窗口与接口挂载完成。 */
async function activate(context) {
	const environment = context.environment;
	const paths = {
		profile: environment.profile,
		orbWorkspace: environment.workspace
	};
	const currentDesktopLocale = () => environment.locale();
	const mainWindow = environment.mainWindow();
	const shellPreload = environment.preload;
	const messages = currentDesktopLocale().messages;
	let observationFrameWindow;
	let sessionRunning = false;
	let overlayTextEditing = false;
	let millifractionApplying;
	const loadFloatingModelCatalog = () => context.modelCatalog();
	const assertProductSender = (event) => environment.assertProductSender(event);
	const shellSender = (event) => {
		context.assertSender(event);
	};
	const capture = { open: (mode = "image") => {
		const service = context.service("capture");
		if (!service) return Promise.reject(new Error(environment.locale().messages.desktopMissingCapturePlugin));
		return service.open(mode);
	} };
	const orbHostHandlers = environment.hostHandlers;
	const overlayGuardInputApplyDelay = () => new Promise((resolve) => {
		setTimeout(resolve, 80).unref();
	});
	const tcc = new TccController({
		platform: process.platform,
		appName: () => app.name,
		screenGranted: () => systemPreferences.getMediaAccessStatus("screen") === "granted",
		accessibilityGranted: () => systemPreferences.isTrustedAccessibilityClient(false),
		openExternal: (url) => shell.openExternal(url)
	});
	function pushStoredOrbPreferences(host) {
		if (environment.standalone) return;
		host.sendOrbCodeAgentModel(readOrbAgentModels(paths.profile).background);
		host.sendOrb({
			type: "orb-permission",
			preset: readOrbPermission(paths.profile)
		});
		host.sendOrb({
			type: "orb-coordinate-mode",
			mode: orbCoordinateModeFor(readMillifractionCoordinates(paths.profile).enabled)
		});
	}
	function publishTcc() {
		const status = tcc.status();
		if (!floatingShell.isDestroyed()) floatingShell.webContents.send(DESKTOP_IPC.floatingTcc, status);
		return status;
	}
	function requestOverlayNewSession() {
		const window = floatingShell;
		if (window.isDestroyed()) return;
		const send = () => {
			if (!window.isDestroyed()) window.webContents.send(DESKTOP_IPC.floatingCreateSession);
		};
		if (window.webContents.isLoading()) {
			window.webContents.once("did-finish-load", send);
			return;
		}
		send();
	}
	function persistOverlayModel(next) {
		const current = readOrbAgentModels(paths.profile);
		writeOrbAgentModels(paths.profile, {
			overlay: next,
			background: current.background
		});
		if (!floatingShell.isDestroyed()) floatingShell.webContents.send(DESKTOP_IPC.floatingOverlayModel, next);
	}
	function persistBackgroundModel(next) {
		const current = readOrbAgentModels(paths.profile);
		writeOrbAgentModels(paths.profile, {
			overlay: current.overlay,
			background: next
		});
		environment.host()?.sendOrbCodeAgentModel(next);
	}
	function publishAvatar() {
		if (floatingShell.isDestroyed()) return;
		floatingShell.webContents.send(DESKTOP_IPC.floatingAvatar, orbAvatarUrl("shell", orbAvatarCacheToken(paths.profile)));
	}
	function orbSnapshotFor(hostname) {
		const models = readOrbAgentModels(paths.profile);
		return {
			supported: orbSettingsSupported(process.platform),
			avatarUrl: orbAvatarUrl(hostname, orbAvatarCacheToken(paths.profile)),
			overlay: models.overlay,
			background: models.background,
			selectionEnabled: context.service("selection")?.enabled() ?? false,
			millifractionEnabled: readMillifractionCoordinates(paths.profile).enabled,
			tcc: tcc.status()
		};
	}
	async function confirmMillifractionEnabled(enabled, parent) {
		if (millifractionApplying !== void 0) return millifractionApplying;
		const run = (async () => {
			if (!(await applyMillifractionCoordinates({
				requestedEnabled: enabled,
				currentEnabled: readMillifractionCoordinates(paths.profile).enabled,
				messages: currentDesktopLocale().messages,
				dialog: { async show(options) {
					const box = {
						type: "question",
						title: options.title,
						message: options.message,
						detail: options.detail,
						buttons: [options.confirm, options.cancel],
						defaultId: 0,
						cancelId: 1
					};
					return (parent === void 0 ? await dialog.showMessageBox(box) : await dialog.showMessageBox(parent, box)).response === 0;
				} },
				persist: (next) => {
					writeMillifractionCoordinates(paths.profile, { enabled: next });
				},
				pushHost: (mode) => {
					environment.host()?.sendOrb({
						type: "orb-coordinate-mode",
						mode
					});
				},
				createOverlaySession: requestOverlayNewSession
			})).applied) return { cancelled: true };
			return {
				cancelled: false,
				snapshot: orbSnapshotFor("app")
			};
		})();
		millifractionApplying = run;
		try {
			return await run;
		} finally {
			millifractionApplying = void 0;
		}
	}
	const floatingShell = context.own(createFloatingWindow(shellPreload, messages, () => {
		context.showMain();
	}, () => {
		app.quit();
	}, {
		enabled: () => context.service("selection")?.enabled() ?? false,
		toggle: () => {
			context.service("selection")?.toggle();
		}
	}, {
		backgroundSupported: !environment.standalone,
		loadCatalog: loadFloatingModelCatalog,
		overlay: () => readOrbAgentModels(paths.profile).overlay,
		background: () => readOrbAgentModels(paths.profile).background,
		onSelectOverlay: persistOverlayModel,
		onSelectBackground: persistBackgroundModel,
		selection: () => context.service("selection")?.model(),
		onSelectSelection: (selection) => {
			context.service("selection")?.setModel(selection);
		}
	}, environment.standalone ? void 0 : {
		enabled: () => readMillifractionCoordinates(paths.profile).enabled,
		toggle: () => {
			const current = readMillifractionCoordinates(paths.profile).enabled;
			confirmMillifractionEnabled(!current, floatingShell);
		}
	}, () => {
		Promise.resolve(capture.open()).catch((error) => {
			console.error(error);
		});
	}));
	const floatingWindow = floatingShell;
	floatingWindow.once("ready-to-show", () => {
		floatingWindow.showInactive();
	});
	floatingWindow.on("focus", () => {
		publishTcc();
	});
	await floatingWindow.loadURL(`${SCHEME}://shell/floating.html`);
	const ensureObservationFrameWindow = () => {
		if (observationFrameWindow !== void 0 && !observationFrameWindow.isDestroyed()) return;
		observationFrameWindow = context.own(createObservationFrameWindow());
		observationFrameWindow.once("closed", () => {
			observationFrameWindow = void 0;
		});
		observationFrameWindow.loadURL(`${SCHEME}://shell/observation-frame.html`);
	};
	const blurMainIfFocused = () => {
		const window = mainWindow;
		if (window === void 0 || window.isDestroyed() || !window.isFocused()) return;
		window.blur();
	};
	const restoreOverlayGuard = () => {
		hideObservationFrame(observationFrameWindow);
		if (!floatingShell.isDestroyed()) resetFloatingOverlayGuard(floatingShell);
		const toolbarWindow = context.service("selection")?.window();
		if (toolbarWindow !== void 0 && !toolbarWindow.isDestroyed()) resetFloatingOverlayGuard(toolbarWindow);
		context.service("selection")?.setHidInput(false);
	};
	context.onStop(restoreOverlayGuard);
	context.onStop(() => {
		delete orbHostHandlers.onOverlayGuard;
		delete orbHostHandlers.onObservationFrame;
		delete orbHostHandlers.onSckCapture;
	});
	orbHostHandlers.onOverlayGuard = (event) => {
		if (floatingShell.isDestroyed()) return [];
		applyFloatingOverlayGuard(floatingShell, event.mode, event.action);
		const toolbarWindow = context.service("selection")?.window();
		if (toolbarWindow !== void 0 && !toolbarWindow.isDestroyed()) applyFloatingOverlayGuard(toolbarWindow, event.mode, event.action);
		if (event.mode === "input") context.service("selection")?.setHidInput(event.action === "begin");
		const ids = overlayWindowExcludeIds(floatingShell, toolbarWindow, observationFrameWindow);
		if (event.mode === "input" && event.action === "begin") {
			blurMainIfFocused();
			try {
				context.service("selection")?.restoreLastFrontApp();
			} catch (error) {
				console.error("dsh desktop: restore front app failed", error);
			}
			return overlayGuardInputApplyDelay().then(() => ids);
		}
		return ids;
	};
	orbHostHandlers.onObservationFrame = (event) => {
		if (event.bounds === null) {
			hideObservationFrame(observationFrameWindow);
			return;
		}
		ensureObservationFrameWindow();
		if (observationFrameWindow === void 0 || observationFrameWindow.isDestroyed()) return;
		showObservationFrame(observationFrameWindow, event.bounds);
		raiseOverlayAboveObservationFrame(floatingShell, context.service("selection")?.window());
	};
	orbHostHandlers.onSckCapture = (event) => captureExcludedRegionOnElectron({
		region: event.region,
		excludeWindowIds: event.excludeWindowIds,
		output: event.output
	});
	context.handle(DESKTOP_IPC.floatingMove, (event, x, y, canDock) => {
		shellSender(event);
		if (typeof x !== "number" || typeof y !== "number") throw new Error("dsh desktop: invalid floating move");
		return moveFloatingBall(floatingWindow, x, y, canDock !== false);
	});
	context.handle(DESKTOP_IPC.floatingClamp, (event, canDock) => {
		shellSender(event);
		return clampFloatingWindow(floatingWindow, canDock !== false);
	});
	context.handle(DESKTOP_IPC.floatingUnsnap, (event) => {
		shellSender(event);
		return unsnapDockedBall(floatingWindow);
	});
	context.handle(DESKTOP_IPC.floatingSetExpanded, (event, expanded) => {
		shellSender(event);
		return setFloatingExpanded(floatingWindow, expanded === true);
	});
	context.handle(DESKTOP_IPC.floatingCatalogGet, (event) => {
		shellSender(event);
		return context.sessionCatalog();
	});
	context.handle(DESKTOP_IPC.floatingNavigate, (event, input) => {
		shellSender(event);
		if (typeof input !== "object" || input === null || !("action" in input) || ![
			"request",
			"new",
			"select"
		].includes(String(input.action)) || input.action === "select" && (!("sessionId" in input) || typeof input.sessionId !== "string")) throw new Error("会话切换参数无效");
		const main = environment.mainWindow();
		if (!main || main.isDestroyed()) throw new Error("主窗口未就绪");
		main.webContents.send(DESKTOP_IPC.floatingNavigate, input);
	});
	let followedSession = null;
	context.handle(DESKTOP_IPC.floatingFollowSession, (event, sessionId) => {
		const mainSender = mainWindow !== void 0 && event.sender === mainWindow.webContents && event.senderFrame === event.sender.mainFrame;
		const shellClear = event.sender === floatingWindow.webContents && event.senderFrame === event.sender.mainFrame && sessionId === null;
		if (!mainSender && !shellClear) throw new Error("dsh desktop: rejected project follow IPC");
		if (sessionId !== null && (typeof sessionId !== "string" || sessionId.length === 0 || sessionId.length > 256 || /[\s\x00-\x08\x0e-\x1f]/.test(sessionId))) throw new Error("dsh desktop: invalid project session");
		followedSession = sessionId;
		if (!floatingWindow.isDestroyed()) floatingWindow.webContents.send(DESKTOP_IPC.floatingFollowSession, followedSession);
	});
	context.handle(DESKTOP_IPC.floatingFollowState, (event) => {
		shellSender(event);
		return followedSession;
	});
	context.handle(DESKTOP_IPC.floatingSessionGet, (event) => {
		shellSender(event);
		return readFloatingSessionId(paths.profile);
	});
	context.handle(DESKTOP_IPC.floatingSessionSet, (event, sessionId) => {
		shellSender(event);
		if (typeof sessionId !== "string" || sessionId === "") throw new Error("dsh desktop: invalid floating session");
		writeFloatingSessionId(paths.profile, sessionId);
	});
	context.handle(DESKTOP_IPC.floatingOverlayModelGet, (event) => {
		shellSender(event);
		return readOrbAgentModels(paths.profile).overlay;
	});
	context.handle(DESKTOP_IPC.floatingOverlayPermissionGet, (event) => {
		shellSender(event);
		return readOrbPermission(paths.profile);
	});
	context.handle(DESKTOP_IPC.floatingOrbWorkspace, (event) => {
		shellSender(event);
		ensureOrbWorkspaceDir(paths.orbWorkspace);
		return paths.orbWorkspace;
	});
	context.handle(DESKTOP_IPC.floatingFocusMain, (event) => {
		shellSender(event);
		context.showMain();
	});
	context.handle(DESKTOP_IPC.floatingQuit, (event) => {
		shellSender(event);
		app.quit();
	});
	context.handle(DESKTOP_IPC.floatingOverlayPermissionSet, async (event, preset, sessionId) => {
		shellSender(event);
		if (!isOrbPermissionPreset(preset)) throw new Error("dsh desktop: overlay permission must be a known Access preset");
		const id = typeof sessionId === "string" && sessionId !== "" ? sessionId : void 0;
		if (environment.standalone && id !== void 0) {
			const response = await context.request("/.dsh/native-command", JSON.stringify({
				command: "permission",
				payload: {
					preset,
					sessionId: id
				}
			}));
			if (!response.ok) throw new Error(`Permission update HTTP ${response.status}`);
			await response.arrayBuffer();
		} else if (!environment.standalone) environment.host()?.sendOrb({
			type: "orb-permission",
			preset,
			...id === void 0 ? {} : { sessionId: id }
		});
		writeOrbPermission(paths.profile, preset);
	});
	context.handle(DESKTOP_IPC.floatingRunning, (event, running) => {
		shellSender(event);
		if (typeof running !== "boolean") throw new Error("dsh desktop: floating running requires a boolean");
		sessionRunning = running;
		context.service("selection")?.setSessionRunning(running);
	});
	context.handle(DESKTOP_IPC.floatingEditing, (event, editing) => {
		shellSender(event);
		if (typeof editing !== "boolean") throw new Error("dsh desktop: floating editing requires a boolean");
		overlayTextEditing = editing;
	});
	context.handle(DESKTOP_IPC.floatingRestoreFront, (event) => {
		shellSender(event);
		if (!sessionRunning || overlayTextEditing) return;
		context.service("selection")?.restoreFrontApp();
	});
	context.handle(DESKTOP_IPC.floatingAvatarGet, (event) => {
		shellSender(event);
		return orbAvatarUrl("shell", orbAvatarCacheToken(paths.profile));
	});
	context.handle(DESKTOP_IPC.floatingTccGet, (event) => {
		shellSender(event);
		return tcc.status();
	});
	context.handle(DESKTOP_IPC.floatingTccOpen, async (event, right) => {
		shellSender(event);
		if (!isTccRight(right)) throw new Error("dsh desktop: TCC right must be screen or accessibility");
		await tcc.open(right);
		return publishTcc();
	});
	context.handle(DESKTOP_IPC.floatingTccRelaunch, (event) => {
		shellSender(event);
		app.relaunch();
		app.quit();
	});
	context.handle(DESKTOP_IPC.orbSnapshot, (event) => {
		assertProductSender(event);
		return orbSnapshotFor("app");
	});
	context.handle(DESKTOP_IPC.orbPickAvatar, async (event) => {
		assertProductSender(event);
		assertOrbSettingsWritable(process.platform);
		const parent = BrowserWindow.fromWebContents(event.sender);
		const options = {
			properties: ["openFile"],
			filters: [{
				name: "Images",
				extensions: [
					"gif",
					"png",
					"webp"
				]
			}]
		};
		const picked = parent === null ? await dialog.showOpenDialog(options) : await dialog.showOpenDialog(parent, options);
		const filePath = picked.filePaths[0];
		if (picked.canceled || filePath === void 0) return {
			ok: false,
			error: "cancelled"
		};
		const installed = installOrbAvatarFromPath(paths.profile, filePath);
		if (!installed.ok) return installed;
		publishAvatar();
		return {
			ok: true,
			snapshot: orbSnapshotFor("app")
		};
	});
	context.handle(DESKTOP_IPC.orbRestoreAvatar, (event) => {
		assertProductSender(event);
		assertOrbSettingsWritable(process.platform);
		restoreOrbAvatar(paths.profile);
		publishAvatar();
		return orbSnapshotFor("app");
	});
	context.handle(DESKTOP_IPC.orbSetOverlayModel, (event, selection) => {
		assertProductSender(event);
		assertOrbSettingsWritable(process.platform);
		if (!isOrbAgentModelSelection(selection)) throw new Error("dsh desktop: overlay model selection is invalid");
		persistOverlayModel(selection);
	});
	context.handle(DESKTOP_IPC.orbSetBackgroundModel, (event, selection) => {
		assertProductSender(event);
		assertOrbSettingsWritable(process.platform);
		if (!isOrbAgentModelSelection(selection)) throw new Error("dsh desktop: background model selection is invalid");
		persistBackgroundModel(selection);
	});
	context.handle(DESKTOP_IPC.orbSetSelectionEnabled, (event, enabled) => {
		assertProductSender(event);
		assertOrbSettingsWritable(process.platform);
		if (typeof enabled !== "boolean") throw new Error("dsh desktop: selection enablement requires a boolean");
		const selection = context.service("selection");
		if (!selection) throw new Error(environment.locale().messages.desktopMissingSelectionPlugin);
		selection.setEnabled(enabled);
	});
	context.handle(DESKTOP_IPC.orbSetMillifractionEnabled, async (event, enabled) => {
		assertProductSender(event);
		assertOrbSettingsWritable(process.platform);
		if (typeof enabled !== "boolean") throw new Error("dsh desktop: millifraction enablement requires a boolean");
		const parent = BrowserWindow.fromWebContents(event.sender);
		return confirmMillifractionEnabled(enabled, parent === null ? void 0 : parent);
	});
	context.handle(DESKTOP_IPC.orbOpenTcc, async (event, right) => {
		assertProductSender(event);
		assertOrbSettingsWritable(process.platform);
		if (!isTccRight(right)) throw new Error("dsh desktop: TCC right must be screen or accessibility");
		await tcc.open(right);
		publishTcc();
		return orbSnapshotFor("app");
	});
	context.onReady(pushStoredOrbPreferences);
	context.onGuardReset(restoreOverlayGuard);
	context.onActivate(() => {
		const window = floatingShell;
		if (window.isDestroyed() || !window.isVisible() || !sessionRunning || overlayTextEditing) return;
		const point = screen.getCursorScreenPoint();
		const bounds = window.getBounds();
		if (point.x < bounds.x || point.y < bounds.y || point.x >= bounds.x + bounds.width || point.y >= bounds.y + bounds.height) return;
		blurMainIfFocused();
		context.service("selection")?.restoreLastFrontApp();
	});
	context.provide("orb", {
		supported: () => orbSettingsSupported(process.platform),
		systemPermissions: () => tcc.status(),
		async openSystemPermission(right) {
			await tcc.open(right);
			return publishTcc();
		},
		refreshAvatar: publishAvatar,
		sendSelection(text, attach) {
			if (floatingShell.isDestroyed()) throw new Error("悬浮球尚未就绪");
			if (attach) {
				floatingShell.show();
				floatingShell.focus();
			} else floatingShell.showInactive();
			floatingShell.webContents.send(attach ? DESKTOP_IPC.selectionAttach : DESKTOP_IPC.selectionPrompt, { text });
		}
	});
	context.protocol((request) => {
		const url = new URL(request.url);
		if (url.pathname !== "/orb-avatar" || !["shell", "app"].includes(url.hostname)) return void 0;
		return serveOrbAvatar(paths.profile, join(context.extension.assets, DEFAULT_ORB_AVATAR_FILE), request.method);
	});
}
export { activate, shellAssets };
