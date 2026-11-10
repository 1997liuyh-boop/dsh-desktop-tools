import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import z from "@deepseek-ai/schemastery";
import { SessionId } from "@deepseek-ai/dsh-session/types";
//#region source/apps/desktop/native-extension-runtime/host.ts
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
const STREAM_ENDPOINTS = new Set(["session/follow", "$events"]);
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
async function applyPermission(ctx, body) {
	if (!isRecord(body) || body.command !== "permission" || !isRecord(body.payload)) requestFailure("native/command-invalid", "原生权限命令格式无效。");
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
			} else if (path === "/.dsh/native-command") await respond(id, await applyPermission(ctx, JSON.parse(body)), signal);
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
//#endregion
//#region source/apps/desktop/native-extension-runtime/index.ts
/** 官方 DSH 通过可注入服务管理独立原生插件，不依赖桌面扩展 API。 */
/** 原生插件共用的 Electron 进程；每个插件独立等待激活和释放回执。 */
var NativeRuntime = class {
	ctx;
	config;
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
	constructor(ctx, config) {
		this.ctx = ctx;
		this.config = config;
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
		let executable = this.config.electronExecutable;
		if (executable === void 0) {
			const electronRoot = dirname(createRequire(import.meta.url).resolve("electron/package.json"));
			executable = join(electronRoot, "dist", (await readFile(join(electronRoot, "path.txt"), "utf8")).trim());
		}
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
/** 官方插件管理器加载的共享运行时。 */
const name = "dsh-desktop-runtime";
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
	const runtime = new NativeRuntime(ctx, config);
	ctx.effect(() => {
		ctx.provide("desktopNativeRuntime", runtime);
		return () => runtime.dispose();
	});
}
//#endregion
export { Config, NativeRuntime, apply, inject, name };
