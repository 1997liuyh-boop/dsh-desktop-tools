import { extname, join } from "node:path";
import { readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
// source/apps/desktop/src/orb-avatar.ts
const ORB_AVATAR_BYTES_FILE = "orb-avatar";
const ORB_AVATAR_META_FILE = "orb-avatar.json";
const DEFAULT_ORB_AVATAR_FILE = "deepseek-avatar-square.gif";
const ORB_AVATAR_PATH = "/orb-avatar";
const ORB_SETTINGS_MACOS_ONLY = "dsh desktop: floating ball settings require macOS or Windows";
function orbSettingsSupported(platform) {
	return platform === "darwin" || platform === "win32";
}
function assertOrbSettingsWritable(platform) {
	if (!orbSettingsSupported(platform)) throw new Error(ORB_SETTINGS_MACOS_ONLY);
}
const MIME_BY_EXTENSION = {
	".gif": "image/gif",
	".png": "image/png",
	".webp": "image/webp"
};
function orbAvatarUrl(hostname, version) {
	return `dsh-app://${hostname}${ORB_AVATAR_PATH}?v=${String(Math.trunc(version))}`;
}
function orbAvatarCacheToken(profileDir) {
	try {
		return statSync(join(profileDir, ORB_AVATAR_BYTES_FILE)).mtimeMs;
	} catch {
		return 0;
	}
}
function interpretOrbAvatarBytes(bytes, filePath) {
	const sniffed = sniffOrbAvatarMime(bytes);
	if (sniffed === void 0) return void 0;
	const fromName = MIME_BY_EXTENSION[extname(filePath).toLowerCase()];
	if (fromName !== void 0 && fromName !== sniffed) return void 0;
	return sniffed;
}
function installOrbAvatarFromPath(profileDir, filePath) {
	let size;
	try {
		size = statSync(filePath).size;
	} catch {
		return {
			ok: false,
			error: "invalid-type"
		};
	}
	if (size > 2097152) return {
		ok: false,
		error: "too-large"
	};
	const bytes = new Uint8Array(readFileSync(filePath));
	const mime = interpretOrbAvatarBytes(bytes, filePath);
	if (mime === void 0) return {
		ok: false,
		error: "invalid-type"
	};
	writeCustomOrbAvatar(profileDir, bytes, mime);
	return { ok: true };
}
/** @param profileDir 当前 DSH profile。 @param bytes 上传图片内容。 @param fileName 上传文件名。 @returns 明确拒绝不支持的大小或内容。 */
function installOrbAvatarFromBytes(profileDir, bytes, fileName) {
	if (bytes.byteLength > 2097152) return {
		ok: false,
		error: "too-large"
	};
	const mime = interpretOrbAvatarBytes(bytes, fileName);
	if (mime === void 0) return {
		ok: false,
		error: "invalid-type"
	};
	writeCustomOrbAvatar(profileDir, bytes, mime);
	return { ok: true };
}
/** @param profileDir 当前 DSH profile。 @returns 用户头像；未设置时返回 undefined。 */
function readCustomOrbAvatarDataUrl(profileDir) {
	const custom = readCustomOrbAvatar(profileDir);
	return custom === void 0 ? void 0 : `data:${custom.mime};base64,${Buffer.from(custom.bytes).toString("base64")}`;
}
function restoreOrbAvatar(profileDir) {
	for (const name of [ORB_AVATAR_BYTES_FILE, ORB_AVATAR_META_FILE]) try {
		unlinkSync(join(profileDir, name));
	} catch (error) {
		if (!isEnoent(error)) throw error;
	}
}
async function serveOrbAvatar(profileDir, defaultFilePath, method) {
	if (method !== "GET" && method !== "HEAD") return new Response(null, { status: 405 });
	const custom = readCustomOrbAvatar(profileDir);
	const mime = custom?.mime ?? "image/gif";
	try {
		const body = method === "HEAD" ? null : custom !== void 0 ? Buffer.from(custom.bytes) : await readFile(defaultFilePath);
		return new Response(body, { headers: {
			"content-type": mime,
			"cache-control": "no-store"
		} });
	} catch {
		return new Response(null, { status: 404 });
	}
}
function writeCustomOrbAvatar(profileDir, bytes, mime) {
	writeFileSync(join(profileDir, ORB_AVATAR_BYTES_FILE), bytes);
	writeFileSync(join(profileDir, ORB_AVATAR_META_FILE), `${JSON.stringify({ mime }, void 0, 2)}\n`);
}
function readCustomOrbAvatar(profileDir) {
	let bytes;
	try {
		bytes = new Uint8Array(readFileSync(join(profileDir, ORB_AVATAR_BYTES_FILE)));
	} catch {
		return;
	}
	let mime;
	try {
		const value = JSON.parse(readFileSync(join(profileDir, ORB_AVATAR_META_FILE), "utf8"));
		if (typeof value === "object" && value !== null && !Array.isArray(value)) {
			const record = value;
			if (record.mime === "image/gif" || record.mime === "image/png" || record.mime === "image/webp") mime = record.mime;
		}
	} catch {}
	const sniffed = sniffOrbAvatarMime(bytes);
	if (sniffed === void 0) return void 0;
	if (mime !== void 0 && mime !== sniffed) return void 0;
	return {
		bytes,
		mime: mime ?? sniffed
	};
}
function sniffOrbAvatarMime(bytes) {
	if (bytes.length >= 6 && bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 56 && (bytes[4] === 55 || bytes[4] === 57) && bytes[5] === 97) return "image/gif";
	if (bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) return "image/png";
	if (bytes.length >= 12 && bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80) return "image/webp";
}
function isEnoent(error) {
	return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
export { installOrbAvatarFromPath as a, orbSettingsSupported as c, serveOrbAvatar as d, installOrbAvatarFromBytes as i, readCustomOrbAvatarDataUrl as l, ORB_AVATAR_PATH as n, orbAvatarCacheToken as o, assertOrbSettingsWritable as r, orbAvatarUrl as s, DEFAULT_ORB_AVATAR_FILE as t, restoreOrbAvatar as u };
