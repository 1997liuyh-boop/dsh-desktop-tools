import { useState as u, useEffect as B } from "react";
import { z as g } from "zod";
import { createTypertRemoteInfo as q } from "@deepseek-ai/dsh-typert-protocol/remote-info";
const J = ["selection", "floating", "screenshot", "recording"];
function Q(e, s) {
  return s(e === "active" ? "featureActive" : e === "starting" ? "featureStarting" : e === "error" ? "featureError" : "featureDisabled");
}
function V(e) {
  const s = {
    selection: e.config.selection.enabled,
    floatingBall: e.config.floatingBall.enabled,
    capture: e.config.screenshot.enabled || e.config.recording.enabled
  };
  return Object.keys(s).every((r) => {
    const p = e.features[r].phase;
    return s[r] ? p === "active" : p === "disabled";
  });
}
function j({ value: e, disabled: s, t: r, onChange: p }) {
  return /* @__PURE__ */ React.createElement("div", { className: "grid min-w-0 gap-3 sm:grid-cols-3" }, ["provider", "model", "reasoningEffort"].map((n) => /* @__PURE__ */ React.createElement("label", { className: "grid min-w-0 gap-1 text-sm", key: n }, /* @__PURE__ */ React.createElement("span", { className: "text-[var(--dsw-alias-label-tertiary)]" }, r(n === "reasoningEffort" ? "effort" : n)), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "min-w-0 rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2 text-[var(--dsw-alias-label-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--dsw-alias-brand-primary)] disabled:opacity-60",
      disabled: s,
      value: e[n] ?? "",
      onChange: (v) => p({ ...e, [n]: v.currentTarget.value })
    }
  ))));
}
function W({ t: e, services: s }) {
  const [r, p] = u("selection"), [n, v] = u(), [a, l] = u(), [k, E] = u(), [w, R] = u(), [o, d] = u(!1), [N, z] = u(!1), [h, m] = u(""), [S, C] = u(), [U, F] = u(0), T = async () => {
    const t = await s.snapshot();
    if (!t.ok) {
      m(e("loadError"));
      return;
    }
    v(t.value), l(t.value.config), m("");
    const i = await s.avatar();
    i.ok && E(i.value.dataUrl);
  };
  B(() => {
    T();
  }, []);
  const K = async () => {
    if (a === void 0 || o) return;
    d(!0), m("");
    const t = await s.update(a);
    if (d(!1), !t.ok) {
      m(e("saveError"));
      return;
    }
    v(t.value.snapshot), l(t.value.snapshot.config), z(!t.value.applied), m(t.value.applied ? e("saved") : e("pending"));
  }, $ = async () => {
    if (o) return;
    d(!0);
    const t = await s.restart();
    if (d(!1), !t.ok) {
      m(e("pending"));
      return;
    }
    v(t.value);
    const i = V(t.value);
    z(!i), m(e(i ? "saved" : "pending"));
  }, G = (t, i) => {
    a !== void 0 && l(t === "selection" ? { ...a, selection: { ...a.selection, enabled: i } } : t === "floating" ? { ...a, floatingBall: { ...a.floatingBall, enabled: i } } : t === "screenshot" ? { ...a, screenshot: { enabled: i } } : { ...a, recording: { enabled: i } });
  }, M = n == null ? void 0 : n.features[r === "floating" ? "floatingBall" : r === "selection" ? "selection" : "capture"], H = a === void 0 ? !1 : r === "selection" ? a.selection.enabled : r === "floating" ? a.floatingBall.enabled : r === "screenshot" ? a.screenshot.enabled : a.recording.enabled, I = async (t) => {
    if (t.key === "Escape") {
      t.preventDefault(), C(void 0);
      return;
    }
    if (/^(Control|Alt|Shift|Meta)$/u.test(t.key)) return;
    t.preventDefault();
    const i = S === "screenshot" ? "desktop-tools.screenshot" : "desktop-tools.recording", c = [];
    (t.ctrlKey || t.metaKey) && c.push("primary"), t.altKey && c.push("alt"), t.shiftKey && c.push("shift");
    const y = await s.editShortcut(i, { code: t.code, modifiers: c });
    m(y ?? ""), y === void 0 && F((A) => A + 1), C(void 0);
  };
  B(() => {
    if (S === void 0) return;
    const t = (i) => {
      I(i);
    };
    return document.addEventListener("keydown", t, !0), () => document.removeEventListener("keydown", t, !0);
  }, [S]);
  const O = (t) => {
    var y;
    const i = (y = t.currentTarget.files) == null ? void 0 : y[0];
    if (t.currentTarget.value = "", i === void 0 || !i.type.match(/^image\/(gif|png|webp)$/u)) return;
    const c = new FileReader();
    c.onload = () => {
      typeof c.result == "string" && s.setAvatar(c.result, i.name).then((A) => {
        A.ok && typeof c.result == "string" ? E(c.result) : m(e("saveError"));
      });
    }, c.readAsDataURL(i);
  }, D = async () => {
    const t = await s.systemPermissions();
    t.ok ? R(t.value) : m(e("pending"));
  }, P = (t, i) => {
    a !== void 0 && l(t === "selection" ? { ...a, selection: { ...a.selection, model: i } } : t === "conversationModel" ? { ...a, floatingBall: { ...a.floatingBall, conversationModel: i } } : { ...a, floatingBall: { ...a.floatingBall, backgroundModel: i } });
  }, _ = (t) => {
    if (a !== void 0)
      if (t) l({ ...a, selection: { ...a.selection, model: { provider: "deepseek-official", model: "deepseek-flash", reasoningEffort: "max" } } });
      else {
        const { model: i, ...c } = a.selection;
        l({ ...a, selection: c });
      }
  };
  return a === void 0 ? /* @__PURE__ */ React.createElement("section", { className: "grid gap-4", "aria-busy": "true" }, /* @__PURE__ */ React.createElement("h2", { className: "text-base font-semibold text-[var(--dsw-alias-label-primary)]" }, e("title")), h ? /* @__PURE__ */ React.createElement("p", { role: "alert", className: "text-sm text-[var(--dsw-alias-state-error-primary)]" }, h) : /* @__PURE__ */ React.createElement("p", { role: "status", className: "text-sm text-[var(--dsw-alias-label-tertiary)]" }, "…")) : /* @__PURE__ */ React.createElement("section", { className: "grid min-w-0 gap-4 text-[var(--dsw-alias-label-primary)]", "aria-busy": o }, /* @__PURE__ */ React.createElement("header", { className: "flex min-w-0 flex-wrap items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("h2", { className: "text-base font-semibold" }, e("title")), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-[var(--dsw-alias-label-tertiary)]" }, (n == null ? void 0 : n.runtime) === "running" ? e("runtimeRunning") : (n == null ? void 0 : n.runtime) === "degraded" ? e("runtimeDegraded") : e("runtimeStopped"))), /* @__PURE__ */ React.createElement("nav", { className: "flex flex-wrap gap-1 border-b border-[var(--border-subtle)]", "aria-label": e("title") }, J.map((t) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: t,
      type: "button",
      role: "tab",
      "aria-selected": r === t,
      onClick: () => p(t),
      className: "max-w-full border-b-2 border-transparent px-3 py-2 text-sm text-[var(--dsw-alias-label-tertiary)] hover:text-[var(--dsw-alias-label-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--dsw-alias-brand-primary)] aria-selected:border-[var(--dsw-alias-brand-primary)] aria-selected:text-[var(--dsw-alias-label-primary)]"
    },
    e(t)
  ))), /* @__PURE__ */ React.createElement("div", { className: "grid min-w-0 gap-4", role: "tabpanel" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("label", { className: "flex min-h-10 items-center gap-2 text-sm" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: H, onChange: (t) => G(r, t.currentTarget.checked) }), e("enabled")), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-[var(--dsw-alias-label-tertiary)]" }, Q((M == null ? void 0 : M.phase) ?? "disabled", e))), r === "selection" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("label", { className: "grid gap-1 text-sm" }, /* @__PURE__ */ React.createElement("span", null, e("language")), /* @__PURE__ */ React.createElement("input", { className: "min-w-0 rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2", value: a.selection.targetLanguage, onChange: (t) => l({ ...a, selection: { ...a.selection, targetLanguage: t.currentTarget.value } }) })), /* @__PURE__ */ React.createElement("label", { className: "flex min-h-10 items-center gap-2 text-sm" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: a.selection.compatibilityCopy, onChange: (t) => l({ ...a, selection: { ...a.selection, compatibilityCopy: t.currentTarget.checked } }) }), e("compatibilityCopy")), /* @__PURE__ */ React.createElement("label", { className: "flex min-h-10 items-center gap-2 text-sm" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: a.selection.model !== void 0, onChange: (t) => _(t.currentTarget.checked) }), e("customModel")), a.selection.model === void 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-sm text-[var(--dsw-alias-label-tertiary)]" }, e("followSession")) : /* @__PURE__ */ React.createElement(j, { value: a.selection.model, disabled: o, t: e, onChange: (t) => P("selection", t) })), r === "floating" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-3" }, k === void 0 ? /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true", className: "size-12 rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)]" }) : /* @__PURE__ */ React.createElement("img", { src: k, alt: "", className: "size-12 rounded border border-[var(--dsw-alias-border-l2)] object-cover" }), /* @__PURE__ */ React.createElement("label", { className: "cursor-pointer rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-[var(--dsw-alias-brand-primary)]" }, e("chooseAvatar"), /* @__PURE__ */ React.createElement("input", { className: "sr-only", type: "file", accept: "image/gif,image/png,image/webp", onChange: O })), /* @__PURE__ */ React.createElement("button", { type: "button", className: "rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm", onClick: () => {
    s.restoreAvatar().then((t) => {
      t.ok && T();
    });
  } }, e("restoreAvatar"))), /* @__PURE__ */ React.createElement("h3", { className: "text-sm font-medium" }, e("conversationModel")), /* @__PURE__ */ React.createElement(j, { value: a.floatingBall.conversationModel, disabled: o, t: e, onChange: (t) => P("conversationModel", t) }), /* @__PURE__ */ React.createElement("h3", { className: "text-sm font-medium" }, e("backgroundModel")), /* @__PURE__ */ React.createElement(j, { value: a.floatingBall.backgroundModel, disabled: o, t: e, onChange: (t) => P("backgroundModel", t) }), /* @__PURE__ */ React.createElement("label", { className: "grid gap-1 text-sm" }, /* @__PURE__ */ React.createElement("span", null, e("permissionPreset")), /* @__PURE__ */ React.createElement("select", { className: "rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2", value: a.floatingBall.permissionPreset, onChange: (t) => l({ ...a, floatingBall: { ...a.floatingBall, permissionPreset: t.currentTarget.value } }) }, /* @__PURE__ */ React.createElement("option", { value: "read-only" }, "read-only"), /* @__PURE__ */ React.createElement("option", { value: "workspace-write" }, "workspace-write"), /* @__PURE__ */ React.createElement("option", { value: "danger-full-access" }, "danger-full-access"))), /* @__PURE__ */ React.createElement("label", { className: "grid gap-1 text-sm" }, /* @__PURE__ */ React.createElement("span", null, e("coordinateMode")), /* @__PURE__ */ React.createElement("select", { className: "rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2", value: a.floatingBall.coordinateMode, onChange: (t) => l({ ...a, floatingBall: { ...a.floatingBall, coordinateMode: t.currentTarget.value } }) }, /* @__PURE__ */ React.createElement("option", { value: "millifraction" }, "millifraction"), /* @__PURE__ */ React.createElement("option", { value: "pixel" }, "pixel"))), /* @__PURE__ */ React.createElement("div", { className: "grid gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-2" }, /* @__PURE__ */ React.createElement("h3", { className: "text-sm font-medium" }, e("systemPermissions")), /* @__PURE__ */ React.createElement("button", { type: "button", className: "text-sm text-[var(--dsw-alias-brand-primary)]", onClick: () => {
    D();
  } }, e("check"))), ["screen", "accessibility"].map((t) => /* @__PURE__ */ React.createElement("div", { key: t, className: "flex flex-wrap items-center justify-between gap-2 text-sm" }, /* @__PURE__ */ React.createElement("span", null, e(t === "screen" ? "screenPermission" : "accessibilityPermission")), /* @__PURE__ */ React.createElement("span", null, (w == null ? void 0 : w[t]) === !0 ? e("permissionGranted") : (w == null ? void 0 : w[t]) === !1 ? e("permissionDenied") : e("permissionUnknown")), /* @__PURE__ */ React.createElement("button", { type: "button", className: "text-[var(--dsw-alias-brand-primary)]", onClick: () => {
    s.openSystemPermission(t).then(() => {
      D();
    });
  } }, e("openSettings")))))), (r === "screenshot" || r === "recording") && /* @__PURE__ */ React.createElement("div", { className: "grid gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm text-[var(--dsw-alias-label-tertiary)]" }, e("shortcut")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2" }, /* @__PURE__ */ React.createElement("kbd", { key: U, className: "rounded border border-[var(--dsw-alias-border-l2)] px-2 py-1 text-sm" }, s.shortcutLabel(r === "screenshot" ? "desktop-tools.screenshot" : "desktop-tools.recording")), /* @__PURE__ */ React.createElement("button", { type: "button", className: "rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--dsw-alias-brand-primary)]", onClick: () => C(r) }, e(S === r ? "recordingShortcut" : "recordShortcut"))))), h && /* @__PURE__ */ React.createElement("p", { role: "status", className: h === e("saved") ? "text-sm text-[var(--dsw-alias-state-success-primary)]" : "text-sm text-[var(--dsw-alias-state-error-primary)]" }, h), /* @__PURE__ */ React.createElement("footer", { className: "flex flex-wrap justify-end gap-2 border-t border-[var(--dsw-alias-border-l2)] pt-3" }, /* @__PURE__ */ React.createElement("button", { type: "button", disabled: o, className: "rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm disabled:opacity-50", onClick: () => {
    T();
  } }, e("check")), N && /* @__PURE__ */ React.createElement("button", { type: "button", disabled: o, className: "rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm disabled:opacity-50", onClick: () => {
    $();
  } }, e("retry")), /* @__PURE__ */ React.createElement("button", { type: "button", disabled: o, className: "rounded bg-[var(--dsw-alias-brand-primary)] px-3 py-2 text-sm text-white disabled:opacity-50", onClick: () => {
    K();
  } }, e(o ? "saving" : "save"))));
}
const X = {
  title: "Desktop tools",
  selection: "Selection toolbar",
  floating: "Floating assistant",
  screenshot: "Screenshot",
  recording: "Screen recording",
  enabled: "Enabled",
  language: "Target language",
  compatibilityCopy: "Copy selected text to clipboard",
  followSession: "Follow the current session",
  customModel: "Use a fixed model",
  model: "Model",
  provider: "Provider",
  effort: "Reasoning effort",
  conversationModel: "Conversation model",
  backgroundModel: "Background model",
  permissionPreset: "Permission preset",
  coordinateMode: "Coordinate mode",
  avatar: "Avatar",
  chooseAvatar: "Choose image",
  restoreAvatar: "Restore default",
  systemPermissions: "System permissions",
  screenPermission: "Screen recording",
  accessibilityPermission: "Accessibility",
  check: "Check",
  openSettings: "Open system settings",
  shortcut: "Shortcut",
  recordShortcut: "Record shortcut",
  recordingShortcut: "Press a key combination. Escape cancels.",
  save: "Save",
  saving: "Saving…",
  retry: "Retry apply",
  saved: "Saved and applied",
  pending: "Saved, not yet applied",
  loadError: "Could not load desktop tools settings.",
  saveError: "Could not save desktop tools settings.",
  noRuntime: "Available only in DSH Desktop.",
  runtimeStopped: "Helper is stopped",
  runtimeRunning: "Helper is running",
  runtimeDegraded: "Some tools need attention",
  featureDisabled: "Disabled",
  featureStarting: "Starting",
  featureActive: "Running",
  featureError: "Error",
  permissionGranted: "Granted",
  permissionDenied: "Not granted",
  permissionUnknown: "Unknown"
}, Y = {
  title: "桌面工具",
  selection: "划词工具栏",
  floating: "悬浮球",
  screenshot: "截屏",
  recording: "录屏",
  enabled: "启用",
  language: "目标语言",
  compatibilityCopy: "将所选文本复制到剪贴板",
  followSession: "跟随当前会话",
  customModel: "固定使用此模型",
  model: "模型",
  provider: "服务商",
  effort: "推理强度",
  conversationModel: "对话模型",
  backgroundModel: "后台模型",
  permissionPreset: "权限预设",
  coordinateMode: "坐标模式",
  avatar: "头像",
  chooseAvatar: "选择图片",
  restoreAvatar: "恢复默认头像",
  systemPermissions: "系统权限",
  screenPermission: "屏幕录制",
  accessibilityPermission: "辅助功能",
  check: "重新检测",
  openSettings: "打开系统设置",
  shortcut: "快捷键",
  recordShortcut: "录制快捷键",
  recordingShortcut: "按下组合键，按 Esc 取消。",
  save: "保存",
  saving: "正在保存…",
  retry: "重试应用",
  saved: "已保存并生效",
  pending: "已保存，当前未生效",
  loadError: "无法读取桌面工具设置。",
  saveError: "无法保存桌面工具设置。",
  noRuntime: "仅可在 DSH Desktop 中使用。",
  runtimeStopped: "辅助进程已停止",
  runtimeRunning: "辅助进程运行中",
  runtimeDegraded: "部分功能需要处理",
  featureDisabled: "已停用",
  featureStarting: "正在启动",
  featureActive: "运行中",
  featureError: "发生错误",
  permissionGranted: "已授权",
  permissionDenied: "未授权",
  permissionUnknown: "未知"
}, Z = '/*! tailwindcss v4.3.5 | MIT License | https://tailwindcss.com */@layer properties;@layer theme{:root,:host{--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;--color-red-50: oklch(97.1% .013 17.38);--color-red-200: oklch(88.5% .062 18.334);--color-red-500: oklch(63.7% .237 25.331);--color-red-700: oklch(50.5% .213 27.518);--color-red-950: oklch(25.8% .092 26.042);--color-amber-50: oklch(98.7% .022 95.277);--color-amber-200: oklch(92.4% .12 95.746);--color-amber-800: oklch(47.3% .137 46.201);--color-amber-950: oklch(27.9% .077 45.635);--color-blue-400: oklch(70.7% .165 254.624);--color-blue-500: oklch(62.3% .214 259.815);--color-blue-600: oklch(54.6% .245 262.881);--color-slate-50: oklch(98.4% .003 247.858);--color-slate-100: oklch(96.8% .007 247.896);--color-slate-200: oklch(92.9% .013 255.508);--color-slate-300: oklch(86.9% .022 252.894);--color-slate-400: oklch(70.4% .04 256.788);--color-slate-500: oklch(55.4% .046 257.417);--color-slate-700: oklch(37.2% .044 257.287);--color-slate-800: oklch(27.9% .041 260.031);--color-slate-900: oklch(20.8% .042 265.755);--color-black: #000;--color-white: #fff;--spacing: .25rem;--text-xs: .75rem;--text-xs--line-height: calc(1 / .75);--text-sm: .875rem;--text-sm--line-height: calc(1.25 / .875);--text-base: 1rem;--text-base--line-height: 1.5 ;--text-lg: 1.125rem;--text-lg--line-height: calc(1.75 / 1.125);--text-xl: 1.25rem;--text-xl--line-height: calc(1.75 / 1.25);--font-weight-normal: 400;--font-weight-medium: 500;--font-weight-semibold: 600;--leading-snug: 1.375;--radius-md: .375rem;--radius-lg: .5rem;--radius-xl: .75rem;--radius-2xl: 1rem;--default-transition-duration: .15s;--default-transition-timing-function: cubic-bezier(.4, 0, .2, 1)}}@layer utilities{.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border-width:0}.absolute{position:absolute}.fixed{position:fixed}.relative{position:relative}.static{position:static}.inset-0{top:0;right:0;bottom:0;left:0}.top-6{top:calc(var(--spacing) * 6)}.left-1\\/2{left:50%}.isolate{isolation:isolate}.z-10{z-index:10}.m-0{margin:0}.mr-auto{margin-right:auto}.box-border{box-sizing:border-box}.block{display:block}.contents{display:contents}.flex{display:flex}.grid{display:grid}.hidden{display:none}.table{display:table}.size-12{width:calc(var(--spacing) * 12);height:calc(var(--spacing) * 12)}.h-2{height:calc(var(--spacing) * 2)}.h-8{height:calc(var(--spacing) * 8)}.h-9{height:calc(var(--spacing) * 9)}.h-full{height:100%}.max-h-20{max-height:calc(var(--spacing) * 20)}.min-h-10{min-height:calc(var(--spacing) * 10)}.w-2{width:calc(var(--spacing) * 2)}.w-8{width:calc(var(--spacing) * 8)}.w-full{width:100%}.max-w-\\[calc\\(100vw-24px\\)\\]{max-width:calc(100vw - 24px)}.max-w-full{max-width:100%}.min-w-0{min-width:0px}.min-w-52{min-width:calc(var(--spacing) * 52)}.-translate-x-1\\/2{--tw-translate-x: -50% ;translate:var(--tw-translate-x) var(--tw-translate-y)}.cursor-crosshair{cursor:crosshair}.cursor-pointer{cursor:pointer}.touch-none{touch-action:none}.resize{resize:both}.flex-col{flex-direction:column}.flex-wrap{flex-wrap:wrap}.items-center{align-items:center}.justify-between{justify-content:space-between}.justify-end{justify-content:flex-end}.gap-1{gap:var(--spacing)}.gap-1\\.5{gap:calc(var(--spacing) * 1.5)}.gap-2{gap:calc(var(--spacing) * 2)}.gap-3{gap:calc(var(--spacing) * 3)}.gap-4{gap:calc(var(--spacing) * 4)}.overflow-auto{overflow:auto}.rounded{border-radius:.25rem}.rounded-full{border-radius:calc(infinity * 1px)}.rounded-md{border-radius:var(--radius-md)}.border{border-style:var(--tw-border-style);border-width:1px}.border-0{border-style:var(--tw-border-style);border-width:0px}.border-t{border-top-style:var(--tw-border-style);border-top-width:1px}.border-b{border-bottom-style:var(--tw-border-style);border-bottom-width:1px}.border-b-2{border-bottom-style:var(--tw-border-style);border-bottom-width:2px}.border-solid{--tw-border-style: solid;border-style:solid}.border-\\[var\\(--border-subtle\\)\\]{border-color:var(--border-subtle)}.border-\\[var\\(--dsw-alias-border-l2\\)\\]{border-color:var(--dsw-alias-border-l2)}.border-red-500{border-color:var(--color-red-500)}.border-transparent{border-color:transparent}.bg-\\[var\\(--dsw-alias-bg-module-platform\\)\\]{background-color:var(--dsw-alias-bg-module-platform)}.bg-\\[var\\(--dsw-alias-brand-primary\\)\\]{background-color:var(--dsw-alias-brand-primary)}.bg-red-500{background-color:var(--color-red-500)}.bg-transparent{background-color:transparent}.bg-white{background-color:var(--color-white)}.object-cover{object-fit:cover}.p-0\\.5{padding:calc(var(--spacing) * .5)}.p-2{padding:calc(var(--spacing) * 2)}.px-2{padding-inline:calc(var(--spacing) * 2)}.px-3{padding-inline:calc(var(--spacing) * 3)}.px-5{padding-inline:calc(var(--spacing) * 5)}.py-1{padding-block:var(--spacing)}.py-2{padding-block:calc(var(--spacing) * 2)}.py-3{padding-block:calc(var(--spacing) * 3)}.pt-3{padding-top:calc(var(--spacing) * 3)}.text-center{text-align:center}.text-base{font-size:var(--text-base);line-height:var(--tw-leading, var(--text-base--line-height))}.text-sm{font-size:var(--text-sm);line-height:var(--tw-leading, var(--text-sm--line-height))}.text-xs{font-size:var(--text-xs);line-height:var(--tw-leading, var(--text-xs--line-height))}.leading-5{--tw-leading: calc(var(--spacing) * 5);line-height:calc(var(--spacing) * 5)}.font-medium{--tw-font-weight: var(--font-weight-medium);font-weight:var(--font-weight-medium)}.font-semibold{--tw-font-weight: var(--font-weight-semibold);font-weight:var(--font-weight-semibold)}.break-words{overflow-wrap:break-word}.whitespace-pre-wrap{white-space:pre-wrap}.text-\\[var\\(--dsw-alias-brand-primary\\)\\]{color:var(--dsw-alias-brand-primary)}.text-\\[var\\(--dsw-alias-label-primary\\)\\]{color:var(--dsw-alias-label-primary)}.text-\\[var\\(--dsw-alias-label-secondary\\)\\]{color:var(--dsw-alias-label-secondary)}.text-\\[var\\(--dsw-alias-label-tertiary\\)\\]{color:var(--dsw-alias-label-tertiary)}.text-\\[var\\(--dsw-alias-state-error-primary\\)\\]{color:var(--dsw-alias-state-error-primary)}.text-\\[var\\(--dsw-alias-state-success-primary\\)\\]{color:var(--dsw-alias-state-success-primary)}.text-black{color:var(--color-black)}.text-white{color:var(--color-white)}.tabular-nums{--tw-numeric-spacing: tabular-nums;font-variant-numeric:var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )}.blur{--tw-blur: blur(8px);filter:var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )}.filter{filter:var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )}.outline-none{--tw-outline-style: none;outline-style:none}.focus-within\\:ring-2:focus-within{--tw-ring-shadow: var(--tw-ring-inset, ) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.focus-within\\:ring-\\[var\\(--dsw-alias-brand-primary\\)\\]:focus-within{--tw-ring-color: var(--dsw-alias-brand-primary)}@media(hover:hover){.hover\\:text-\\[var\\(--dsw-alias-label-primary\\)\\]:hover{color:var(--dsw-alias-label-primary)}}.focus-visible\\:ring-2:focus-visible{--tw-ring-shadow: var(--tw-ring-inset, ) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.focus-visible\\:ring-\\[var\\(--dsw-alias-brand-primary\\)\\]:focus-visible{--tw-ring-color: var(--dsw-alias-brand-primary)}.focus-visible\\:outline:focus-visible{outline-style:var(--tw-outline-style);outline-width:1px}.focus-visible\\:outline-2:focus-visible{outline-style:var(--tw-outline-style);outline-width:2px}.focus-visible\\:outline-\\[var\\(--dsw-alias-brand-primary\\)\\]:focus-visible{outline-color:var(--dsw-alias-brand-primary)}.disabled\\:opacity-50:disabled{opacity:50%}.disabled\\:opacity-60:disabled{opacity:60%}.aria-selected\\:border-\\[var\\(--dsw-alias-brand-primary\\)\\][aria-selected=true]{border-color:var(--dsw-alias-brand-primary)}.aria-selected\\:text-\\[var\\(--dsw-alias-label-primary\\)\\][aria-selected=true]{color:var(--dsw-alias-label-primary)}@media(min-width:40rem){.sm\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}}}@property --tw-translate-x{syntax: "*"; inherits: false; initial-value: 0;}@property --tw-translate-y{syntax: "*"; inherits: false; initial-value: 0;}@property --tw-translate-z{syntax: "*"; inherits: false; initial-value: 0;}@property --tw-border-style{syntax: "*"; inherits: false; initial-value: solid;}@property --tw-leading{syntax: "*"; inherits: false;}@property --tw-font-weight{syntax: "*"; inherits: false;}@property --tw-ordinal{syntax: "*"; inherits: false;}@property --tw-slashed-zero{syntax: "*"; inherits: false;}@property --tw-numeric-figure{syntax: "*"; inherits: false;}@property --tw-numeric-spacing{syntax: "*"; inherits: false;}@property --tw-numeric-fraction{syntax: "*"; inherits: false;}@property --tw-blur{syntax: "*"; inherits: false;}@property --tw-brightness{syntax: "*"; inherits: false;}@property --tw-contrast{syntax: "*"; inherits: false;}@property --tw-grayscale{syntax: "*"; inherits: false;}@property --tw-hue-rotate{syntax: "*"; inherits: false;}@property --tw-invert{syntax: "*"; inherits: false;}@property --tw-opacity{syntax: "*"; inherits: false;}@property --tw-saturate{syntax: "*"; inherits: false;}@property --tw-sepia{syntax: "*"; inherits: false;}@property --tw-drop-shadow{syntax: "*"; inherits: false;}@property --tw-drop-shadow-color{syntax: "*"; inherits: false;}@property --tw-drop-shadow-alpha{syntax: "<percentage>"; inherits: false; initial-value: 100%;}@property --tw-drop-shadow-size{syntax: "*"; inherits: false;}@property --tw-shadow{syntax: "*"; inherits: false; initial-value: 0 0 #0000;}@property --tw-shadow-color{syntax: "*"; inherits: false;}@property --tw-shadow-alpha{syntax: "<percentage>"; inherits: false; initial-value: 100%;}@property --tw-inset-shadow{syntax: "*"; inherits: false; initial-value: 0 0 #0000;}@property --tw-inset-shadow-color{syntax: "*"; inherits: false;}@property --tw-inset-shadow-alpha{syntax: "<percentage>"; inherits: false; initial-value: 100%;}@property --tw-ring-color{syntax: "*"; inherits: false;}@property --tw-ring-shadow{syntax: "*"; inherits: false; initial-value: 0 0 #0000;}@property --tw-inset-ring-color{syntax: "*"; inherits: false;}@property --tw-inset-ring-shadow{syntax: "*"; inherits: false; initial-value: 0 0 #0000;}@property --tw-ring-inset{syntax: "*"; inherits: false;}@property --tw-ring-offset-width{syntax: "<length>"; inherits: false; initial-value: 0px;}@property --tw-ring-offset-color{syntax: "*"; inherits: false; initial-value: #fff;}@property --tw-ring-offset-shadow{syntax: "*"; inherits: false; initial-value: 0 0 #0000;}@property --tw-outline-style{syntax: "*"; inherits: false; initial-value: solid;}@layer properties{@supports ((-webkit-hyphens: none) and (not (margin-trim: block))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b)))){*,:before,:after,::backdrop{--tw-translate-x: 0;--tw-translate-y: 0;--tw-translate-z: 0;--tw-border-style: solid;--tw-leading: initial;--tw-font-weight: initial;--tw-ordinal: initial;--tw-slashed-zero: initial;--tw-numeric-figure: initial;--tw-numeric-spacing: initial;--tw-numeric-fraction: initial;--tw-blur: initial;--tw-brightness: initial;--tw-contrast: initial;--tw-grayscale: initial;--tw-hue-rotate: initial;--tw-invert: initial;--tw-opacity: initial;--tw-saturate: initial;--tw-sepia: initial;--tw-drop-shadow: initial;--tw-drop-shadow-color: initial;--tw-drop-shadow-alpha: 100%;--tw-drop-shadow-size: initial;--tw-shadow: 0 0 #0000;--tw-shadow-color: initial;--tw-shadow-alpha: 100%;--tw-inset-shadow: 0 0 #0000;--tw-inset-shadow-color: initial;--tw-inset-shadow-alpha: 100%;--tw-ring-color: initial;--tw-ring-shadow: 0 0 #0000;--tw-inset-ring-color: initial;--tw-inset-ring-shadow: 0 0 #0000;--tw-ring-inset: initial;--tw-ring-offset-width: 0px;--tw-ring-offset-color: #fff;--tw-ring-offset-shadow: 0 0 #0000;--tw-outline-style: solid}}}';
function L(e, s) {
  return { mode: "strict", typeSymbol: e, create: () => s };
}
function x(e, s) {
  const r = L(`dsh-desktop-tools#desktopTools:${e}`, s);
  return { name: e, source: "json", codec: r, strictCodec: r };
}
function b(e, s, r) {
  return {
    service: "desktopTools",
    invocation: { kind: "direct" },
    parameters: s,
    result: L(`dsh-desktop-tools#desktopTools:${e}:result`, r)
  };
}
const f = g.json(), ee = {
  package: "dsh-desktop-tools",
  methods: {
    "desktopTools/snapshot": b("snapshot", [], f),
    "desktopTools/update": b("update", [x("config", f)], f),
    "desktopTools/restart": b("restart", [], f),
    "desktopTools/openCapture": b("openCapture", [x("mode", g.enum(["image", "video"]))], g.object({ opened: g.literal(!0) })),
    "desktopTools/avatar": b("avatar", [], g.object({ dataUrl: g.string().optional() })),
    "desktopTools/setAvatar": b("setAvatar", [x("dataUrl", g.string()), x("fileName", g.string())], f),
    "desktopTools/restoreAvatar": b("restoreAvatar", [], f),
    "desktopTools/systemPermissions": b("systemPermissions", [], f),
    "desktopTools/openSystemPermission": b("openSystemPermission", [x("right", g.enum(["screen", "accessibility"]))], f)
  }
}, te = q(ee, g), oe = ["slots", "locale", "shortcuts", "remote", "remote.desktopTools"];
async function ie(e) {
  const s = await e.remote.$mount(te), r = document.createElement("style");
  r.dataset.dshDesktopTools = "", r.textContent = Z, document.head.append(r);
  const p = "desktopTools";
  e.effect(() => e.locale.register(p, { en: X, zh: Y }), "desktop-tools: dictionaries");
  const n = e.locale.bind(p), v = (o) => ({
    "desktop:macos": { code: o, modifiers: ["primary", "shift"] },
    "desktop:windows": { code: o, modifiers: ["primary", "shift"] },
    "desktop:linux": { code: o, modifiers: ["primary", "shift"] },
    "web:macos": { code: o, modifiers: ["primary", "shift"] },
    "web:windows": { code: o, modifiers: ["primary", "shift"] },
    "web:linux": { code: o, modifiers: ["primary", "shift"] }
  }), a = e.shortcuts.register({
    id: "desktop-tools.screenshot",
    label: () => n("screenshot"),
    aliases: [],
    defaults: v("KeyS"),
    regions: ["page", "editable", "terminal"],
    modals: ["settings"],
    resolve: () => ({ status: "handled", run: () => {
      e.remote.desktopTools.openCapture("image");
    } })
  }), l = e.shortcuts.register({
    id: "desktop-tools.recording",
    label: () => n("recording"),
    aliases: [],
    defaults: v("KeyR"),
    regions: ["page", "editable", "terminal"],
    modals: ["settings"],
    resolve: () => ({ status: "handled", run: () => {
      e.remote.desktopTools.openCapture("video");
    } })
  }), k = {
    snapshot: () => e.remote.desktopTools.snapshot(),
    update: (o) => e.remote.desktopTools.update(o),
    restart: () => e.remote.desktopTools.restart(),
    avatar: () => e.remote.desktopTools.avatar(),
    setAvatar: (o, d) => e.remote.desktopTools.setAvatar(o, d),
    restoreAvatar: () => e.remote.desktopTools.restoreAvatar(),
    systemPermissions: () => e.remote.desktopTools.systemPermissions(),
    openSystemPermission: (o) => e.remote.desktopTools.openSystemPermission(o),
    async editShortcut(o, d) {
      return (await e.shortcuts.edit({ type: "set", id: o, binding: d }, e.shortcuts.config.getSnapshot().revision)).status === "saved" ? void 0 : n("saveError");
    },
    shortcutLabel(o) {
      var d;
      return ((d = e.shortcuts.catalog.getSnapshot().find((N) => N.id === o)) == null ? void 0 : d.keys.join(" + ")) ?? "—";
    }
  }, E = e.slots.inject("settings.section", () => e.slots.register({
    name: "settings.section",
    id: "desktop-tools",
    order: 40,
    label: () => n("title"),
    locale: p,
    inject: () => ({ services: k })
  }, W));
  let w = !1;
  const R = async () => {
    w || (w = !0, E(), a(), l(), r.remove(), await s());
  };
  return e.effect(() => R, "desktop-tools: Client resources"), R;
}
export {
  ie as apply,
  oe as inject
};
