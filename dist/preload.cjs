let electron = require("electron");
// source/apps/desktop/src/ipc.ts
const DESKTOP_IPC = {
	captureResult: "dsh-desktop:capture-result",
	fileSave: "dsh-desktop:file-save",
	clipboardImageRead: "dsh-desktop:clipboard-image-read",
	shortcutsInput: "dsh-desktop:shortcuts-input",
	shortcutsCloseWindow: "dsh-desktop:shortcuts-close-window",
	shortcutsGet: "dsh-desktop:shortcuts-get",
	shortcutsEdit: "dsh-desktop:shortcuts-edit",
	shortcutsChanged: "dsh-desktop:shortcuts-changed",
	shortcutsRecording: "dsh-desktop:shortcuts-recording",
	boot: "dsh-desktop:boot",
	enterWorkspace: "dsh-desktop:enter-workspace",
	onboardingActive: "dsh-desktop:onboarding-active",
	onboardingApiKey: "dsh-desktop:onboarding-api-key",
	bootFailed: "dsh-desktop:boot-failed",
	browserAcquire: "dsh-desktop:browser-acquire",
	browserRelease: "dsh-desktop:browser-release",
	browserOpenRequested: "dsh-desktop:browser-open-requested",
	directoryPick: "dsh-desktop:directory-pick",
	fileDragPrepare: "dsh-desktop:file-drag-prepare",
	fileDragCancel: "dsh-desktop:file-drag-cancel",
	fileDragStart: "dsh-desktop:file-drag-start",
	fileDragRelease: "dsh-desktop:file-drag-release",
	deviceInfo: "dsh-desktop:device-info",
	localeBootstrap: "dsh-desktop:locale-bootstrap",
	localeChanged: "dsh-desktop:locale-changed",
	updatesChannelGet: "dsh-desktop:updates-channel-get",
	updatesChannelSet: "dsh-desktop:updates-channel-set",
	updatesChannelChanged: "dsh-desktop:updates-channel-changed",
	updatesStatus: "dsh-desktop:updates-status",
	updatesOpen: "dsh-desktop:updates-open",
	updatesPresentation: "dsh-desktop:updates-presentation",
	nativeThemeSet: "dsh-desktop:native-theme-set",
	windowFullscreen: "dsh-desktop:window-fullscreen",
	windowsAppearance: "dsh-desktop:windows-appearance",
	windowsMenu: "dsh-desktop:windows-menu",
	floatingMove: "dsh-desktop:floating-move",
	floatingClamp: "dsh-desktop:floating-clamp",
	floatingUnsnap: "dsh-desktop:floating-unsnap",
	floatingSetExpanded: "dsh-desktop:floating-set-expanded",
	floatingFollowSession: "dsh-desktop:floating-follow-session",
	floatingFollowState: "dsh-desktop:floating-follow-state",
	floatingCatalog: "dsh-desktop:floating-catalog",
	floatingCatalogGet: "dsh-desktop:floating-catalog-get",
	floatingNavigate: "dsh-desktop:floating-navigate",
	floatingSessionGet: "dsh-desktop:floating-session-get",
	floatingSessionSet: "dsh-desktop:floating-session-set",
	floatingOverlayModelGet: "dsh-desktop:floating-overlay-model-get",
	floatingOverlayModel: "dsh-desktop:floating-overlay-model",
	floatingOverlayPermissionGet: "dsh-desktop:floating-overlay-permission-get",
	floatingOverlayPermissionSet: "dsh-desktop:floating-overlay-permission-set",
	floatingOrbWorkspace: "dsh-desktop:floating-orb-workspace",
	floatingFocusMain: "dsh-desktop:floating-focus-main",
	floatingQuit: "dsh-desktop:floating-quit",
	floatingRunning: "dsh-desktop:floating-running",
	floatingEditing: "dsh-desktop:floating-editing",
	floatingRestoreFront: "dsh-desktop:floating-restore-front",
	floatingAvatarGet: "dsh-desktop:floating-avatar-get",
	floatingAvatar: "dsh-desktop:floating-avatar",
	floatingTccGet: "dsh-desktop:floating-tcc-get",
	floatingTccOpen: "dsh-desktop:floating-tcc-open",
	floatingTccRelaunch: "dsh-desktop:floating-tcc-relaunch",
	floatingTcc: "dsh-desktop:floating-tcc",
	floatingCreateSession: "dsh-desktop:floating-create-session",
	floatingLocale: "dsh-desktop:floating-locale",
	backendStatus: "dsh-desktop:backend-status",
	backendState: "dsh-desktop:backend-state",
	selectionPrompt: "dsh-desktop:selection-prompt",
	selectionAttach: "dsh-desktop:selection-attach",
	selectionSearch: "dsh-desktop:selection-search",
	selectionTranslate: "dsh-desktop:selection-translate",
	selectionAction: "dsh-desktop:selection-action",
	selectionResult: "dsh-desktop:selection-result",
	selectionResultState: "dsh-desktop:selection-result-state",
	selectionSetLanguage: "dsh-desktop:selection-set-language",
	selectionInteract: "dsh-desktop:selection-interact",
	selectionSetContentSize: "dsh-desktop:selection-set-content-size",
	selectionState: "dsh-desktop:selection-state",
	orbSupported: "dsh-desktop:orb-supported",
	orbSnapshot: "dsh-desktop:orb-snapshot",
	orbPickAvatar: "dsh-desktop:orb-pick-avatar",
	orbRestoreAvatar: "dsh-desktop:orb-restore-avatar",
	orbSetOverlayModel: "dsh-desktop:orb-set-overlay-model",
	orbSetBackgroundModel: "dsh-desktop:orb-set-background-model",
	orbSetSelectionEnabled: "dsh-desktop:orb-set-selection-enabled",
	orbSetMillifractionEnabled: "dsh-desktop:orb-set-millifraction-enabled",
	orbOpenTcc: "dsh-desktop:orb-open-tcc"
};
// source/apps/desktop/src/preload.ts
const floating = {
	sessionCatalog: () => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingCatalogGet),
	navigateSession: (request) => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingNavigate, request),
	onSessionCatalog: (listener) => {
		const handle = (_event, catalog) => {
			listener(catalog);
		};
		electron.ipcRenderer.on(DESKTOP_IPC.floatingCatalog, handle);
		return () => {
			electron.ipcRenderer.off(DESKTOP_IPC.floatingCatalog, handle);
		};
	},
	followSession: (sessionId) => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingFollowSession, sessionId),
	followedSession: () => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingFollowState),
	onFollowSession: (listener) => {
		const handle = (_event, sessionId) => {
			listener(sessionId);
		};
		electron.ipcRenderer.on(DESKTOP_IPC.floatingFollowSession, handle);
		return () => {
			electron.ipcRenderer.off(DESKTOP_IPC.floatingFollowSession, handle);
		};
	},
	move: (x, y, canDock) => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingMove, x, y, canDock),
	clamp: (canDock) => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingClamp, canDock),
	unsnap: () => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingUnsnap),
	setExpanded: (expanded) => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingSetExpanded, expanded),
	sessionId: () => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingSessionGet),
	setSessionId: (sessionId) => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingSessionSet, sessionId),
	overlayModel: () => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingOverlayModelGet),
	onOverlayModel: (listener) => {
		const handle = (_event, selection) => {
			listener(selection);
		};
		electron.ipcRenderer.on(DESKTOP_IPC.floatingOverlayModel, handle);
		return () => {
			electron.ipcRenderer.off(DESKTOP_IPC.floatingOverlayModel, handle);
		};
	},
	overlayPermission: () => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingOverlayPermissionGet),
	setOverlayPermission: (preset, sessionId) => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingOverlayPermissionSet, preset, sessionId),
	orbWorkspacePath: () => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingOrbWorkspace),
	focusMain: () => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingFocusMain),
	quit: () => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingQuit),
	setSessionRunning: (running) => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingRunning, running),
	setTextEditing: (editing) => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingEditing, editing),
	restoreFrontApp: () => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingRestoreFront),
	avatarUrl: () => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingAvatarGet),
	onAvatar: (listener) => {
		const handle = (_event, url) => {
			listener(url);
		};
		electron.ipcRenderer.on(DESKTOP_IPC.floatingAvatar, handle);
		return () => {
			electron.ipcRenderer.off(DESKTOP_IPC.floatingAvatar, handle);
		};
	},
	onSelectionPrompt: (listener) => {
		const handle = (_event, payload) => {
			listener(payload);
		};
		electron.ipcRenderer.on(DESKTOP_IPC.selectionPrompt, handle);
		return () => {
			electron.ipcRenderer.off(DESKTOP_IPC.selectionPrompt, handle);
		};
	},
	onSelectionAttach: (listener) => {
		const handle = (_event, payload) => {
			listener(payload);
		};
		electron.ipcRenderer.on(DESKTOP_IPC.selectionAttach, handle);
		return () => {
			electron.ipcRenderer.off(DESKTOP_IPC.selectionAttach, handle);
		};
	},
	onCreateSession: (listener) => {
		const handle = () => {
			listener();
		};
		electron.ipcRenderer.on(DESKTOP_IPC.floatingCreateSession, handle);
		return () => {
			electron.ipcRenderer.off(DESKTOP_IPC.floatingCreateSession, handle);
		};
	},
	tccStatus: () => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingTccGet),
	openTcc: (right) => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingTccOpen, right),
	relaunch: () => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingTccRelaunch),
	onTccStatus: (listener) => {
		const handle = (_event, status) => {
			listener(status);
		};
		electron.ipcRenderer.on(DESKTOP_IPC.floatingTcc, handle);
		return () => {
			electron.ipcRenderer.off(DESKTOP_IPC.floatingTcc, handle);
		};
	}
};
const selection = {
	search: () => electron.ipcRenderer.invoke(DESKTOP_IPC.selectionSearch),
	translate: () => electron.ipcRenderer.invoke(DESKTOP_IPC.selectionTranslate),
	action: (action) => electron.ipcRenderer.invoke(DESKTOP_IPC.selectionAction, action),
	result: (operation, input) => electron.ipcRenderer.invoke(DESKTOP_IPC.selectionResult, operation, input),
	onResultState: (listener) => {
		const handle = (_event, state) => {
			listener(state);
		};
		electron.ipcRenderer.on(DESKTOP_IPC.selectionResultState, handle);
		return () => {
			electron.ipcRenderer.off(DESKTOP_IPC.selectionResultState, handle);
		};
	},
	sendToAgent: () => electron.ipcRenderer.invoke(DESKTOP_IPC.selectionAttach),
	setLanguage: (language) => electron.ipcRenderer.invoke(DESKTOP_IPC.selectionSetLanguage, language),
	interact: () => electron.ipcRenderer.invoke(DESKTOP_IPC.selectionInteract),
	setContentSize: (size) => electron.ipcRenderer.invoke(DESKTOP_IPC.selectionSetContentSize, size),
	onState: (listener) => {
		const handle = (_event, state) => {
			listener(state);
		};
		electron.ipcRenderer.on(DESKTOP_IPC.selectionState, handle);
		return () => {
			electron.ipcRenderer.off(DESKTOP_IPC.selectionState, handle);
		};
	}
};
const backend = {
	status: () => electron.ipcRenderer.invoke(DESKTOP_IPC.backendStatus),
	subscribe: (listener) => {
		const handle = (_event, state) => {
			listener(state);
		};
		electron.ipcRenderer.on(DESKTOP_IPC.backendState, handle);
		return () => {
			electron.ipcRenderer.off(DESKTOP_IPC.backendState, handle);
		};
	}
};
const { navigateSession: _navigateSession, ...standaloneFloating } = floating;
electron.contextBridge.exposeInMainWorld("dshDesktop", {
	runtime: "standalone",
	protocolVersion: 1,
	capture: { result: (operation, input) => electron.ipcRenderer.invoke(DESKTOP_IPC.captureResult, operation, input) },
	locale: () => electron.ipcRenderer.invoke(DESKTOP_IPC.floatingLocale),
	backend,
	floating: standaloneFloating,
	selection
});
