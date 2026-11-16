import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
/** 识别结果、回答等文字的保存上限。 */
const MAX_HISTORY_TEXT = 1e5;
const KINDS = [
	"image",
	"long",
	"recording",
	"ocr",
	"translate",
	"graph",
	"ask"
];
const INDEX_FILE = "history.json";
const ENTRY_ID = /^[a-z0-9-]{1,48}$/u;
function isEntry(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	const optional = (key, type) => record[key] === void 0 || typeof record[key] === type;
	return typeof record.id === "string" && ENTRY_ID.test(record.id) && typeof record.createdAt === "number" && KINDS.includes(record.kind) && typeof record.image === "boolean" && optional("width", "number") && optional("height", "number") && optional("text", "string") && optional("question", "string") && optional("file", "string");
}
/** @returns 新历史记录的 id。 */
function newHistoryId() {
	return `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
/** 历史目录的读写；索引损坏、图片缺失或录屏文件已删除的记录在读取时跳过。 */
var HistoryStore = class {
	directory;
	/** @param directory 历史目录，通常为 profile/desktop-tools/history。 */
	constructor(directory) {
		this.directory = directory;
	}
	/** @returns 按时间倒序（最新在前）的有效记录。 */
	list() {
		const path = join(this.directory, INDEX_FILE);
		if (!existsSync(path)) return [];
		let parsed;
		try {
			parsed = JSON.parse(readFileSync(path, "utf8"));
		} catch {
			return [];
		}
		if (!Array.isArray(parsed)) return [];
		const seen = /* @__PURE__ */ new Set();
		return parsed.filter((item) => {
			if (!isEntry(item) || seen.has(item.id)) return false;
			if (item.image && !existsSync(this.imagePath(item.id))) return false;
			if (!item.image && item.kind === "recording" && (item.file === void 0 || !existsSync(item.file))) return false;
			seen.add(item.id);
			return true;
		}).sort((left, right) => right.createdAt - left.createdAt);
	}
	/** @param id 记录 id。 @returns 图片字节。 */
	readImage(id) {
		if (!ENTRY_ID.test(id)) throw new Error("历史记录 id 无效");
		return readFileSync(this.imagePath(id));
	}
	/**
	* 追加一条记录；超出上限时删除最早的记录及其图片。
	* @param entry 记录；`image` 为 true 时必须同时提供 png。
	* @param png 图片字节。
	* @returns 因超出上限被删除的记录 id。
	*/
	add(entry, png) {
		if (!ENTRY_ID.test(entry.id)) throw new Error("历史记录 id 无效");
		if (entry.image && png === void 0) throw new Error("历史记录缺少图片");
		mkdirSync(this.directory, { recursive: true });
		if (entry.image && png !== void 0) writeFileSync(this.imagePath(entry.id), png);
		const entries = [{
			...entry,
			...entry.text === void 0 ? {} : { text: entry.text.slice(0, MAX_HISTORY_TEXT) },
			...entry.question === void 0 ? {} : { question: entry.question.slice(0, MAX_HISTORY_TEXT) }
		}, ...this.list().filter((item) => item.id !== entry.id)];
		const evicted = entries.length > 100 ? entries.splice(100) : [];
		for (const item of evicted) rmSync(this.imagePath(item.id), { force: true });
		this.write(entries);
		return evicted.map((item) => item.id);
	}
	/** @param id 要删除的记录 id；不存在时忽略。不会删除用户保存的文件。 */
	remove(id) {
		if (!ENTRY_ID.test(id)) return;
		rmSync(this.imagePath(id), { force: true });
		this.write(this.list().filter((item) => item.id !== id));
	}
	/** 删除全部历史记录与图片。不会删除用户保存的文件。 */
	clear() {
		rmSync(this.directory, {
			recursive: true,
			force: true
		});
	}
	imagePath(id) {
		return join(this.directory, `${id}.png`);
	}
	/** 先写临时文件再改名，避免中途退出留下半个索引。 */
	write(entries) {
		mkdirSync(this.directory, { recursive: true });
		const path = join(this.directory, INDEX_FILE);
		const temporary = `${path}.${String(process.pid)}.tmp`;
		writeFileSync(temporary, JSON.stringify(entries));
		renameSync(temporary, path);
	}
};
export { newHistoryId as n, HistoryStore as t };
