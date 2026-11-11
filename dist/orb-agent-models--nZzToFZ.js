import { n as readDesktopToolsConfig, r as writeDesktopToolsConfig } from "./desktop-tools-config-CoArygqo.js";
import { BrowserWindow, Menu, screen, systemPreferences } from "electron";
// source/apps/desktop/src/floating-agent-menu.ts
const CURRENT_MODEL_MARK = "✓ ";
function floatingAgentModelItems(catalog, current, onSelect, labels) {
	const groups = catalog?.groups ?? [];
	if (groups.length === 0) return [{
		label: labels.empty,
		enabled: false
	}];
	const items = [];
	for (const group of groups) {
		items.push({
			label: group.name,
			enabled: false
		});
		for (const model of group.models) items.push(modelItem(group.id, model, current, onSelect, labels.defaultEffort));
	}
	return items;
}
/**
* 划词翻译与解读的模型子菜单：首项为跟随主窗口当前会话，其余与 Agent 模型菜单相同。
* @param catalog 宿主模型目录。
* @param current 当前固定的模型；未固定时为 undefined。
* @param onSelect 选择回调；传 undefined 表示恢复跟随。
* @param labels 本地化标签。
* @returns Electron 菜单项。
*/
function floatingSelectionModelItems(catalog, current, onSelect, labels) {
	return [
		{
			label: labels.follow,
			type: "checkbox",
			checked: current === void 0,
			click: () => {
				onSelect(void 0);
			}
		},
		{ type: "separator" },
		...floatingAgentModelItems(catalog, current, onSelect, labels)
	];
}
function modelItem(provider, model, current, onSelect, defaultEffortLabel) {
	const selected = current !== void 0 && current.provider === provider && current.model === model.id;
	const efforts = effortItems(provider, model, current, onSelect, defaultEffortLabel);
	if (efforts === void 0) return {
		label: model.name,
		type: "checkbox",
		checked: selected,
		click: () => {
			onSelect({
				provider,
				model: model.id
			});
		}
	};
	return {
		label: selected ? `${CURRENT_MODEL_MARK}${model.name}` : model.name,
		submenu: efforts
	};
}
function effortItems(provider, model, current, onSelect, defaultEffortLabel) {
	const reasoning = model.reasoning;
	if (reasoning === void 0) return void 0;
	const selected = current !== void 0 && current.provider === provider && current.model === model.id;
	const effective = selected ? current.reasoningEffort ?? reasoning.defaultEffort : void 0;
	const items = [];
	if (reasoning.defaultEffort === void 0) items.push({
		label: defaultEffortLabel,
		type: "radio",
		checked: selected && current.reasoningEffort === void 0,
		click: () => {
			onSelect({
				provider,
				model: model.id
			});
		}
	});
	for (const effort of reasoning.efforts) items.push({
		label: effort.name,
		type: "radio",
		checked: effective === effort.id,
		click: () => {
			onSelect({
				provider,
				model: model.id,
				reasoningEffort: effort.id
			});
		}
	});
	return items.length === 0 ? void 0 : items;
}
const OVERLAY_ALWAYS_ON_TOP_LEVEL = "floating";
function clamp$1(value, min, max) {
	return Math.min(Math.max(value, min), Math.max(min, max));
}
function workAreaOf$1(point) {
	return screen.getDisplayNearestPoint({
		x: Math.round(point.x),
		y: Math.round(point.y)
	}).workArea;
}
function intersectRects(area, clip) {
	const x = Math.max(area.x, clip.x);
	const y = Math.max(area.y, clip.y);
	const right = Math.min(area.x + area.width, clip.x + clip.width);
	const bottom = Math.min(area.y + area.height, clip.y + clip.height);
	const width = right - x;
	const height = bottom - y;
	if (width >= 1 && height >= 1) return {
		x,
		y,
		width,
		height
	};
	return {
		x: clamp$1(area.x, clip.x, clip.x + clip.width - 1),
		y: clamp$1(area.y, clip.y, clip.y + clip.height - 1),
		width: 1,
		height: 1
	};
}
function edgePadding(inset) {
	return {
		glow: Math.max(0, Math.max(0, Math.round(inset)) - 8),
		stroke: 8
	};
}
function observationFramePadding(region, bounds) {
	const left = edgePadding(region.x - bounds.x);
	const top = edgePadding(region.y - bounds.y);
	const right = edgePadding(bounds.x + bounds.width - (region.x + region.width));
	const bottom = edgePadding(bounds.y + bounds.height - (region.y + region.height));
	return {
		glow: {
			top: top.glow,
			right: right.glow,
			bottom: bottom.glow,
			left: left.glow
		},
		stroke: {
			top: top.stroke,
			right: right.stroke,
			bottom: bottom.stroke,
			left: left.stroke
		}
	};
}
function observationFrameRegion(region) {
	if (process.platform !== "win32") return region;
	return screen.screenToDipRect(null, {
		x: Math.round(region.x),
		y: Math.round(region.y),
		width: Math.round(region.width),
		height: Math.round(region.height)
	});
}
function observationFramePlacement(region, workArea = workAreaOf$1({
	x: region.x + region.width / 2,
	y: region.y + region.height / 2
})) {
	const bounds = intersectRects({
		x: Math.round(region.x - 36),
		y: Math.round(region.y - 36),
		width: Math.max(1, Math.round(region.width + 72)),
		height: Math.max(1, Math.round(region.height + 72))
	}, workArea);
	const padding = observationFramePadding(region, bounds);
	return {
		bounds,
		glow: padding.glow,
		stroke: padding.stroke
	};
}
function observationFrameCssScript(glow, stroke) {
	return `(() => { const root = document.documentElement.style; ${[
		["--glow-top", glow.top],
		["--glow-right", glow.right],
		["--glow-bottom", glow.bottom],
		["--glow-left", glow.left],
		["--stroke-top", stroke.top],
		["--stroke-right", stroke.right],
		["--stroke-bottom", stroke.bottom],
		["--stroke-left", stroke.left]
	].map(([name, value]) => `root.setProperty(${JSON.stringify(name)}, ${JSON.stringify(`${String(value)}px`)});`).join("")} })()`;
}
const pendingFrameCss = /* @__PURE__ */ new WeakMap();
const waitingForFrameLoad = /* @__PURE__ */ new WeakSet();
function applyObservationFrameCss(window, glow, stroke) {
	pendingFrameCss.set(window, {
		glow,
		stroke
	});
	const applyLatest = () => {
		waitingForFrameLoad.delete(window);
		if (window.isDestroyed()) return;
		const latest = pendingFrameCss.get(window);
		if (latest === void 0) return;
		window.webContents.executeJavaScript(observationFrameCssScript(latest.glow, latest.stroke)).catch(() => {
			if (window.isDestroyed() || waitingForFrameLoad.has(window)) return;
			waitingForFrameLoad.add(window);
			window.webContents.once("did-finish-load", applyLatest);
		});
	};
	if (window.webContents.isLoading()) {
		if (!waitingForFrameLoad.has(window)) {
			waitingForFrameLoad.add(window);
			window.webContents.once("did-finish-load", applyLatest);
		}
		return;
	}
	applyLatest();
}
function createObservationFrameWindow() {
	const window = new BrowserWindow({
		width: 1,
		height: 1,
		frame: false,
		transparent: true,
		alwaysOnTop: true,
		skipTaskbar: true,
		focusable: false,
		...process.platform === "win32" ? {} : { type: "panel" },
		show: false,
		hasShadow: false,
		resizable: false,
		fullscreenable: false,
		minimizable: false,
		maximizable: false,
		roundedCorners: false,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			sandbox: true,
			webSecurity: true
		}
	});
	if (process.platform === "darwin") window.setVisibleOnAllWorkspaces(true, {
		visibleOnFullScreen: true,
		skipTransformProcessType: true
	});
	window.setAlwaysOnTop(true, OVERLAY_ALWAYS_ON_TOP_LEVEL, 0);
	if (process.platform === "win32") window.setContentProtection(true);
	window.setIgnoreMouseEvents(true, { forward: true });
	window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
	return window;
}
function showObservationFrame(window, region) {
	if (window.isDestroyed()) return;
	const logical = observationFrameRegion(region);
	const placement = observationFramePlacement(logical);
	window.setContentBounds(placement.bounds);
	window.setIgnoreMouseEvents(true, { forward: true });
	window.showInactive();
	window.setAlwaysOnTop(true, OVERLAY_ALWAYS_ON_TOP_LEVEL, 0);
	const padding = observationFramePadding(logical, window.getContentBounds());
	applyObservationFrameCss(window, padding.glow, padding.stroke);
}
function raiseOverlayAboveObservationFrame(overlay, toolbar) {
	const level = process.platform === "win32" ? "screen-saver" : OVERLAY_ALWAYS_ON_TOP_LEVEL;
	const relative = process.platform === "win32" ? void 0 : 1;
	if (overlay !== void 0 && !overlay.isDestroyed()) {
		overlay.setAlwaysOnTop(true, level, relative);
		overlay.moveTop();
	}
	if (toolbar !== void 0 && !toolbar.isDestroyed() && toolbar.isVisible()) {
		toolbar.setAlwaysOnTop(true, level, relative);
		toolbar.moveTop();
	}
}
function hideObservationFrame(window) {
	if (window === void 0 || window.isDestroyed()) return;
	window.hide();
}
// source/apps/desktop/src/floating-window.ts
function floatingContextMenuTemplate(params, messages, onOpenMain, onQuit, selection, agents, millifraction) {
	const labels = {
		empty: messages.floatingNoModels,
		defaultEffort: messages.floatingEffortDefault
	};
	const actions = [
		{
			label: messages.floatingOpenMain,
			click: onOpenMain
		},
		{ type: "separator" },
		...agents === void 0 ? [] : [
			{
				label: messages.floatingAgentSettings,
				submenu: floatingAgentModelItems(agents.catalog, agents.overlay, agents.onSelectOverlay, labels)
			},
			...agents.backgroundSupported === false ? [] : [{
				label: messages.floatingBackgroundAgentSettings,
				submenu: floatingAgentModelItems(agents.catalog, agents.background, agents.onSelectBackground, labels)
			}],
			{
				label: messages.floatingSelectionModelSettings,
				submenu: floatingSelectionModelItems(agents.catalog, agents.selection, agents.onSelectSelection, {
					...labels,
					follow: messages.selectionModelFollow
				})
			},
			{ type: "separator" }
		],
		{
			label: messages.floatingQuit,
			click: onQuit
		}
	];
	if (selection !== void 0 || millifraction !== void 0) {
		const extras = [];
		if (selection !== void 0) extras.push({
			label: selection.enabled ? messages.selectionToolbarDisable : messages.selectionToolbarEnable,
			click: selection.onToggle
		});
		if (millifraction !== void 0) extras.push({
			label: millifraction.enabled ? messages.millifractionDisable : messages.millifractionEnable,
			click: millifraction.onToggle
		});
		extras.push({ type: "separator" });
		const quitIndex = actions.findIndex((item) => item.label === messages.floatingQuit);
		actions.splice(quitIndex, 0, ...extras);
	}
	if (!params.isEditable) return actions;
	return [
		{
			role: "cut",
			enabled: params.editFlags.canCut
		},
		{
			role: "copy",
			enabled: params.editFlags.canCopy
		},
		{
			role: "paste",
			enabled: params.editFlags.canPaste
		},
		{ type: "separator" },
		...actions
	];
}
const FLOATING_PANEL_SIZE = {
	width: 320,
	height: 420
};
const FLOATING_BALL_DEFAULT_BELOW_CENTER = .08;
const FLOATING_PANEL_WINDOW_SIZE = {
	width: FLOATING_PANEL_SIZE.width + 24,
	height: FLOATING_PANEL_SIZE.height + 24
};
const overlayDirection = /* @__PURE__ */ new WeakMap();
const overlayDock = /* @__PURE__ */ new WeakMap();
const overlayAnim = /* @__PURE__ */ new WeakMap();
function clamp(value, min, max) {
	return Math.min(Math.max(value, min), Math.max(min, max));
}
function isCollapsedOverlay(bounds) {
	return bounds.width <= 96 && bounds.height <= 96;
}
function collapsedWindowBounds(ball) {
	return {
		x: ball.x - 12,
		y: ball.y - 12,
		width: 96,
		height: 96
	};
}
function clampWindowOrigin(value, workOrigin, workSize, windowSize) {
	return clamp(value, workOrigin - 12, workOrigin + workSize - windowSize + 12);
}
function displayGeometry(point) {
	const display = screen.getDisplayNearestPoint({
		x: Math.round(point.x),
		y: Math.round(point.y)
	});
	return {
		bounds: display.bounds,
		workArea: display.workArea
	};
}
function workAreaOf(point) {
	return displayGeometry(point).workArea;
}
function expandState(expanded, direction, docked) {
	return {
		expanded,
		horizontal: direction.horizontal,
		vertical: direction.vertical,
		docked
	};
}
function dockSideForBallOrigin(ball, bounds) {
	const leftOverlap = bounds.x - ball.x;
	const rightOverlap = ball.x + 72 - (bounds.x + bounds.width);
	if (leftOverlap >= 14 && leftOverlap >= rightOverlap) return "left";
	if (rightOverlap >= 14) return "right";
}
function dockedTabBounds(side, ballY, bounds) {
	const y = clamp(Math.round(ballY - 8), bounds.y, bounds.y + bounds.height - 88);
	return {
		x: side === "left" ? bounds.x : bounds.x + bounds.width - 34,
		y,
		width: 34,
		height: 88
	};
}
function clampBallY(ballY, bounds) {
	return clamp(Math.round(ballY), bounds.y, bounds.y + bounds.height - 72);
}
function offScreenBallOrigin(side, ballY, bounds) {
	const y = clampBallY(ballY, bounds);
	return {
		x: side === "left" ? bounds.x - 72 - 2 : bounds.x + bounds.width + 2,
		y
	};
}
function insideBallOrigin(side, ballY, display) {
	return {
		x: side === "left" ? display.bounds.x + 5 : display.bounds.x + display.bounds.width - 72 - 5,
		y: clamp(Math.round(ballY), display.workArea.y, display.workArea.y + display.workArea.height - 72)
	};
}
function staysDocked(side, cursorX, bounds) {
	if (side === "right") return cursorX >= bounds.x + bounds.width - 24;
	return cursorX <= bounds.x + 24;
}
function overlayDestroyed(window) {
	return typeof window.isDestroyed === "function" && window.isDestroyed();
}
function prefersReducedMotion() {
	return systemPreferences.getAnimationSettings().prefersReducedMotion;
}
function shouldAnimateDock(window) {
	return process.env.VITEST !== "true" && !overlayDestroyed(window) && !prefersReducedMotion();
}
function easeInOutCubic(t) {
	return t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
function easeOutCubic(t) {
	return 1 - (1 - t) ** 3;
}
function lerpRect(start, end, t) {
	return {
		x: Math.round(start.x + (end.x - start.x) * t),
		y: Math.round(start.y + (end.y - start.y) * t),
		width: Math.round(start.width + (end.width - start.width) * t),
		height: Math.round(start.height + (end.height - start.height) * t)
	};
}
function cancelOverlayAnim(window) {
	const anim = overlayAnim.get(window);
	if (anim === void 0) return;
	anim.cancelled = true;
	anim.resolve();
	overlayAnim.delete(window);
}
function animateOverlayBounds(window, end, durationMs, ease) {
	cancelOverlayAnim(window);
	const start = window.getBounds();
	if (!shouldAnimateDock(window) || durationMs <= 0) {
		window.setBounds(end);
		return Promise.resolve();
	}
	return new Promise((resolve) => {
		const anim = {
			cancelled: false,
			resolve
		};
		overlayAnim.set(window, anim);
		const t0 = Date.now();
		const tick = () => {
			if (anim.cancelled) return;
			if (overlayDestroyed(window)) {
				overlayAnim.delete(window);
				resolve();
				return;
			}
			const t = Math.min(1, (Date.now() - t0) / durationMs);
			window.setBounds(lerpRect(start, end, ease(t)));
			if (t < 1) {
				setTimeout(tick, 16);
				return;
			}
			overlayAnim.delete(window);
			resolve();
		};
		setTimeout(tick, 16);
	});
}
function applyDockedTab(window, side, ballY, bounds) {
	const y = clampBallY(ballY, bounds);
	overlayDock.set(window, {
		side,
		y
	});
	cancelOverlayAnim(window);
	window.setBounds(dockedTabBounds(side, y, bounds));
	return { docked: side };
}
async function snapToEdge(window, side, ballY, bounds) {
	const y = clampBallY(ballY, bounds);
	overlayDock.set(window, {
		side,
		y
	});
	await animateOverlayBounds(window, collapsedWindowBounds(offScreenBallOrigin(side, y, bounds)), 250, easeInOutCubic);
	if (overlayDestroyed(window)) return { docked: void 0 };
	const docked = overlayDock.get(window);
	if (docked === void 0 || docked.side !== side) return { docked: docked?.side };
	window.setBounds(dockedTabBounds(side, y, bounds));
	return { docked: side };
}
function clearDock(window) {
	overlayDock.delete(window);
}
function expandDirection(ball, workArea) {
	return {
		horizontal: ball.x + 36 - workArea.x > workArea.width / 2 ? "left" : "right",
		vertical: ball.y - workArea.y < FLOATING_PANEL_SIZE.height - 72 ? "down" : "up"
	};
}
function ballOriginFromWindow(bounds, direction) {
	return {
		x: direction.horizontal === "left" ? bounds.x + bounds.width - 12 - 72 : bounds.x + 12,
		y: direction.vertical === "up" ? bounds.y + bounds.height - 12 - 72 : bounds.y + 12
	};
}
function clampedBallOrigin(ball, workArea) {
	return {
		x: clamp(ball.x, workArea.x, workArea.x + workArea.width - 72),
		y: clamp(ball.y, workArea.y, workArea.y + workArea.height - 72)
	};
}
function defaultFloatingBallOrigin(workArea) {
	const x = workArea.x + workArea.width - 72;
	const y = workArea.y + (workArea.height - 72) / 2 + workArea.height * FLOATING_BALL_DEFAULT_BELOW_CENTER;
	return clampedBallOrigin({
		x: Math.round(x),
		y: Math.round(y)
	}, workArea);
}
function expandedOverlayBounds(ball, workArea) {
	const direction = expandDirection(ball, workArea);
	const unclamped = overlayBoundsFromBall(ball, direction);
	return {
		x: clampWindowOrigin(unclamped.x, workArea.x, workArea.width, unclamped.width),
		y: clampWindowOrigin(unclamped.y, workArea.y, workArea.height, unclamped.height),
		width: unclamped.width,
		height: unclamped.height,
		...direction
	};
}
function overlayBoundsFromBall(ball, direction) {
	const width = FLOATING_PANEL_WINDOW_SIZE.width;
	const height = FLOATING_PANEL_WINDOW_SIZE.height;
	return {
		x: direction.horizontal === "left" ? ball.x - (FLOATING_PANEL_SIZE.width - 72) - 12 : ball.x - 12,
		y: direction.vertical === "up" ? ball.y - (FLOATING_PANEL_SIZE.height - 72) - 12 : ball.y - 12,
		width,
		height
	};
}
function windowCenter(bounds) {
	return {
		x: bounds.x + bounds.width / 2,
		y: bounds.y + bounds.height / 2
	};
}
function currentBallOrigin(window, workArea) {
	const bounds = window.getBounds();
	const docked = overlayDock.get(window);
	if (docked !== void 0) return insideBallOrigin(docked.side, docked.y, displayGeometry(windowCenter(bounds)));
	if (isCollapsedOverlay(bounds)) return {
		x: bounds.x + 12,
		y: bounds.y + 12
	};
	return ballOriginFromWindow(bounds, overlayDirection.get(window) ?? expandDirection({
		x: bounds.x,
		y: bounds.y
	}, workArea));
}
function presentOverlayWindow(window) {
	if (process.platform === "darwin") {
		window.setVisibleOnAllWorkspaces(true, {
			visibleOnFullScreen: true,
			skipTransformProcessType: true
		});
		return;
	}
	if (process.platform === "win32") window.setAlwaysOnTop(true, "screen-saver");
}
function createFloatingWindow(preload, messages, onOpenMain, onQuit, selection, agents, millifraction, capture) {
	const bounds = collapsedWindowBounds(defaultFloatingBallOrigin(screen.getPrimaryDisplay().workArea));
	const window = new BrowserWindow({
		x: bounds.x,
		y: bounds.y,
		width: bounds.width,
		height: bounds.height,
		frame: false,
		transparent: true,
		alwaysOnTop: true,
		skipTaskbar: true,
		...process.platform === "win32" ? {} : { type: "panel" },
		show: true,
		hasShadow: false,
		resizable: false,
		fullscreenable: false,
		minimizable: false,
		maximizable: false,
		roundedCorners: false,
		webPreferences: {
			preload,
			nodeIntegration: false,
			contextIsolation: true,
			sandbox: true,
			webSecurity: true
		}
	});
	presentOverlayWindow(window);
	if (process.platform === "darwin") window.setAlwaysOnTop(true, OVERLAY_ALWAYS_ON_TOP_LEVEL, 1);
	window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
	window.webContents.on("context-menu", (_event, params) => {
		popupFloatingContextMenu(window, params, messages, onOpenMain, onQuit, selection, agents, millifraction, capture);
	});
	return window;
}
async function popupFloatingContextMenu(window, params, messages, onOpenMain, onQuit, selection, agents, millifraction, capture) {
	const catalog = agents === void 0 ? void 0 : await agents.loadCatalog().catch(() => void 0);
	if (window.isDestroyed()) return;
	const template = floatingContextMenuTemplate(params, messages, onOpenMain, onQuit, selection === void 0 ? void 0 : {
		enabled: selection.enabled(),
		onToggle: selection.toggle
	}, agents === void 0 ? void 0 : {
		catalog,
		overlay: agents.overlay(),
		background: agents.background(),
		onSelectOverlay: agents.onSelectOverlay,
		onSelectBackground: agents.onSelectBackground,
		...agents.backgroundSupported === void 0 ? {} : { backgroundSupported: agents.backgroundSupported },
		selection: agents.selection(),
		onSelectSelection: agents.onSelectSelection
	}, millifraction === void 0 ? void 0 : {
		enabled: millifraction.enabled(),
		onToggle: millifraction.toggle
	});
	if (capture) template.unshift({
		label: messages.captureTitle,
		click: capture
	}, { type: "separator" });
	Menu.buildFromTemplate(template).popup({ window });
}
function setFloatingExpanded(window, expanded) {
	const bounds = window.getBounds();
	const display = displayGeometry(windowCenter(bounds));
	const workArea = display.workArea;
	if (expanded) {
		const origin = currentBallOrigin(window, workArea);
		clearDock(window);
		const next = expandedOverlayBounds(origin, workArea);
		overlayDirection.set(window, {
			horizontal: next.horizontal,
			vertical: next.vertical
		});
		window.setBounds({
			x: next.x,
			y: next.y,
			width: next.width,
			height: next.height
		});
		return expandState(true, next, void 0);
	}
	const direction = overlayDirection.get(window) ?? expandDirection({
		x: bounds.x,
		y: bounds.y
	}, workArea);
	const docked = overlayDock.get(window);
	if (docked !== void 0) {
		applyDockedTab(window, docked.side, docked.y, display.bounds);
		return expandState(false, direction, docked.side);
	}
	const origin = clampedBallOrigin(currentBallOrigin(window, workArea), workArea);
	window.setBounds(collapsedWindowBounds(origin));
	return expandState(false, direction, void 0);
}
function moveFloatingBall(window, x, y, canDock = true) {
	const origin = {
		x: Math.round(x),
		y: Math.round(y)
	};
	if (!isCollapsedOverlay(window.getBounds()) && overlayDock.get(window) === void 0) {
		const direction = overlayDirection.get(window) ?? expandDirection(origin, workAreaOf(origin));
		window.setBounds(overlayBoundsFromBall(origin, direction));
		return { docked: void 0 };
	}
	if (!canDock) {
		clearDock(window);
		cancelOverlayAnim(window);
		window.setBounds(collapsedWindowBounds(origin));
		return { docked: void 0 };
	}
	const display = displayGeometry(origin);
	const existing = overlayDock.get(window);
	if (existing !== void 0 && staysDocked(existing.side, origin.x, display.bounds)) return applyDockedTab(window, existing.side, existing.y, display.bounds);
	clearDock(window);
	cancelOverlayAnim(window);
	window.setBounds(collapsedWindowBounds(origin));
	return { docked: void 0 };
}
async function clampFloatingWindow(window, canDock = true) {
	const bounds = window.getBounds();
	const display = displayGeometry(windowCenter(bounds));
	const docked = overlayDock.get(window);
	if (docked !== void 0) {
		applyDockedTab(window, docked.side, docked.y, display.bounds);
		return { docked: docked.side };
	}
	if (isCollapsedOverlay(bounds)) {
		const origin = {
			x: bounds.x + 12,
			y: bounds.y + 12
		};
		if (canDock) {
			const side = dockSideForBallOrigin(origin, display.bounds);
			if (side !== void 0) return snapToEdge(window, side, origin.y, display.bounds);
		}
		window.setBounds(collapsedWindowBounds(clampedBallOrigin(origin, display.workArea)));
		return { docked: void 0 };
	}
	setFloatingExpanded(window, true);
	return { docked: void 0 };
}
async function unsnapDockedBall(window) {
	const docked = overlayDock.get(window);
	if (docked === void 0) return { docked: void 0 };
	const display = displayGeometry(windowCenter(window.getBounds()));
	const start = offScreenBallOrigin(docked.side, docked.y, display.bounds);
	const end = insideBallOrigin(docked.side, docked.y, display);
	clearDock(window);
	window.setBounds(collapsedWindowBounds(start));
	await animateOverlayBounds(window, collapsedWindowBounds(end), 300, easeOutCubic);
	return { docked: void 0 };
}
const overlayGuardCounts = /* @__PURE__ */ new WeakMap();
const overlayClickThrough = /* @__PURE__ */ new WeakMap();
function countsOf(window) {
	const existing = overlayGuardCounts.get(window);
	if (existing !== void 0) return existing;
	const created = {
		capture: 0,
		input: 0
	};
	overlayGuardCounts.set(window, created);
	return created;
}
function cgWindowIdFromMediaSourceId(sourceId) {
	const match = /^window:(\d+)(?::|$)/u.exec(sourceId);
	if (match === null) throw new Error(`dsh desktop: overlay media source id is not a CGWindowID: ${sourceId}`);
	const id = Number(match[1]);
	if (!Number.isSafeInteger(id) || id < 1) throw new Error(`dsh desktop: overlay media source id is not a CGWindowID: ${sourceId}`);
	return id;
}
function overlayWindowExcludeIds(...windows) {
	const ids = [];
	for (const window of windows) {
		if (window === void 0 || window.isDestroyed() || !window.isVisible()) continue;
		ids.push(cgWindowIdFromMediaSourceId(window.getMediaSourceId()));
	}
	return ids;
}
function syncOverlayGuard(window, counts) {
	if (window.isDestroyed()) return;
	window.setContentProtection(process.platform === "win32" && (counts.capture > 0 || counts.input > 0));
	const clickThrough = counts.input > 0;
	if (overlayClickThrough.get(window) === clickThrough) return;
	overlayClickThrough.set(window, clickThrough);
	if (clickThrough) {
		window.setIgnoreMouseEvents(true, { forward: false });
		window.blur();
		return;
	}
	window.setIgnoreMouseEvents(false);
}
function applyFloatingOverlayGuard(window, mode, action) {
	if (window.isDestroyed()) return;
	const counts = countsOf(window);
	if (action === "begin") counts[mode] += 1;
	else counts[mode] = Math.max(0, counts[mode] - 1);
	syncOverlayGuard(window, counts);
}
function resetFloatingOverlayGuard(window) {
	overlayGuardCounts.delete(window);
	overlayClickThrough.delete(window);
	if (window.isDestroyed()) return;
	window.setContentProtection(false);
	window.setIgnoreMouseEvents(false);
}
// source/apps/desktop/src/orb-agent-models.ts
const DEFAULT_ORB_AGENT_MODEL = {
	provider: "deepseek-official",
	model: "deepseek-flash",
	reasoningEffort: "max"
};
function isOrbAgentModelSelection(value) {
	return parseSelection(value, {
		provider: "",
		model: ""
	}).provider !== "";
}
/**
* 规范化一条模型选择；缺少供应商或模型时返回 undefined。
* @param value 来自配置文件的未知值。
* @returns 仅含 provider、model 与可选 reasoningEffort 的选择。
*/
function parseOrbAgentModelSelection(value) {
	const parsed = parseSelection(value, {
		provider: "",
		model: ""
	});
	return parsed.provider === "" ? void 0 : parsed;
}
function parseSelection(value, fallback) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return fallback;
	const record = value;
	if (typeof record.provider !== "string" || record.provider === "" || typeof record.model !== "string" || record.model === "") return fallback;
	if (record.reasoningEffort !== void 0 && (typeof record.reasoningEffort !== "string" || record.reasoningEffort === "")) return fallback;
	return {
		provider: record.provider,
		model: record.model,
		...record.reasoningEffort === void 0 ? {} : { reasoningEffort: record.reasoningEffort }
	};
}
function readOrbAgentModels(profileDir) {
	const config = readDesktopToolsConfig(profileDir).floatingBall;
	return {
		overlay: parseSelection(config.conversationModel, DEFAULT_ORB_AGENT_MODEL),
		background: parseSelection(config.backgroundModel, DEFAULT_ORB_AGENT_MODEL)
	};
}
function writeOrbAgentModels(profileDir, models) {
	const current = readDesktopToolsConfig(profileDir);
	writeDesktopToolsConfig(profileDir, {
		...current,
		floatingBall: {
			...current.floatingBall,
			conversationModel: serializeSelection(models.overlay),
			backgroundModel: serializeSelection(models.background)
		}
	});
}
function serializeSelection(selection) {
	return {
		provider: selection.provider,
		model: selection.model,
		...selection.reasoningEffort === void 0 ? {} : { reasoningEffort: selection.reasoningEffort }
	};
}
export { raiseOverlayAboveObservationFrame as _, applyFloatingOverlayGuard as a, moveFloatingBall as c, resetFloatingOverlayGuard as d, setFloatingExpanded as f, hideObservationFrame as g, createObservationFrameWindow as h, writeOrbAgentModels as i, overlayWindowExcludeIds as l, OVERLAY_ALWAYS_ON_TOP_LEVEL as m, parseOrbAgentModelSelection as n, clampFloatingWindow as o, unsnapDockedBall as p, readOrbAgentModels as r, createFloatingWindow as s, isOrbAgentModelSelection as t, presentOverlayWindow as u, showObservationFrame as v };
