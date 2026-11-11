import { i as installOrbAvatarFromBytes, l as readCustomOrbAvatarDataUrl, u as restoreOrbAvatar } from "./orb-avatar-DgC5zfjx.js";
import { n as readDesktopToolsConfig, r as writeDesktopToolsConfig, t as parseDesktopToolsConfig } from "./desktop-tools-config-CoArygqo.js";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import z from "@deepseek-ai/schemastery";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { SessionId } from "@deepseek-ai/dsh-session/types";
// source/apps/desktop/native-extension-runtime/capture-vision.ts
/** Host 侧对前置插件 dsh-vision-router 的检测、一键安装与 OCR 调用。 */
/** 前置插件的 npm 包名。 */
const VISION_ROUTER_PACKAGE = "dsh-vision-router";
const MAX_OCR_BYTES = 3e7;
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
* 读取 vision-router 当前状态。
* @param ctx Host 上下文。
* @returns 可调用、未安装、未启用或视觉工具关闭。
*/
async function captureVisionStatus(ctx) {
	if (ctx.get("tools")?.get("vision_ocr") !== void 0) return { state: "ready" };
	const manager = ctx.get("pluginManager");
	if (manager === void 0) return { state: "unknown" };
	try {
		const bundle = (await manager.listBundles()).find((item) => item.name === VISION_ROUTER_PACKAGE);
		const version = bundle?.version === void 0 ? {} : { version: bundle.version };
		if (bundle === void 0 || !bundle.installed) return { state: "missing" };
		return {
			state: bundle.enabled ? "tool-off" : "disabled",
			...version
		};
	} catch {
		return { state: "unknown" };
	}
}
/**
* 用户确认后安装并启用 vision-router。
* @param ctx Host 上下文。
* @returns 是否需要重启 DSH 才能生效。
*/
async function installCaptureVision(ctx) {
	const manager = ctx.get("pluginManager");
	if (manager === void 0) throw new Error(`当前 DSH 未提供插件管理器，请在终端运行 dsh plugin add ${VISION_ROUTER_PACKAGE}`);
	const before = await captureVisionStatus(ctx);
	const result = before.state === "disabled" ? await manager.setBundleEnabled(VISION_ROUTER_PACKAGE, true) : before.state === "missing" || before.state === "unknown" ? await manager.installBundle(VISION_ROUTER_PACKAGE) : void 0;
	if (result !== void 0 && (result.application === "failed" || result.application === "cancelled")) throw new Error(`安装 ${VISION_ROUTER_PACKAGE} 未完成（${result.application}），请在 DSH 插件管理中查看原因`);
	const status = await captureVisionStatus(ctx);
	return {
		status,
		restartRequired: status.state !== "ready"
	};
}
/** 从工具结果中取出 vision-router 的 JSON 文本。 */
function ocrPayload(result) {
	if (!isRecord$1(result)) throw new Error("OCR 工具没有返回结果");
	if (result.isError === true) {
		const error = isRecord$1(result.error) && typeof result.error.message === "string" ? result.error.message : "OCR 工具执行失败";
		throw new Error(error);
	}
	const candidates = [result.value];
	if (Array.isArray(result.content)) candidates.push(result.content.map((block) => isRecord$1(block) && typeof block.text === "string" ? block.text : "").join(""));
	for (const candidate of candidates) {
		if (isRecord$1(candidate)) return candidate;
		if (typeof candidate === "string" && candidate.trim() !== "") try {
			const parsed = JSON.parse(candidate);
			if (isRecord$1(parsed)) return parsed;
		} catch {
			return {
				text: candidate,
				engine: "unknown"
			};
		}
	}
	throw new Error("OCR 工具返回了无法识别的结果");
}
/**
* 调用 vision-router 识别 PNG 中的文字；临时文件写在 profile 内并在结束后删除。
* @param ctx Host 上下文。
* @param png 图片字节。
* @param long 是否为长截图（使用分片识别）。
* @param signal 取消信号。
* @returns 识别文本。
*/
async function runCaptureOcr(ctx, png, long, signal) {
	if (png.byteLength === 0 || png.byteLength > MAX_OCR_BYTES) throw new Error("待识别图片为空或超过 30 MB");
	const tools = ctx.get("tools");
	const name = long ? "vision_long_screenshot_ocr" : "vision_ocr";
	if (tools?.get(name) === void 0) throw new Error(`需要启用 ${VISION_ROUTER_PACKAGE} 并打开其视觉工具`);
	const directory = join(ctx.profileContext.dir, "desktop-tools", "ocr");
	await mkdir(directory, { recursive: true });
	const path = join(directory, `capture-${randomUUID()}.png`);
	try {
		await writeFile(path, png, { flag: "wx" });
		const payload = ocrPayload((await tools.execute({
			calls: [{
				type: "tool-call",
				id: randomUUID(),
				name,
				arguments: JSON.stringify({
					image: path,
					engine: "auto"
				})
			}],
			signal
		})).results[0]?.result);
		if (payload.ok === false) throw new Error(typeof payload.message === "string" ? payload.message : typeof payload.code === "string" ? payload.code : "OCR 识别失败");
		return {
			text: (typeof payload.text === "string" ? payload.text : typeof payload.markdown === "string" ? payload.markdown : "").trim(),
			engine: typeof payload.engine === "string" ? payload.engine : "unknown",
			uncertain: payload.uncertain === true
		};
	} finally {
		await rm(path, { force: true }).catch(() => {});
	}
}
// source/apps/desktop/native-extension-runtime/desktop-tools-service.ts
const FEATURE_ORDER = [
	"capture",
	"selection",
	"floatingBall"
];
/** 配置写入成功与原生功能应用成功分别报告，单项启动失败不会阻止其他功能。 */
var DesktopToolsController = class {
	options;
	config;
	runtime;
	releases = /* @__PURE__ */ new Map();
	statuses = /* @__PURE__ */ new Map();
	queue = Promise.resolve();
	runtimeError;
	closed = false;
	vision = { state: "unknown" };
	/** @param options profile、包目录和辅助进程工厂。 */
	constructor(options) {
		this.options = options;
		this.config = readDesktopToolsConfig(options.profileDir);
		for (const id of FEATURE_ORDER) this.statuses.set(id, { phase: "disabled" });
	}
	/** @returns 当前配置与实际运行状态。 */
	snapshot() {
		const features = Object.fromEntries(FEATURE_ORDER.map((id) => [id, this.statuses.get(id) ?? { phase: "disabled" }]));
		const states = Object.values(features);
		return {
			config: parseDesktopToolsConfig(this.config),
			platform: process.platform,
			vision: this.vision,
			runtime: this.runtime === void 0 ? "stopped" : this.runtimeError !== void 0 || states.some((item) => item.phase === "error") ? "degraded" : "running",
			features
		};
	}
	/** @returns 首次后台应用完成后的状态。 */
	start() {
		return this.exclusive(() => this.reconcile());
	}
	/** @param input 完整的新配置。 @returns 保存与应用结果。 */
	async update(input) {
		const config = parseDesktopToolsConfig(input);
		writeDesktopToolsConfig(this.options.profileDir, config);
		this.config = config;
		try {
			const snapshot = await this.exclusive(() => this.reconcile());
			return {
				saved: true,
				applied: this.isApplied(snapshot),
				snapshot
			};
		} catch (error) {
			this.options.ctx.logger.error("桌面工具已保存但应用失败: %s", error instanceof Error ? error.message : String(error));
			return {
				saved: true,
				applied: false,
				snapshot: this.snapshot()
			};
		}
	}
	/** @returns 重新创建辅助进程后的状态。 */
	restart() {
		return this.exclusive(() => this.reconcile());
	}
	/** @returns 重新读取前置视觉插件状态后的快照。 */
	async refreshedSnapshot() {
		this.vision = await captureVisionStatus(this.options.ctx);
		return this.snapshot();
	}
	/** @returns 安装或启用 dsh-vision-router 后的状态与是否需要重启。 */
	async installVision() {
		const result = await installCaptureVision(this.options.ctx);
		this.vision = result.status;
		return {
			snapshot: this.snapshot(),
			restartRequired: result.restartRequired
		};
	}
	/** @param mode 截图、录屏或长截图。 */
	async openCapture(mode) {
		if (!(mode === "video" ? this.config.recording.enabled : this.config.screenshot.enabled)) throw new Error(mode === "video" ? "录屏功能未启用" : "截图功能未启用");
		if (this.statuses.get("capture")?.phase !== "active" || this.runtime === void 0) throw new Error("截图录屏功能尚未就绪");
		await this.runtime.command("capture-open", { mode });
	}
	/** @returns 当前系统权限状态。 @throws 悬浮球或辅助进程尚未运行时拒绝。 */
	async systemPermissions() {
		if (this.runtime === void 0 || this.statuses.get("floatingBall")?.phase !== "active") throw new Error("悬浮球功能尚未就绪");
		return this.runtime.command("permissions-status", {});
	}
	/** @param right 要打开的系统权限类别。 @returns 更新后的系统权限状态。 */
	async openSystemPermission(right) {
		if (this.runtime === void 0 || this.statuses.get("floatingBall")?.phase !== "active") throw new Error("悬浮球功能尚未就绪");
		return this.runtime.command("permission-open", { right });
	}
	/** @returns 当前自定义头像的 data URL，未设置时省略。 */
	avatar() {
		const dataUrl = readCustomOrbAvatarDataUrl(this.options.profileDir);
		return dataUrl === void 0 ? {} : { dataUrl };
	}
	/** @param bytes 图片字节。 @param fileName 用户选择的文件名。 @returns 保存和 Helper 刷新状态。 */
	async setAvatar(bytes, fileName) {
		const result = installOrbAvatarFromBytes(this.options.profileDir, bytes, fileName);
		if (!result.ok) throw new Error(result.error === "too-large" ? "头像图片不能超过 2 MB" : "头像必须是有效的 GIF、PNG 或 WebP 图片");
		if (this.runtime === void 0 || this.statuses.get("floatingBall")?.phase !== "active") return {
			saved: true,
			applied: false
		};
		try {
			await this.runtime.command("avatar-refresh", {});
			return {
				saved: true,
				applied: true
			};
		} catch (error) {
			return {
				saved: true,
				applied: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
	/** @returns 恢复内置头像后的 Helper 刷新状态。 */
	async restoreAvatar() {
		restoreOrbAvatar(this.options.profileDir);
		if (this.runtime === void 0 || this.statuses.get("floatingBall")?.phase !== "active") return {
			saved: true,
			applied: false
		};
		try {
			await this.runtime.command("avatar-refresh", {});
			return {
				saved: true,
				applied: true
			};
		} catch (error) {
			return {
				saved: true,
				applied: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
	/** @returns 所有功能和辅助进程已停止。 */
	dispose() {
		this.closed = true;
		return this.exclusive(async () => {
			await this.stopCurrent();
			return this.snapshot();
		}).then(() => void 0);
	}
	exclusive(operation) {
		const result = this.queue.then(operation);
		this.queue = result.then(() => void 0, () => void 0);
		return result;
	}
	async reconcile() {
		if (this.closed) throw new Error("桌面工具控制器已关闭");
		await this.stopCurrent();
		const enabled = this.enabledFeatures();
		if (enabled.length === 0) return this.snapshot();
		const runtime = this.options.createRuntime((error) => {
			this.runtimeFailed(error);
		});
		this.runtime = runtime;
		this.runtimeError = void 0;
		for (const id of enabled) {
			this.statuses.set(id, { phase: "starting" });
			try {
				const release = await runtime.activate(this.descriptor(id));
				this.releases.set(id, release);
				this.statuses.set(id, { phase: "active" });
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				this.statuses.set(id, {
					phase: "error",
					error: message
				});
				this.options.ctx.logger.error("桌面工具功能启动失败 (%s): %s", id, message);
			}
		}
		if (this.releases.size === 0) try {
			await runtime.dispose();
			if (this.runtime === runtime) this.runtime = void 0;
		} catch (error) {
			this.runtimeError = error instanceof Error ? error.message : String(error);
			this.options.ctx.logger.error("桌面工具辅助进程清理失败: %s", this.runtimeError);
		}
		return this.snapshot();
	}
	async stopCurrent() {
		const runtime = this.runtime;
		const failures = [];
		for (const id of [...FEATURE_ORDER].reverse()) {
			const release = this.releases.get(id);
			if (release === void 0) continue;
			try {
				await release();
				this.releases.delete(id);
				this.statuses.set(id, { phase: "disabled" });
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				this.statuses.set(id, {
					phase: "error",
					error: message
				});
				failures.push(error);
			}
		}
		if (failures.length > 0) throw new AggregateError(failures, "桌面工具停止失败，未启动新的辅助进程");
		if (runtime !== void 0) try {
			await runtime.dispose();
			if (this.runtime === runtime) this.runtime = void 0;
			this.runtimeError = void 0;
		} catch (error) {
			this.runtimeError = error instanceof Error ? error.message : String(error);
			throw new AggregateError([error], "桌面工具辅助进程清理失败，未启动新的辅助进程");
		}
		for (const id of FEATURE_ORDER) this.statuses.set(id, { phase: "disabled" });
	}
	enabledFeatures() {
		return FEATURE_ORDER.filter((id) => {
			if (id === "capture") return this.config.screenshot.enabled || this.config.recording.enabled;
			if (id === "selection") return this.config.selection.enabled;
			return this.config.floatingBall.enabled;
		});
	}
	descriptor(id) {
		const entry = id === "capture" ? "dist/capture.js" : id === "selection" ? "dist/selection.js" : "dist/floating.js";
		return {
			id: id === "capture" ? "dsh-capture" : id === "selection" ? "dsh-selection-toolbar" : "dsh-floating-ball",
			root: this.options.root,
			entry,
			assets: "assets"
		};
	}
	runtimeFailed(error) {
		if (this.runtime === void 0) return;
		for (const id of FEATURE_ORDER) if (this.statuses.get(id)?.phase === "active" || this.statuses.get(id)?.phase === "starting") this.statuses.set(id, {
			phase: "error",
			error: error.message
		});
	}
	isApplied(snapshot) {
		return FEATURE_ORDER.every((id) => {
			const expected = id === "capture" ? snapshot.config.screenshot.enabled || snapshot.config.recording.enabled : id === "selection" ? snapshot.config.selection.enabled : snapshot.config.floatingBall.enabled;
			return snapshot.features[id].phase === (expected ? "active" : "disabled");
		});
	}
};
/** 通过 Gateway 公开给设置客户端的方法。 */
const REMOTE_METHODS = [
	"snapshot",
	"installVision",
	"update",
	"restart",
	"openCapture",
	"avatar",
	"setAvatar",
	"restoreAvatar",
	"systemPermissions",
	"openSystemPermission"
];
/**
* 按 TC39 标准装饰器语义为实例方法应用 Remote 标记。
* 打包器只会把装饰器语法降级为旧式 `(target, key, descriptor)` 调用，
* 而 typert-protocol 的 Remote 只接受标准 `(method, context)` 形式，因此不使用装饰器语法。
* @param instance 刚完成 super() 的服务实例。
* @param names 需要公开的公共实例方法名。
*/
function markRemoteMethods(instance, names) {
	const prototype = Object.getPrototypeOf(instance);
	for (const name of names) {
		const method = prototype[name];
		if (typeof method !== "function") throw new TypeError(`桌面工具 Remote 方法不存在: ${name}`);
		const initializers = [];
		Remote(method, {
			kind: "method",
			name,
			static: false,
			private: false,
			metadata: {},
			access: {
				has: (target) => name in target,
				get: (target) => target[name]
			},
			addInitializer: (initializer) => {
				initializers.push(initializer);
			}
		});
		for (const initializer of initializers) initializer.call(instance);
	}
}
/** 设置客户端使用的桌面工具 Remote 服务。 */
var DesktopToolsService = class extends TypertRemoteService {
	controller;
	/** @param ctx Cordis Host。 @param controller 桌面工具控制器。 */
	constructor(ctx, controller) {
		super(ctx, "desktopTools");
		this.controller = controller;
		markRemoteMethods(this, REMOTE_METHODS);
	}
	/** @returns 当前配置与实际运行状态。 */
	snapshot() {
		return this.controller.refreshedSnapshot();
	}
	/** @returns 安装或启用前置插件 dsh-vision-router 的结果。 */
	installVision() {
		return this.controller.installVision();
	}
	/** @param config 完整的新配置。 @returns 保存与应用结果。 */
	update(config) {
		return this.controller.update(config);
	}
	/** @returns 重新创建辅助进程后的状态。 */
	restart() {
		return this.controller.restart();
	}
	/** @param mode 截图、录屏或长截图。 */
	async openCapture(mode) {
		await this.controller.openCapture(mode);
		return { opened: true };
	}
	/** @returns 当前自定义头像的 data URL，未设置时省略。 */
	avatar() {
		return this.controller.avatar();
	}
	/** @param bytes 图片内容。 @param fileName 用户选择的文件名。 */
	setAvatar(dataUrl, fileName) {
		const match = /^data:image\/(?:gif|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/u.exec(dataUrl);
		if (match === null || dataUrl.length > 28e5) throw new Error("头像图片数据无效或超过 2 MB");
		const encoded = match[1];
		if (encoded === void 0) throw new Error("头像图片数据无效");
		const bytes = Buffer.from(encoded, "base64");
		if (bytes.toString("base64") !== encoded) throw new Error("头像图片数据无效");
		return this.controller.setAvatar(bytes, fileName);
	}
	/** @returns 恢复头像后的持久化与 Helper 应用状态。 */
	restoreAvatar() {
		return this.controller.restoreAvatar();
	}
	/** @returns 系统权限状态。 */
	systemPermissions() {
		return this.controller.systemPermissions();
	}
	/** @param right 要打开的系统权限类别。 */
	openSystemPermission(right) {
		return this.controller.openSystemPermission(right);
	}
};
// source/apps/desktop/native-extension-runtime/host.ts
const RPC_PATHS = new Set([
	"workspace/create",
	"workspace/rename",
	"session/create",
	"session/projections",
	"session/selectModel",
	"session/rename",
	"session/prompt",
	"session/cancel",
	"session/list",
	"session/modelCatalog",
	"$events/result"
].map((endpoint) => `/api/${endpoint}`));
const STREAM_ENDPOINTS = /* @__PURE__ */ new Set(["session/follow", "$events"]);
var NativeRequestError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.code = code;
	}
};
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function* emptyUplink() {}
function requestFailure(code, message) {
	throw new NativeRequestError(code, message);
}
/** 截图识别图片的 base64 上限，约对应 30 MB PNG。 */
const MAX_OCR_BASE64 = 4e7;
async function applyCommand(ctx, body, signal) {
	if (!isRecord(body) || typeof body.command !== "string") requestFailure("native/command-invalid", "原生命令格式无效。");
	switch (body.command) {
		case "permission": return applyPermission(ctx, body);
		case "vision-status": return Response.json({
			ok: true,
			value: await captureVisionStatus(ctx)
		});
		case "vision-install": return Response.json({
			ok: true,
			value: await installCaptureVision(ctx)
		});
		case "vision-ocr": {
			const payload = isRecord(body.payload) ? body.payload : {};
			if (typeof payload.data !== "string" || payload.data.length > MAX_OCR_BASE64 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(payload.data)) requestFailure("native/ocr-invalid", "待识别图片格式无效或过大。");
			const png = Buffer.from(payload.data, "base64");
			return Response.json({
				ok: true,
				value: await runCaptureOcr(ctx, png, payload.long === true, signal)
			});
		}
		default: requestFailure("native/command-invalid", "原生命令不受支持。");
	}
}
async function applyPermission(ctx, body) {
	if (!isRecord(body.payload)) requestFailure("native/command-invalid", "原生权限命令格式无效。");
	const { preset, sessionId } = body.payload;
	if (preset !== "read-only" && preset !== "workspace-write" && preset !== "danger-full-access" || typeof sessionId !== "string" || sessionId === "") requestFailure("native/permission-invalid", "请选择有效权限和已创建的悬浮球会话。");
	const presets = ctx.get("permissionPresets");
	const sessions = ctx.get("sessions");
	if (presets === void 0 || sessions === void 0) requestFailure("native/permission-unavailable", "当前 DSH 未启用会话权限服务。");
	const session = sessions.get(SessionId(sessionId));
	if (session === void 0) requestFailure("native/session-unavailable", "目标会话已关闭，请重新创建悬浮球会话。");
	await presets.set(session, preset);
	return Response.json({ ok: true });
}
/**
* 创建使用官方 Connection 和 Gateway 服务的原生请求桥。
* @param ctx - 已挂载 Connection、Gateway 的 Host 上下文。
* @param send - 将响应发送到本桥所属原生进程的同步发送器。
* @returns 拥有请求取消和停用清理的桥接器。
*/
function createNativeHostBridge(ctx, send) {
	const requests = /* @__PURE__ */ new Map();
	const rpc = ctx.connection.createSharedFetchHandler("/api");
	let disposed = false;
	function chunk(id, data) {
		send({
			type: "dsh-native-chunk",
			id,
			data: (typeof data === "string" ? Buffer.from(data) : Buffer.from(data)).toString("base64")
		});
	}
	async function respond(id, response, signal) {
		signal.throwIfAborted();
		send({
			type: "dsh-native-response",
			id,
			status: response.status,
			headers: { "content-type": response.headers.get("content-type") ?? "application/octet-stream" }
		});
		if (response.body !== null) for await (const value of response.body) {
			signal.throwIfAborted();
			chunk(id, value);
		}
		signal.throwIfAborted();
		send({
			type: "dsh-native-end",
			id
		});
	}
	async function run(id, path, body, control) {
		const peer = ctx.connection.browserPeer;
		const signal = AbortSignal.any([control.signal, peer.signal]);
		try {
			signal.throwIfAborted();
			if (path === "/.dsh/remote-stream") {
				const parsed = JSON.parse(body);
				if (!isRecord(parsed) || typeof parsed.endpoint !== "string" || !STREAM_ENDPOINTS.has(parsed.endpoint) || !Object.hasOwn(parsed, "payload")) requestFailure("native/stream-invalid", "原生插件请求了未支持的会话流。");
				const stream = await ctx.typertGateway.wireStream.open(parsed.endpoint, parsed.payload, emptyUplink(), peer, signal);
				signal.throwIfAborted();
				send({
					type: "dsh-native-response",
					id,
					status: 200,
					headers: { "content-type": "application/x-ndjson" }
				});
				for await (const value of stream) {
					signal.throwIfAborted();
					chunk(id, `${JSON.stringify(value)}\n`);
				}
				signal.throwIfAborted();
				send({
					type: "dsh-native-end",
					id
				});
			} else if (path === "/.dsh/native-command") await respond(id, await applyCommand(ctx, JSON.parse(body), signal), signal);
			else if (RPC_PATHS.has(path)) await respond(id, await rpc.fetch(new Request(`http://dsh-native.local${path}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body,
				signal
			}), peer), signal);
			else requestFailure("native/path-unsupported", "原生插件请求了未支持的 Host 接口。");
		} catch (error) {
			if (control.signal.aborted || disposed) return;
			const failure = peer.signal.aborted ? {
				code: "native/host-disconnected",
				message: "DSH 会话服务已断开，请重新启用原生插件。"
			} : error instanceof NativeRequestError ? error : ctx.typertGateway.wireStream.failure(error);
			send({
				type: "dsh-native-error",
				id,
				error: {
					code: failure.code,
					message: failure.message
				}
			});
		} finally {
			if (requests.get(id) === control) requests.delete(id);
		}
	}
	return {
		handle(message) {
			if (!isRecord(message) || message.type !== "dsh-native-request" && message.type !== "dsh-native-cancel") return false;
			if (typeof message.id !== "string" || message.id === "") return true;
			const id = message.id;
			if (message.type === "dsh-native-cancel") {
				requests.get(id)?.abort();
				return true;
			}
			if (disposed || typeof message.path !== "string" || typeof message.body !== "string" || requests.has(id)) {
				send({
					type: "dsh-native-error",
					id,
					error: {
						code: "native/request-invalid",
						message: "原生请求已关闭、格式无效或标识重复。"
					}
				});
				return true;
			}
			const control = new AbortController();
			requests.set(id, control);
			run(id, message.path, message.body, control);
			return true;
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			for (const control of requests.values()) control.abort();
			requests.clear();
		}
	};
}
// source/apps/desktop/native-extension-runtime/index.ts
/** 官方 DSH 通过可注入服务管理独立原生插件，不依赖桌面扩展 API。 */
/** 原生插件共用的 Electron 进程；每个插件独立等待激活和释放回执。 */
var NativeRuntime = class {
	ctx;
	config;
	onFailure;
	child;
	started;
	closed = false;
	failure;
	waiting = /* @__PURE__ */ new Map();
	bridge;
	exit;
	stopping;
	disposing;
	/** @param ctx 官方服务与当前配置目录。 @param config 进程等待时限与可执行文件覆盖。 */
	constructor(ctx, config, onFailure) {
		this.ctx = ctx;
		this.config = config;
		this.onFailure = onFailure;
		this.bridge = createNativeHostBridge(ctx, (message) => this.send(message));
	}
	/** @param descriptor 安装包拥有的入口和资源。 @returns 仅释放本插件的操作。 */
	async activate(descriptor) {
		await this.start();
		await this.operation("activate", descriptor);
		let released;
		return () => {
			released ??= this.operation("deactivate", descriptor);
			return released;
		};
	}
	/** @param command 辅助进程命令。 @param input 已校验参数。 */
	async command(command, input) {
		await this.start();
		const requestId = randomUUID();
		let timer;
		try {
			return await new Promise((resolveCommand, reject) => {
				this.waiting.set(requestId, {
					resolve: resolveCommand,
					reject
				});
				timer = setTimeout(() => {
					reject(/* @__PURE__ */ new Error(`桌面工具命令超时: ${command}`));
				}, this.config.operationTimeoutMs);
				this.send({
					type: "desktop-tools-command",
					requestId,
					command,
					input
				});
			});
		} finally {
			clearTimeout(timer);
			this.waiting.delete(requestId);
		}
	}
	send(message) {
		const child = this.child;
		if (!child?.connected) {
			this.failed(/* @__PURE__ */ new Error("Native desktop helper is unavailable"));
			return;
		}
		try {
			child.send(message, (error) => {
				if (error) this.failed(error);
			});
		} catch (error) {
			this.failed(error instanceof Error ? error : new Error(String(error)));
		}
	}
	failed(error) {
		if (this.failure !== void 0) return;
		this.failure = error;
		this.bridge.dispose();
		for (const pending of this.waiting.values()) pending.reject(error);
		this.waiting.clear();
		this.ctx.logger.error("DSH native desktop helper failed: %s", error.message);
		this.onFailure?.(error);
		this.stopChild().catch((stopError) => {
			this.ctx.logger.error("Native desktop helper shutdown failed: %s", String(stopError));
		});
	}
	start() {
		if (this.closed) return Promise.reject(/* @__PURE__ */ new Error("Native desktop runtime is closed"));
		if (this.failure !== void 0) return Promise.reject(this.failure);
		this.started ??= this.launch();
		return this.started;
	}
	async launch() {
		const executable = this.config.electronExecutable ?? process.execPath;
		if (this.config.electronExecutable === void 0 && process.versions.electron === void 0) throw new Error("桌面工具仅支持在 DSH Desktop 中启动");
		if (this.closed) throw new Error("Native desktop runtime was disabled before launch");
		const environment = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== void 0 && !/KEY|SECRET|TOKEN|PASSWORD|ELECTRON_RUN_AS_NODE|NODE_OPTIONS|NODE_PATH/iu.test(key)));
		const child = spawn(executable, [join(dirname(fileURLToPath(import.meta.url)), "helper.js"), `--dsh-profile=${resolve(this.ctx.profileContext.dir)}`], {
			stdio: [
				"ignore",
				"pipe",
				"pipe",
				"ipc"
			],
			windowsHide: true,
			env: environment
		});
		this.child = child;
		this.exit = new Promise((resolveExit) => {
			child.once("close", () => {
				resolveExit();
			});
		});
		child.stdout?.on("data", (chunk) => {
			this.ctx.logger.info("Native desktop: %s", String(chunk).trim());
		});
		child.stderr?.on("data", (chunk) => {
			this.ctx.logger.warn("Native desktop: %s", String(chunk).trim());
		});
		child.once("error", (error) => {
			this.failed(error);
		});
		child.once("disconnect", () => {
			if (!this.closed) this.failed(/* @__PURE__ */ new Error("Native desktop helper IPC disconnected"));
		});
		child.once("close", (code, signal) => {
			this.bridge.dispose();
			const error = /* @__PURE__ */ new Error(`Native desktop helper exited (${code ?? signal})`);
			if (!this.closed) this.failed(error);
			else for (const pending of this.waiting.values()) pending.reject(error);
			this.waiting.clear();
			this.child = void 0;
		});
		let clearReady = () => {};
		const ready = new Promise((resolveReady, reject) => {
			const timer = setTimeout(() => {
				reject(/* @__PURE__ */ new Error("Native desktop helper startup timed out"));
			}, this.config.startTimeoutMs);
			const exited = () => {
				reject(/* @__PURE__ */ new Error("Native desktop helper exited during startup"));
			};
			child.once("close", exited);
			child.once("error", reject);
			const receive = (input) => {
				if (typeof input === "object" && input !== null && "type" in input && input.type === "dsh-native-ready") resolveReady();
			};
			child.on("message", receive);
			clearReady = () => {
				clearTimeout(timer);
				child.off("message", receive);
				child.off("close", exited);
				child.off("error", reject);
			};
			this.waiting.set("startup", {
				resolve: resolveReady,
				reject
			});
		});
		child.on("message", (message) => {
			if (this.bridge.handle(message)) return;
			if (typeof message !== "object" || message === null || !("type" in message)) return;
			if (message.type === "desktop-tools-command-result" && "requestId" in message && typeof message.requestId === "string") {
				const pending = this.waiting.get(message.requestId);
				if (!pending) return;
				if ("ok" in message && message.ok === true) pending.resolve("value" in message ? message.value : void 0);
				else pending.reject(new Error("error" in message && typeof message.error === "string" ? message.error : "桌面工具命令失败"));
				return;
			}
			if (message.type === "desktop-extension-result" && "requestId" in message && typeof message.requestId === "string") {
				const pending = this.waiting.get(message.requestId);
				if (!pending || !("id" in message) || message.id !== pending.pluginId) return;
				if ("ok" in message && message.ok === true) pending.resolve();
				else {
					const error = new Error("error" in message && typeof message.error === "string" ? message.error : "Native plugin operation failed");
					if (pending.action === "deactivate") this.failed(error);
					else pending.reject(error);
				}
			}
		});
		try {
			await ready;
		} catch (error) {
			if (!this.closed) this.failed(error instanceof Error ? error : new Error(String(error)));
			await this.stopChild();
			throw error;
		} finally {
			clearReady();
			this.waiting.delete("startup");
		}
	}
	async operation(action, descriptor) {
		if (this.closed || this.failure !== void 0) {
			if (action === "deactivate") {
				await this.stopChild();
				return;
			}
			throw this.failure ?? /* @__PURE__ */ new Error("Native desktop runtime is closed");
		}
		const requestId = randomUUID();
		let timer;
		try {
			await new Promise((resolveOperation, reject) => {
				this.waiting.set(requestId, {
					pluginId: descriptor.id,
					action,
					resolve: resolveOperation,
					reject
				});
				timer = setTimeout(() => {
					this.failed(/* @__PURE__ */ new Error(`Native plugin ${action} timed out: ${descriptor.id}`));
				}, this.config.operationTimeoutMs);
				this.send({
					type: "desktop-extension",
					apiVersion: 1,
					action,
					requestId,
					...descriptor
				});
			});
		} finally {
			clearTimeout(timer);
			this.waiting.delete(requestId);
		}
	}
	/** @returns 原生窗口、录制写盘与辅助进程全部停止。 */
	dispose() {
		this.disposing ??= this.disposeRuntime();
		return this.disposing;
	}
	async disposeRuntime() {
		this.closed = true;
		this.bridge.dispose();
		for (const pending of this.waiting.values()) pending.reject(/* @__PURE__ */ new Error("Native desktop runtime was disabled"));
		this.waiting.clear();
		await this.stopChild();
		await this.started?.catch((error) => {});
	}
	stopChild() {
		const child = this.child;
		const exited = this.exit;
		if (child === void 0 || exited === void 0) return Promise.resolve();
		this.stopping ??= (async () => {
			if (child.connected) try {
				child.send({ type: "dsh-native-stop" }, (error) => {
					if (error) this.ctx.logger.warn("Native desktop helper stop message failed: %s", error.message);
				});
			} catch (error) {
				this.ctx.logger.warn("Native desktop helper stop message failed: %s", String(error));
				child.kill("SIGKILL");
			}
			else child.kill("SIGKILL");
			if (await this.waitForExit(exited)) return;
			child.kill("SIGKILL");
			if (!await this.waitForExit(exited)) throw new Error("Native desktop helper did not exit after forced termination");
		})();
		return this.stopping;
	}
	async waitForExit(exited) {
		let timer;
		try {
			return await Promise.race([exited.then(() => true), new Promise((resolveWait) => {
				timer = setTimeout(() => {
					resolveWait(false);
				}, this.config.stopTimeoutMs);
			})]);
		} finally {
			clearTimeout(timer);
		}
	}
};
/** 官方插件管理器加载的桌面工具套件。 */
const name = "dsh-desktop-tools";
/** 必需服务均由官方 DSH 提供；缺失时由 Cordis 报告。 */
const inject = [
	"profileContext",
	"connection",
	"typertGateway"
];
/** 可执行文件与等待时限可在插件设置中覆盖。 */
const Config = z.object({
	electronExecutable: z.string(),
	startTimeoutMs: z.natural().min(1).default(3e4),
	operationTimeoutMs: z.natural().min(1).default(3e4),
	stopTimeoutMs: z.natural().min(1).default(5e3)
});
/** @param ctx 官方注入的服务。 @param config 已校验的运行配置。 */
function apply(ctx, config) {
	const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
	const controller = new DesktopToolsController({
		ctx,
		profileDir: ctx.profileContext.dir,
		root,
		createRuntime: (onFailure) => new NativeRuntime(ctx, config, onFailure)
	});
	new DesktopToolsService(ctx, controller);
	ctx.effect(() => {
		controller.start().catch((error) => {
			ctx.logger.error("桌面工具后台启动失败: %s", error instanceof Error ? error.message : String(error));
		});
		return () => controller.dispose();
	});
}
export { Config, NativeRuntime, apply, inject, name };
