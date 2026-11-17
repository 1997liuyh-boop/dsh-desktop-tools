import { join } from "node:path";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
// source/apps/desktop/src/desktop-tools-config.ts
/** 桌面工具统一配置及原子持久化。 */
/** 截图默认全局快捷键。 */
const DEFAULT_SCREENSHOT_SHORTCUT = "CommandOrControl+Shift+S";
/** 录屏默认全局快捷键。 */
const DEFAULT_RECORDING_SHORTCUT = "CommandOrControl+Shift+R";
const RECORDING_FORMATS = [
	"mp4",
	"webm",
	"gif"
];
const RECORDING_QUALITIES = [
	"sd",
	"hd",
	"original"
];
const ACCELERATOR_KEY = /^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Tab|Backspace|Delete|Insert|Return|Enter|Up|Down|Left|Right|Home|End|PageUp|PageDown|Escape|Esc|PrintScreen|Plus|[-=[\];',./`\\])$/u;
const ACCELERATOR_MODIFIER = /^(?:Command|Cmd|Control|Ctrl|CommandOrControl|CmdOrCtrl|Alt|Option|AltGr|Shift|Super|Meta)$/u;
/**
* 校验 Electron 全局快捷键字符串。
* @param value 用户录制或配置文件中的快捷键。
* @returns 是否为「至少一个修饰键 + 一个主键」或空字符串（不注册）。
*/
function isDesktopAccelerator(value) {
	if (value === "") return true;
	const parts = value.split("+");
	const key = parts.pop();
	if (key === void 0 || !ACCELERATOR_KEY.test(key)) return false;
	if (parts.length === 0) return key === "PrintScreen";
	return parts.every((part) => ACCELERATOR_MODIFIER.test(part)) && new Set(parts).size === parts.length;
}
const DESKTOP_TOOLS_CONFIG_FILE = "desktop-tools.json";
/** 划词工具栏内置按钮，顺序即旧版本固定的显示顺序。 */
const SELECTION_BUILTIN_ITEMS = [
	"search",
	"translate",
	"note",
	"wechat",
	"explain",
	"send-to-agent"
];
/** 首次安装和旧配置使用的工具栏按钮。 */
const DEFAULT_SELECTION_TOOLBAR_ITEMS = SELECTION_BUILTIN_ITEMS;
/** 自定义划词动作的数量与长度上限。 */
const SELECTION_CUSTOM_ACTION_LIMITS = {
	count: 10,
	name: 20,
	prompt: 4e3
};
/** 工具栏中自定义动作项的前缀。 */
const SELECTION_CUSTOM_PREFIX = "custom:";
const CUSTOM_ACTION_ID = /^[a-z0-9-]{1,32}$/u;
/**
* 校验自定义划词动作列表。
* @param value 磁盘中的未知值；缺省视为空列表。
* @returns 已校验的动作；id 重复、超出数量或长度时抛错。
*/
function customActionsField(value) {
	if (value === void 0) return [];
	if (!Array.isArray(value) || value.length > SELECTION_CUSTOM_ACTION_LIMITS.count) throw new Error("自定义划词动作最多 10 个");
	const seen = /* @__PURE__ */ new Set();
	return value.map((item, index) => {
		if (!isRecord(item) || typeof item.id !== "string" || !CUSTOM_ACTION_ID.test(item.id) || seen.has(item.id)) throw new Error(`自定义划词动作 id 无效: ${String(index)}`);
		seen.add(item.id);
		const name = typeof item.name === "string" ? item.name.trim() : "";
		const prompt = typeof item.prompt === "string" ? item.prompt.trim() : "";
		if (name === "" || name.length > SELECTION_CUSTOM_ACTION_LIMITS.name || /[\x00-\x1f]/u.test(name)) throw new Error(`自定义划词动作名称无效: ${item.id}`);
		if (prompt === "" || prompt.length > SELECTION_CUSTOM_ACTION_LIMITS.prompt) throw new Error(`自定义划词动作提示词无效: ${item.id}`);
		return {
			id: item.id,
			name,
			prompt
		};
	});
}
/**
* 校验工具栏按钮列表：去掉重复项，丢弃未知按钮和已删除的自定义动作。
* @param value 磁盘中的未知值；缺省时使用全部内置按钮。
* @param actions 已校验的自定义动作。
* @returns 按显示顺序排列的按钮 id。
*/
function toolbarItemsField(value, actions) {
	if (value === void 0) return [...DEFAULT_SELECTION_TOOLBAR_ITEMS];
	if (!Array.isArray(value)) throw new Error("划词工具栏按钮列表无效");
	const known = /* @__PURE__ */ new Set([...SELECTION_BUILTIN_ITEMS, ...actions.map((action) => SELECTION_CUSTOM_PREFIX + action.id)]);
	return [...new Set(value.filter((item) => typeof item === "string" && known.has(item)))];
}
const DEFAULT_MODEL = {
	provider: "deepseek-official",
	model: "deepseek-flash",
	reasoningEffort: "max"
};
/** @param platform 当前桌面平台。 @returns 首次安装使用的完整配置。 */
function defaultDesktopToolsConfig(platform = process.platform) {
	return {
		selection: {
			enabled: true,
			targetLanguage: "en",
			compatibilityCopy: true,
			customActions: [],
			toolbarItems: [...DEFAULT_SELECTION_TOOLBAR_ITEMS]
		},
		floatingBall: {
			enabled: true,
			conversationModel: { ...DEFAULT_MODEL },
			backgroundModel: { ...DEFAULT_MODEL },
			permissionPreset: "danger-full-access",
			coordinateMode: platform === "win32" ? "millifraction" : "pixel",
			edgeSnap: true,
			snapDistance: 24,
			taskBubbles: true,
			completionNotifications: true
		},
		screenshot: {
			enabled: false,
			shortcut: DEFAULT_SCREENSHOT_SHORTCUT,
			longShortcut: "",
			pinsShortcut: ""
		},
		recording: {
			enabled: false,
			shortcut: DEFAULT_RECORDING_SHORTCUT,
			format: "mp4",
			quality: "hd",
			systemAudio: platform !== "linux",
			microphone: false,
			knowledgeGraph: false
		},
		history: { enabled: true },
		accounting: {
			enabled: true,
			dailyBudget: 0,
			rates: []
		}
	};
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function booleanField(record, name) {
	const value = record[name];
	if (typeof value !== "boolean") throw new Error(`桌面工具配置字段必须为布尔值: ${name}`);
	return value;
}
/** 新增字段缺省时回落默认值，兼容 0.3.x 写入的配置文件。 */
function optionalBoolean(record, name, fallback) {
	return record[name] === void 0 ? fallback : booleanField(record, name);
}
function shortcutField(record, name, fallback) {
	const value = record[name];
	if (value === void 0) return fallback;
	if (typeof value !== "string" || value.length > 80 || !isDesktopAccelerator(value)) throw new Error(`桌面工具快捷键无效: ${name}`);
	return value;
}
function choiceField(record, name, choices, fallback) {
	const value = record[name];
	if (value === void 0) return fallback;
	if (typeof value !== "string" || !choices.includes(value)) throw new Error(`桌面工具配置取值无效: ${name}`);
	return value;
}
function objectField(record, name) {
	const value = record[name];
	if (!isRecord(value)) throw new Error(`桌面工具配置字段必须为对象: ${name}`);
	return value;
}
function modelField(value, name) {
	if (!isRecord(value) || typeof value.provider !== "string" || value.provider === "" || typeof value.model !== "string" || value.model === "" || value.reasoningEffort !== void 0 && (typeof value.reasoningEffort !== "string" || value.reasoningEffort === "")) throw new Error(`桌面工具模型配置无效: ${name}`);
	return {
		provider: value.provider,
		model: value.model,
		...value.reasoningEffort === void 0 ? {} : { reasoningEffort: value.reasoningEffort }
	};
}
/** 有界有限数，避免损坏窗口坐标与账本。 */
function numberField(record, name, fallback, max = 1e6) {
	const value = record[name];
	if (value === void 0) return fallback;
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) throw new Error(`数值配置无效: ${name}`);
	return value;
}
function ratesField(value) {
	if (value === void 0) return [];
	if (!Array.isArray(value) || value.length > 100) throw new Error("模型单价最多 100 项");
	const seen = /* @__PURE__ */ new Set();
	return value.map((item) => {
		if (!isRecord(item) || typeof item.provider !== "string" || !item.provider.trim() || item.provider.length > 200 || typeof item.model !== "string" || !item.model.trim() || item.model.length > 200) throw new Error("模型单价名称无效");
		const provider = item.provider.trim(), model = item.model.trim(), key = JSON.stringify([provider, model]);
		if (seen.has(key)) throw new Error("模型单价重复");
		seen.add(key);
		return {
			provider,
			model,
			input: numberField(item, "input", 0),
			cacheRead: numberField(item, "cacheRead", 0),
			...item.cacheWrite === void 0 ? {} : { cacheWrite: numberField(item, "cacheWrite", 0) },
			output: numberField(item, "output", 0)
		};
	});
}
/** @param value 磁盘中的未知 JSON。 @returns 已校验的完整配置。 */
function parseDesktopToolsConfig(value) {
	if (!isRecord(value)) throw new Error("桌面工具配置根节点必须为对象");
	const selection = objectField(value, "selection");
	const floatingBall = objectField(value, "floatingBall");
	const screenshot = objectField(value, "screenshot");
	const recording = objectField(value, "recording");
	const targetLanguage = selection.targetLanguage;
	if (typeof targetLanguage !== "string" || targetLanguage.trim() === "" || targetLanguage.length > 80 || /[\x00-\x1f]/u.test(targetLanguage)) throw new Error("划词目标语言无效");
	const permissionPreset = floatingBall.permissionPreset;
	if (permissionPreset !== "read-only" && permissionPreset !== "workspace-write" && permissionPreset !== "danger-full-access") throw new Error("悬浮球权限预设无效");
	const coordinateMode = floatingBall.coordinateMode;
	if (coordinateMode !== "millifraction" && coordinateMode !== "pixel") throw new Error("悬浮球坐标模式无效");
	const customActions = customActionsField(selection.customActions);
	const accounting = value.accounting === void 0 ? {} : objectField(value, "accounting");
	return {
		selection: {
			enabled: booleanField(selection, "enabled"),
			targetLanguage,
			compatibilityCopy: booleanField(selection, "compatibilityCopy"),
			...selection.model === void 0 ? {} : { model: modelField(selection.model, "selection.model") },
			customActions,
			toolbarItems: toolbarItemsField(selection.toolbarItems, customActions)
		},
		floatingBall: {
			enabled: booleanField(floatingBall, "enabled"),
			conversationModel: modelField(floatingBall.conversationModel, "floatingBall.conversationModel"),
			backgroundModel: modelField(floatingBall.backgroundModel, "floatingBall.backgroundModel"),
			permissionPreset,
			coordinateMode,
			edgeSnap: optionalBoolean(floatingBall, "edgeSnap", true),
			snapDistance: numberField(floatingBall, "snapDistance", 24, 120),
			taskBubbles: optionalBoolean(floatingBall, "taskBubbles", true),
			completionNotifications: optionalBoolean(floatingBall, "completionNotifications", true)
		},
		screenshot: {
			enabled: booleanField(screenshot, "enabled"),
			shortcut: shortcutField(screenshot, "shortcut", DEFAULT_SCREENSHOT_SHORTCUT),
			longShortcut: shortcutField(screenshot, "longShortcut", ""),
			pinsShortcut: shortcutField(screenshot, "pinsShortcut", "")
		},
		recording: {
			enabled: booleanField(recording, "enabled"),
			shortcut: shortcutField(recording, "shortcut", DEFAULT_RECORDING_SHORTCUT),
			format: choiceField(recording, "format", RECORDING_FORMATS, "mp4"),
			quality: choiceField(recording, "quality", RECORDING_QUALITIES, "hd"),
			systemAudio: optionalBoolean(recording, "systemAudio", process.platform !== "linux"),
			microphone: optionalBoolean(recording, "microphone", false),
			knowledgeGraph: optionalBoolean(recording, "knowledgeGraph", false)
		},
		history: { enabled: optionalBoolean(isRecord(value.history) ? value.history : {}, "enabled", true) },
		accounting: {
			enabled: optionalBoolean(accounting, "enabled", true),
			dailyBudget: numberField(accounting, "dailyBudget", 0),
			rates: ratesField(accounting.rates)
		}
	};
}
/** @param profileDir 当前 DSH profile。 @returns 磁盘配置；文件不存在时返回首次安装默认值。 */
function readDesktopToolsConfig(profileDir) {
	const path = join(profileDir, DESKTOP_TOOLS_CONFIG_FILE);
	if (!existsSync(path)) return defaultDesktopToolsConfig();
	try {
		return parseDesktopToolsConfig(JSON.parse(readFileSync(path, "utf8")));
	} catch (error) {
		throw new Error(`无法读取桌面工具配置: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
	}
}
/** @param profileDir 当前 DSH profile。 @param config 已校验配置。 */
function writeDesktopToolsConfig(profileDir, config) {
	const validated = parseDesktopToolsConfig(config);
	const path = join(profileDir, DESKTOP_TOOLS_CONFIG_FILE);
	const temporary = `${path}.${String(process.pid)}.${String(Date.now())}.tmp`;
	writeFileSync(temporary, `${JSON.stringify(validated, void 0, 2)}\n`, {
		encoding: "utf8",
		flag: "wx"
	});
	try {
		renameSync(temporary, path);
	} catch (error) {
		try {
			rmSync(temporary, { force: true });
		} catch {}
		throw error;
	}
}
export { writeDesktopToolsConfig as i, parseDesktopToolsConfig as n, readDesktopToolsConfig as r, DESKTOP_TOOLS_CONFIG_FILE as t };
