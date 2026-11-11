import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { mkdir } from "node:fs/promises";
// source/apps/desktop/src/koffi-platform.ts
/** Koffi 平台二进制提供的划词钩子所需最小接口。 */
const PACKAGES = {
	"darwin-arm64": "@koromix/koffi-darwin-arm64",
	"darwin-x64": "@koromix/koffi-darwin-x64",
	"win32-arm64": "@koromix/koffi-win32-arm64",
	"win32-x64": "@koromix/koffi-win32-x64"
};
function isKoffiPlatform(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return [
		"struct",
		"proto",
		"pointer",
		"type",
		"load",
		"register",
		"unregister",
		"decode"
	].every((name) => typeof record[name] === "function");
}
/** @returns 当前受支持平台的预编译 Koffi 接口。 */
function loadKoffiPlatform() {
	const key = `${process.platform}-${process.arch}`;
	const packageName = PACKAGES[key];
	if (packageName === void 0) throw new Error(`Koffi 不支持当前平台: ${key}`);
	const value = createRequire(import.meta.url)(packageName);
	if (!isKoffiPlatform(value)) throw new Error(`Koffi 平台包接口无效: ${packageName}`);
	return {
		struct: value.struct,
		proto: value.proto,
		pointer: value.pointer,
		sizeof: (type) => value.type(type).size,
		load: value.load,
		register: value.register,
		unregister: value.unregister,
		decode: value.decode
	};
}
// source/apps/desktop/src/selection-prompt.ts
const DESKTOP_SELECTION_PREAMBLE = "Desktop selection. Answer in this chat only. Do not call GUI tools or code_agent.";
/** 校验磁盘与 IPC 中的目标语言名称。 */
function isSelectionLanguage(value) {
	return typeof value === "string" && value.trim().length > 0 && value.length <= 80 && !/[\x00-\x1f]/u.test(value);
}
function selectionSearchUrl(text) {
	return `https://www.bing.com/search?q=${encodeURIComponent(text)}`;
}
function composeSelectionTranslatePrompt(text, language) {
	const target = language === "en" ? "English" : language === "zh" ? "Chinese" : language.trim();
	return `${DESKTOP_SELECTION_PREAMBLE}\n\nTranslate the following into ${target}:\n\n${text}`;
}
// source/apps/desktop/src/selection-session.ts
/** 用户固定的模型被宿主拒绝；区别于任务本身的失败。 */
var SelectionModelUnavailable = class extends Error {
	constructor(message, options) {
		super(message, options);
		this.name = "SelectionModelUnavailable";
	}
};
/**
* 注册（或复用）任务工作区并补全默认名称。
* @param transport Host 会话通道。
* @param workspace 工作区目录与名称。
* @param signal 取消信号。
* @returns 工作区标识。
*/
async function resolveSelectionWorkspace(transport, workspace, signal) {
	await mkdir(workspace.path, { recursive: true });
	signal?.throwIfAborted();
	const result = await selectionRpc(transport, "workspace/create", { request: { path: workspace.path } }, signal);
	const registered = selectionRecord(result.workspace);
	if (typeof registered.workspaceId !== "string") throw new Error("Workspace creation returned no id");
	signal?.throwIfAborted();
	if (result.created === true || registered.title === basename(workspace.path)) await selectionRpc(transport, "workspace/rename", { request: {
		workspaceId: registered.workspaceId,
		title: workspace.title
	} }, signal);
	return registered.workspaceId;
}
/**
* 新建会话并提交一条带图片的消息，不等待模型回复；用于把截图转发到 DSH 对话。
* @param transport Host 会话通道。
* @param input 会话标题、工作区、文字与图片。
* @returns 新会话标识。
*/
async function submitSelectionPrompt(transport, input) {
	const created = await selectionRpc(transport, "session/create", { request: { workspaceId: await resolveSelectionWorkspace(transport, input.workspace) } });
	if (typeof created.sessionId !== "string") throw new Error("Session creation returned no id");
	const sessionId = created.sessionId;
	if (input.model !== void 0) await selectionRpc(transport, "session/selectModel", { request: {
		sessionId,
		provider: input.model.provider,
		model: input.model.model,
		saveAsDefault: false,
		...input.model.reasoningEffort === void 0 ? {} : { reasoningEffort: input.model.reasoningEffort }
	} });
	await selectionRpc(transport, "session/rename", { request: {
		sessionId,
		title: input.title
	} });
	await selectionRpc(transport, "session/prompt", { request: {
		sessionId,
		requestId: randomUUID(),
		mode: "queue",
		content: [{
			type: "text",
			text: input.text
		}, ...input.images]
	} });
	return sessionId;
}
/** 校验来自 Host 的 JSON 对象。 */
function selectionRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}
/** 读取标准 RPC 响应，保留 Host 返回的可诊断错误。 */
async function selectionRpc(transport, method, args, signal) {
	const rpcId = randomUUID();
	const response = await transport.request(`/api/${method}`, JSON.stringify({
		type: "client-request",
		rpcId,
		method,
		payload: { args }
	}), signal);
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	const envelope = selectionRecord(await response.json());
	if (envelope.rpcId !== rpcId || envelope.type !== "server-response") throw new Error("Invalid session response");
	const result = selectionRecord(envelope.result);
	if (result.ok !== true) {
		const message = selectionRecord(result.error).message;
		throw new Error(typeof message === "string" ? message : "Session request failed");
	}
	return selectionRecord(result.value);
}
function modelFrom(value) {
	const selection = selectionRecord(selectionRecord(value.values).modelSelection);
	return selectionRecord(selection.next ?? selection.lastUsed);
}
/** 解码有界的逐行会话流，不另行读取会话日志。 */
async function* selectionFrames(response) {
	if (!response.ok || response.body === null) throw new Error(`Session stream HTTP ${response.status}`);
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let pending = "";
	try {
		for (;;) {
			const next = await reader.read();
			pending += decoder.decode(next.value, { stream: !next.done });
			if (pending.length > 8e6) throw new Error("Session stream frame is too large");
			const lines = pending.split("\n");
			pending = lines.pop() ?? "";
			for (const line of lines) if (line.trim() !== "") yield selectionRecord(JSON.parse(line));
			if (next.done) {
				if (pending.trim() !== "") yield selectionRecord(JSON.parse(pending));
				return;
			}
		}
	} finally {
		await reader.cancel().catch((error) => {
			console.debug("selection stream closed", error);
		});
		reader.releaseLock();
	}
}
/** 一个结果窗口独占的任务；重试和取消不会触及主会话。 */
var SelectionSessionTask = class {
	transport;
	publish;
	abort = new AbortController();
	sessionId;
	text = "";
	model;
	ended = false;
	cancelAccepted = false;
	constructor(transport, publish) {
		this.transport = transport;
		this.publish = publish;
	}
	/** 提交包含原文与要求的模型任务；指定工作区时先完成归组，再创建会话；指定固定模型时不再沿用源会话的模型。 */
	async run(prompt, title, sourceSessionId, workspace, fixedModel, images = []) {
		const signal = this.abort.signal;
		const cancelled = () => signal.aborted;
		if (cancelled()) return;
		this.emit("thinking");
		try {
			const workspaceId = workspace === void 0 ? void 0 : await resolveSelectionWorkspace(this.transport, workspace, signal);
			signal.throwIfAborted();
			const created = await selectionRpc(this.transport, "session/create", { request: workspaceId === void 0 ? {} : { workspaceId } }, signal);
			if (typeof created.sessionId !== "string") throw new Error("Session creation returned no id");
			this.sessionId = created.sessionId;
			if (cancelled()) {
				await this.cancelSession();
				return;
			}
			const inherited = modelFrom(fixedModel !== void 0 || sourceSessionId === void 0 ? {} : await selectionRpc(this.transport, "session/projections", { request: { sessionId: sourceSessionId } }, signal));
			const model = fixedModel ?? (typeof inherited.provider === "string" && typeof inherited.model === "string" ? {
				provider: inherited.provider,
				model: inherited.model,
				...typeof inherited.reasoningEffort === "string" ? { reasoningEffort: inherited.reasoningEffort } : {}
			} : void 0);
			if (model !== void 0) try {
				await selectionRpc(this.transport, "session/selectModel", { request: {
					sessionId: this.sessionId,
					provider: model.provider,
					model: model.model,
					saveAsDefault: false,
					...model.reasoningEffort === void 0 ? {} : { reasoningEffort: model.reasoningEffort }
				} }, signal);
			} catch (cause) {
				if (fixedModel === void 0 || cancelled()) throw cause;
				throw new SelectionModelUnavailable(cause instanceof Error ? cause.message : String(cause), { cause });
			}
			const own = modelFrom(await selectionRpc(this.transport, "session/projections", { request: { sessionId: this.sessionId } }, signal));
			this.model = typeof own.model === "string" ? own.model : model?.model;
			this.emit("thinking");
			await selectionRpc(this.transport, "session/rename", { request: {
				sessionId: this.sessionId,
				title
			} }, signal);
			const response = await this.transport.request("/.dsh/remote-stream", JSON.stringify({
				endpoint: "session/follow",
				payload: { args: { request: {
					address: {
						kind: "session",
						sessionId: this.sessionId
					},
					assistantStream: true
				} } }
			}), signal);
			try {
				await selectionRpc(this.transport, "session/prompt", { request: {
					sessionId: this.sessionId,
					requestId: randomUUID(),
					mode: "queue",
					content: [{
						type: "text",
						text: prompt
					}, ...images]
				} }, signal);
			} catch (error) {
				await response.body?.cancel();
				throw error;
			}
			for await (const entry of selectionFrames(response)) {
				if (cancelled()) return;
				if (entry.type === "assistant-stream") {
					const frame = selectionRecord(entry.frame);
					if (frame.type === "start") this.text = "";
					const chunk = selectionRecord(frame.chunk);
					if (chunk.type === "text-delta" && typeof chunk.text === "string") {
						this.text += chunk.text;
						this.emit("streaming");
					}
				} else if (entry.type === "event") {
					const event = selectionRecord(entry.event);
					const data = selectionRecord(event.data);
					if (event.type === "assistant/message") {
						const content = selectionRecord(data.message).content;
						if (Array.isArray(content)) this.text = content.map((block) => {
							const value = selectionRecord(block);
							return value.type === "text" && typeof value.text === "string" ? value.text : "";
						}).join("\n");
						this.emit("streaming");
					}
					if (event.type === "turn/end") {
						this.ended = true;
						const reason = selectionRecord(data.reason);
						if (reason.kind === "completed" && this.text.trim() === "") throw new Error("The model returned no text");
						if (reason.kind === "completed") this.emit("done");
						else if (reason.kind === "aborted") this.emit("stopped");
						else {
							const message = selectionRecord(reason.error).message;
							this.emit("error", typeof message === "string" ? message : typeof reason.kind === "string" ? reason.kind : "Task interrupted");
						}
						return;
					}
				}
			}
			if (!cancelled()) throw new Error("Session stream ended before the task completed");
		} catch (error) {
			if (cancelled()) return;
			this.emit("error", error instanceof Error ? error.message : String(error), error instanceof SelectionModelUnavailable ? "model-unavailable" : void 0);
			await this.cancelSession().catch((cause) => {
				console.warn("selection task cancellation failed", cause);
			});
		}
	}
	/** 停止本窗口的会话并终止流读取。 */
	async stop() {
		this.abort.abort();
		if (this.ended || this.cancelAccepted) return;
		await this.cancelSession();
	}
	async cancelSession() {
		if (this.sessionId === void 0) return;
		await selectionRpc(this.transport, "session/cancel", { request: { sessionId: this.sessionId } });
		this.cancelAccepted = true;
	}
	emit(phase, error, failure) {
		if (this.abort.signal.aborted) return;
		this.publish({
			phase,
			text: this.text,
			...this.model === void 0 ? {} : { model: this.model },
			...error === void 0 ? {} : { error },
			...failure === void 0 ? {} : { failure }
		});
	}
};
export { composeSelectionTranslatePrompt as a, loadKoffiPlatform as c, DESKTOP_SELECTION_PREAMBLE as i, selectionRecord as n, isSelectionLanguage as o, submitSelectionPrompt as r, selectionSearchUrl as s, SelectionSessionTask as t };
