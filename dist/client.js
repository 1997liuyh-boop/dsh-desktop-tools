import { useState as m, useEffect as j } from "react";
import { z as w } from "zod";
import { createTypertRemoteInfo as W } from "@deepseek-ai/dsh-typert-protocol/remote-info";
const Y = {
  Space: "Space",
  Enter: "Return",
  Tab: "Tab",
  Backspace: "Backspace",
  Delete: "Delete",
  Insert: "Insert",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  PrintScreen: "PrintScreen",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backquote: "`",
  Backslash: "\\"
};
function Z(e) {
  const i = e.code, o = /^Key[A-Z]$/u.test(i) ? i.slice(3) : /^Digit\d$/u.test(i) ? i.slice(5) : /^F([1-9]|1\d|2[0-4])$/u.test(i) ? i : Y[i];
  if (o === void 0) return;
  const l = [];
  if ((e.ctrlKey || e.metaKey) && l.push("CommandOrControl"), e.altKey && l.push("Alt"), e.shiftKey && l.push("Shift"), !(l.length === 0 && o !== "PrintScreen"))
    return [...l, o].join("+");
}
function J(e, i) {
  if (e === "") return "—";
  const o = i === "darwin";
  return e.split("+").map((l) => l === "CommandOrControl" ? o ? "⌘" : "Ctrl" : o && l === "Alt" ? "⌥" : o && l === "Shift" ? "⇧" : l).join(" + ");
}
const X = ["selection", "floating", "screenshot", "recording"];
function ee(e, i) {
  return i(e === "active" ? "featureActive" : e === "starting" ? "featureStarting" : e === "error" ? "featureError" : "featureDisabled");
}
function te(e) {
  const i = {
    selection: e.config.selection.enabled,
    floatingBall: e.config.floatingBall.enabled,
    capture: e.config.screenshot.enabled || e.config.recording.enabled
  };
  return Object.keys(i).every((o) => {
    const l = e.features[o].phase;
    return i[o] ? l === "active" : l === "disabled";
  });
}
function M({ value: e, disabled: i, t: o, onChange: l }) {
  return /* @__PURE__ */ React.createElement("div", { className: "grid min-w-0 gap-3 sm:grid-cols-3" }, ["provider", "model", "reasoningEffort"].map((r) => /* @__PURE__ */ React.createElement("label", { className: "grid min-w-0 gap-1 text-sm", key: r }, /* @__PURE__ */ React.createElement("span", { className: "text-[var(--dsw-alias-label-tertiary)]" }, o(r === "reasoningEffort" ? "effort" : r)), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "min-w-0 rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2 text-[var(--dsw-alias-label-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--dsw-alias-brand-primary)] disabled:opacity-60",
      disabled: i,
      value: e[r] ?? "",
      onChange: (g) => l({ ...e, [r]: g.currentTarget.value })
    }
  ))));
}
function ae({ t: e, services: i }) {
  const [o, l] = m("selection"), [r, g] = m(), [a, n] = m(), [y, d] = m(), [h, F] = m(), [p, E] = m(!1), [U, A] = m(!1), [x, c] = m(""), [k, S] = m(), [N, D] = m(!1), C = async () => {
    const t = await i.snapshot();
    if (!t.ok) {
      c(e("loadError"));
      return;
    }
    g(t.value), n(t.value.config), c("");
    const s = await i.avatar();
    s.ok && d(s.value.dataUrl);
  };
  j(() => {
    C();
  }, []);
  const q = async () => {
    if (a === void 0 || p) return;
    E(!0), c("");
    const t = await i.update(a);
    if (E(!1), !t.ok) {
      c(e("saveError"));
      return;
    }
    g(t.value.snapshot), n(t.value.snapshot.config), A(!t.value.applied), c(t.value.applied ? e("saved") : e("pending"));
  }, G = async () => {
    if (p) return;
    E(!0);
    const t = await i.restart();
    if (E(!1), !t.ok) {
      c(e("pending"));
      return;
    }
    g(t.value);
    const s = te(t.value);
    A(!s), c(e(s ? "saved" : "pending"));
  }, O = (t, s) => {
    a !== void 0 && n(t === "selection" ? { ...a, selection: { ...a.selection, enabled: s } } : t === "floating" ? { ...a, floatingBall: { ...a.floatingBall, enabled: s } } : t === "screenshot" ? { ...a, screenshot: { ...a.screenshot, enabled: s } } : { ...a, recording: { ...a.recording, enabled: s } });
  }, f = r == null ? void 0 : r.features[o === "floating" ? "floatingBall" : o === "selection" ? "selection" : "capture"], L = a === void 0 ? !1 : o === "selection" ? a.selection.enabled : o === "floating" ? a.floatingBall.enabled : o === "screenshot" ? a.screenshot.enabled : a.recording.enabled, P = (t, s) => {
    a !== void 0 && n(t === "screenshot.shortcut" ? { ...a, screenshot: { ...a.screenshot, shortcut: s } } : t === "screenshot.longShortcut" ? { ...a, screenshot: { ...a.screenshot, longShortcut: s } } : { ...a, recording: { ...a.recording, shortcut: s } });
  }, z = (t) => a === void 0 ? "" : t === "screenshot.shortcut" ? a.screenshot.shortcut : t === "screenshot.longShortcut" ? a.screenshot.longShortcut : a.recording.shortcut, $ = (t) => {
    if (t.key === "Escape") {
      t.preventDefault(), S(void 0);
      return;
    }
    if (/^(Control|Alt|Shift|Meta)$/u.test(t.key)) return;
    t.preventDefault();
    const s = Z(t);
    if (s === void 0 || k === void 0) {
      c(e("shortcutInvalid"));
      return;
    }
    P(k, s), c(""), S(void 0);
  }, K = async () => {
    if (N) return;
    D(!0), c(e("visionInstalling"));
    const t = await i.installVision();
    if (D(!1), !t.ok) {
      c(e("visionInstallFailed"));
      return;
    }
    g(t.value.snapshot), c(t.value.restartRequired ? e("visionRestart") : e("visionReady"));
  };
  j(() => {
    if (k === void 0) return;
    const t = (s) => {
      $(s);
    };
    return document.addEventListener("keydown", t, !0), () => document.removeEventListener("keydown", t, !0);
  }, [k]);
  const V = (t) => {
    var I;
    const s = (I = t.currentTarget.files) == null ? void 0 : I[0];
    if (t.currentTarget.value = "", s === void 0 || !s.type.match(/^image\/(gif|png|webp)$/u)) return;
    const b = new FileReader();
    b.onload = () => {
      typeof b.result == "string" && i.setAvatar(b.result, s.name).then((_) => {
        _.ok && typeof b.result == "string" ? d(b.result) : c(e("saveError"));
      });
    }, b.readAsDataURL(s);
  }, B = async () => {
    const t = await i.systemPermissions();
    t.ok ? F(t.value) : c(e("pending"));
  }, T = (t, s) => {
    a !== void 0 && n(t === "selection" ? { ...a, selection: { ...a.selection, model: s } } : t === "conversationModel" ? { ...a, floatingBall: { ...a.floatingBall, conversationModel: s } } : { ...a, floatingBall: { ...a.floatingBall, backgroundModel: s } });
  }, Q = (t) => {
    if (a !== void 0)
      if (t) n({ ...a, selection: { ...a.selection, model: { provider: "deepseek-official", model: "deepseek-flash", reasoningEffort: "max" } } });
      else {
        const { model: s, ...b } = a.selection;
        n({ ...a, selection: b });
      }
  };
  return a === void 0 ? /* @__PURE__ */ React.createElement("section", { className: "grid gap-4", "aria-busy": "true" }, /* @__PURE__ */ React.createElement("h2", { className: "text-base font-semibold text-[var(--dsw-alias-label-primary)]" }, e("title")), x ? /* @__PURE__ */ React.createElement("p", { role: "alert", className: "text-sm text-[var(--dsw-alias-state-error-primary)]" }, x) : /* @__PURE__ */ React.createElement("p", { role: "status", className: "text-sm text-[var(--dsw-alias-label-tertiary)]" }, "…")) : /* @__PURE__ */ React.createElement("section", { className: "grid min-w-0 gap-4 text-[var(--dsw-alias-label-primary)]", "aria-busy": p }, /* @__PURE__ */ React.createElement("header", { className: "flex min-w-0 flex-wrap items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("h2", { className: "text-base font-semibold" }, e("title")), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-[var(--dsw-alias-label-tertiary)]" }, (r == null ? void 0 : r.runtime) === "running" ? e("runtimeRunning") : (r == null ? void 0 : r.runtime) === "degraded" ? e("runtimeDegraded") : e("runtimeStopped"))), /* @__PURE__ */ React.createElement("nav", { className: "flex flex-wrap gap-1 border-b border-[var(--border-subtle)]", "aria-label": e("title") }, X.map((t) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: t,
      type: "button",
      role: "tab",
      "aria-selected": o === t,
      onClick: () => l(t),
      className: "max-w-full border-b-2 border-transparent px-3 py-2 text-sm text-[var(--dsw-alias-label-tertiary)] hover:text-[var(--dsw-alias-label-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--dsw-alias-brand-primary)] aria-selected:border-[var(--dsw-alias-brand-primary)] aria-selected:text-[var(--dsw-alias-label-primary)]"
    },
    e(t)
  ))), /* @__PURE__ */ React.createElement("div", { className: "grid min-w-0 gap-4", role: "tabpanel" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("label", { className: "flex min-h-10 items-center gap-2 text-sm" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: L, onChange: (t) => O(o, t.currentTarget.checked) }), e("enabled")), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-[var(--dsw-alias-label-tertiary)]" }, ee((f == null ? void 0 : f.phase) ?? "disabled", e))), o === "selection" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("label", { className: "grid gap-1 text-sm" }, /* @__PURE__ */ React.createElement("span", null, e("language")), /* @__PURE__ */ React.createElement("input", { className: "min-w-0 rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2", value: a.selection.targetLanguage, onChange: (t) => n({ ...a, selection: { ...a.selection, targetLanguage: t.currentTarget.value } }) })), /* @__PURE__ */ React.createElement("label", { className: "flex min-h-10 items-center gap-2 text-sm" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: a.selection.compatibilityCopy, onChange: (t) => n({ ...a, selection: { ...a.selection, compatibilityCopy: t.currentTarget.checked } }) }), e("compatibilityCopy")), /* @__PURE__ */ React.createElement("label", { className: "flex min-h-10 items-center gap-2 text-sm" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: a.selection.model !== void 0, onChange: (t) => Q(t.currentTarget.checked) }), e("customModel")), a.selection.model === void 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-sm text-[var(--dsw-alias-label-tertiary)]" }, e("followSession")) : /* @__PURE__ */ React.createElement(M, { value: a.selection.model, disabled: p, t: e, onChange: (t) => T("selection", t) })), o === "floating" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-3" }, y === void 0 ? /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true", className: "size-12 rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)]" }) : /* @__PURE__ */ React.createElement("img", { src: y, alt: "", className: "size-12 rounded border border-[var(--dsw-alias-border-l2)] object-cover" }), /* @__PURE__ */ React.createElement("label", { className: "cursor-pointer rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-[var(--dsw-alias-brand-primary)]" }, e("chooseAvatar"), /* @__PURE__ */ React.createElement("input", { className: "sr-only", type: "file", accept: "image/gif,image/png,image/webp", onChange: V })), /* @__PURE__ */ React.createElement("button", { type: "button", className: "rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm", onClick: () => {
    i.restoreAvatar().then((t) => {
      t.ok && C();
    });
  } }, e("restoreAvatar"))), /* @__PURE__ */ React.createElement("h3", { className: "text-sm font-medium" }, e("conversationModel")), /* @__PURE__ */ React.createElement(M, { value: a.floatingBall.conversationModel, disabled: p, t: e, onChange: (t) => T("conversationModel", t) }), /* @__PURE__ */ React.createElement("h3", { className: "text-sm font-medium" }, e("backgroundModel")), /* @__PURE__ */ React.createElement(M, { value: a.floatingBall.backgroundModel, disabled: p, t: e, onChange: (t) => T("backgroundModel", t) }), /* @__PURE__ */ React.createElement("label", { className: "grid gap-1 text-sm" }, /* @__PURE__ */ React.createElement("span", null, e("permissionPreset")), /* @__PURE__ */ React.createElement("select", { className: "rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2", value: a.floatingBall.permissionPreset, onChange: (t) => n({ ...a, floatingBall: { ...a.floatingBall, permissionPreset: t.currentTarget.value } }) }, /* @__PURE__ */ React.createElement("option", { value: "read-only" }, "read-only"), /* @__PURE__ */ React.createElement("option", { value: "workspace-write" }, "workspace-write"), /* @__PURE__ */ React.createElement("option", { value: "danger-full-access" }, "danger-full-access"))), /* @__PURE__ */ React.createElement("label", { className: "grid gap-1 text-sm" }, /* @__PURE__ */ React.createElement("span", null, e("coordinateMode")), /* @__PURE__ */ React.createElement("select", { className: "rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2", value: a.floatingBall.coordinateMode, onChange: (t) => n({ ...a, floatingBall: { ...a.floatingBall, coordinateMode: t.currentTarget.value } }) }, /* @__PURE__ */ React.createElement("option", { value: "millifraction" }, "millifraction"), /* @__PURE__ */ React.createElement("option", { value: "pixel" }, "pixel"))), /* @__PURE__ */ React.createElement("div", { className: "grid gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-2" }, /* @__PURE__ */ React.createElement("h3", { className: "text-sm font-medium" }, e("systemPermissions")), /* @__PURE__ */ React.createElement("button", { type: "button", className: "text-sm text-[var(--dsw-alias-brand-primary)]", onClick: () => {
    B();
  } }, e("check"))), ["screen", "accessibility"].map((t) => /* @__PURE__ */ React.createElement("div", { key: t, className: "flex flex-wrap items-center justify-between gap-2 text-sm" }, /* @__PURE__ */ React.createElement("span", null, e(t === "screen" ? "screenPermission" : "accessibilityPermission")), /* @__PURE__ */ React.createElement("span", null, (h == null ? void 0 : h[t]) === !0 ? e("permissionGranted") : (h == null ? void 0 : h[t]) === !1 ? e("permissionDenied") : e("permissionUnknown")), /* @__PURE__ */ React.createElement("button", { type: "button", className: "text-[var(--dsw-alias-brand-primary)]", onClick: () => {
    i.openSystemPermission(t).then(() => {
      B();
    });
  } }, e("openSettings")))))), (o === "screenshot" || o === "recording") && /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, (o === "screenshot" ? ["screenshot.shortcut", "screenshot.longShortcut"] : ["recording.shortcut"]).map((t) => /* @__PURE__ */ React.createElement("div", { key: t, className: "grid gap-1" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm text-[var(--dsw-alias-label-tertiary)]" }, e(t === "screenshot.longShortcut" ? "longShortcut" : "shortcut")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2" }, /* @__PURE__ */ React.createElement("kbd", { className: "rounded border border-[var(--dsw-alias-border-l2)] px-2 py-1 text-sm" }, J(z(t), r == null ? void 0 : r.platform)), /* @__PURE__ */ React.createElement("button", { type: "button", className: "rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--dsw-alias-brand-primary)]", onClick: () => S(t) }, e(k === t ? "recordingShortcut" : "recordShortcut")), z(t) !== "" && /* @__PURE__ */ React.createElement("button", { type: "button", className: "px-2 py-2 text-sm text-[var(--dsw-alias-label-tertiary)] hover:text-[var(--dsw-alias-label-primary)]", onClick: () => P(t, "") }, e("clearShortcut")), /* @__PURE__ */ React.createElement("button", { type: "button", className: "px-2 py-2 text-sm text-[var(--dsw-alias-brand-primary)] disabled:opacity-50", disabled: (f == null ? void 0 : f.phase) !== "active", onClick: () => {
    i.openCapture(t === "recording.shortcut" ? "video" : t === "screenshot.longShortcut" ? "long" : "image");
  } }, e("tryNow"))))), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-[var(--dsw-alias-label-tertiary)]" }, e("globalShortcutHint"))), o === "screenshot" && /* @__PURE__ */ React.createElement("div", { className: "grid gap-2 rounded border border-[var(--dsw-alias-border-l2)] p-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-2" }, /* @__PURE__ */ React.createElement("h3", { className: "text-sm font-medium" }, e("visionTitle")), /* @__PURE__ */ React.createElement("span", { className: (r == null ? void 0 : r.vision.state) === "ready" ? "text-xs text-[var(--dsw-alias-state-success-primary)]" : "text-xs text-[var(--dsw-alias-label-tertiary)]" }, e((r == null ? void 0 : r.vision.state) === "ready" ? "visionStateReady" : (r == null ? void 0 : r.vision.state) === "missing" ? "visionStateMissing" : (r == null ? void 0 : r.vision.state) === "disabled" ? "visionStateDisabled" : (r == null ? void 0 : r.vision.state) === "tool-off" ? "visionStateToolOff" : "visionStateUnknown"))), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-[var(--dsw-alias-label-tertiary)]" }, e("visionDescription")), (r == null ? void 0 : r.vision.state) !== "ready" && (r == null ? void 0 : r.vision.state) !== "tool-off" && /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2" }, /* @__PURE__ */ React.createElement("button", { type: "button", disabled: N, className: "rounded bg-[var(--dsw-alias-brand-primary)] px-3 py-2 text-sm text-white disabled:opacity-50", onClick: () => {
    K();
  } }, N ? e("visionInstalling") : (r == null ? void 0 : r.vision.state) === "disabled" ? e("visionEnable") : e("visionInstall")), /* @__PURE__ */ React.createElement("code", { className: "text-xs text-[var(--dsw-alias-label-tertiary)]" }, "dsh plugin add dsh-vision-router"))), o === "recording" && /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-3 sm:grid-cols-2" }, /* @__PURE__ */ React.createElement("label", { className: "grid gap-1 text-sm" }, /* @__PURE__ */ React.createElement("span", null, e("recordingFormat")), /* @__PURE__ */ React.createElement("select", { className: "rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2", value: a.recording.format, onChange: (t) => n({ ...a, recording: { ...a.recording, format: t.currentTarget.value } }) }, /* @__PURE__ */ React.createElement("option", { value: "mp4" }, "MP4"), /* @__PURE__ */ React.createElement("option", { value: "gif" }, "GIF"), /* @__PURE__ */ React.createElement("option", { value: "webm" }, "WebM"))), /* @__PURE__ */ React.createElement("label", { className: "grid gap-1 text-sm" }, /* @__PURE__ */ React.createElement("span", null, e("recordingQuality")), /* @__PURE__ */ React.createElement("select", { className: "rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2", value: a.recording.quality, onChange: (t) => n({ ...a, recording: { ...a.recording, quality: t.currentTarget.value } }) }, /* @__PURE__ */ React.createElement("option", { value: "sd" }, e("qualitySd")), /* @__PURE__ */ React.createElement("option", { value: "hd" }, e("qualityHd")), /* @__PURE__ */ React.createElement("option", { value: "original" }, e("qualityOriginal"))))), ["systemAudio", "microphone", "knowledgeGraph"].map((t) => /* @__PURE__ */ React.createElement("label", { key: t, className: "flex min-h-10 items-center gap-2 text-sm" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: a.recording[t], disabled: t === "systemAudio" && (r == null ? void 0 : r.platform) === "linux", onChange: (s) => n({ ...a, recording: { ...a.recording, [t]: s.currentTarget.checked } }) }), e(t === "systemAudio" ? "recordingSystemAudio" : t === "microphone" ? "recordingMicrophone" : "recordingGraph"))), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-[var(--dsw-alias-label-tertiary)]" }, e("recordingGraphHint")))), x && /* @__PURE__ */ React.createElement("p", { role: "status", className: x === e("saved") ? "text-sm text-[var(--dsw-alias-state-success-primary)]" : "text-sm text-[var(--dsw-alias-state-error-primary)]" }, x), /* @__PURE__ */ React.createElement("footer", { className: "flex flex-wrap justify-end gap-2 border-t border-[var(--dsw-alias-border-l2)] pt-3" }, /* @__PURE__ */ React.createElement("button", { type: "button", disabled: p, className: "rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm disabled:opacity-50", onClick: () => {
    C();
  } }, e("check")), U && /* @__PURE__ */ React.createElement("button", { type: "button", disabled: p, className: "rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm disabled:opacity-50", onClick: () => {
    G();
  } }, e("retry")), /* @__PURE__ */ React.createElement("button", { type: "button", disabled: p, className: "rounded bg-[var(--dsw-alias-brand-primary)] px-3 py-2 text-sm text-white disabled:opacity-50", onClick: () => {
    q();
  } }, e(p ? "saving" : "save"))));
}
const re = {
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
  permissionUnknown: "Unknown",
  longShortcut: "Long screenshot shortcut",
  clearShortcut: "Clear",
  tryNow: "Try now",
  shortcutInvalid: "Use at least one modifier key (Ctrl/⌘, Alt or Shift) with a letter, number or function key.",
  globalShortcutHint: "Shortcuts work system-wide, even when DSH is in the background. Save to apply.",
  visionTitle: "Prerequisite: dsh-vision-router",
  visionDescription: "Extract text, Translate and Knowledge graph on screenshots use the OCR tools of the dsh-vision-router plugin. Other tools work without it.",
  visionInstall: "Install dsh-vision-router",
  visionEnable: "Enable dsh-vision-router",
  visionInstalling: "Installing dsh-vision-router…",
  visionInstallFailed: "Could not install dsh-vision-router. Check the plugin manager.",
  visionRestart: "dsh-vision-router is installed. Restart DSH to finish enabling it.",
  visionReady: "dsh-vision-router is ready.",
  visionStateReady: "Ready",
  visionStateMissing: "Not installed",
  visionStateDisabled: "Installed, disabled",
  visionStateToolOff: "Installed, vision tools off",
  visionStateUnknown: "Unknown",
  recordingFormat: "Default format",
  recordingQuality: "Default quality",
  qualitySd: "SD 720p",
  qualityHd: "HD 1080p",
  qualityOriginal: "Original",
  recordingSystemAudio: "Record system sound by default",
  recordingMicrophone: "Record microphone by default",
  recordingGraph: "Generate a knowledge graph after recording by default",
  recordingGraphHint: "The knowledge graph recognizes text in key frames with dsh-vision-router; speech is not transcribed. GIF recordings have no sound."
}, ie = {
  title: "桌面工具",
  selection: "划词工具栏",
  floating: "悬浮球",
  screenshot: "截图",
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
  permissionUnknown: "未知",
  longShortcut: "长截图快捷键",
  clearShortcut: "清除",
  tryNow: "立即试用",
  shortcutInvalid: "请至少使用一个修饰键（Ctrl/⌘、Alt 或 Shift）加字母、数字或功能键。",
  globalShortcutHint: "快捷键为系统级，DSH 在后台时同样可以唤起。保存后生效。",
  visionTitle: "前置插件：dsh-vision-router",
  visionDescription: "截图的「提取文字」「翻译」「知识图谱」使用 dsh-vision-router 插件的 OCR 工具，其他功能不依赖它。",
  visionInstall: "一键安装 dsh-vision-router",
  visionEnable: "启用 dsh-vision-router",
  visionInstalling: "正在安装 dsh-vision-router…",
  visionInstallFailed: "安装 dsh-vision-router 失败，请在插件管理中查看原因。",
  visionRestart: "dsh-vision-router 已安装，重启 DSH 后生效。",
  visionReady: "dsh-vision-router 已就绪。",
  visionStateReady: "已就绪",
  visionStateMissing: "未安装",
  visionStateDisabled: "已安装，未启用",
  visionStateToolOff: "已安装，视觉工具已关闭",
  visionStateUnknown: "未知",
  recordingFormat: "默认格式",
  recordingQuality: "默认清晰度",
  qualitySd: "标清 720p",
  qualityHd: "高清 1080p",
  qualityOriginal: "原画",
  recordingSystemAudio: "默认录制系统声音",
  recordingMicrophone: "默认录制麦克风",
  recordingGraph: "默认在录制结束后生成知识图谱",
  recordingGraphHint: "知识图谱通过 dsh-vision-router 识别关键帧中的文字生成，不转写语音。GIF 不含声音。"
}, oe = '/*! tailwindcss v4.3.5 | MIT License | https://tailwindcss.com */@layer properties;@layer theme{:root,:host{--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;--color-red-50: oklch(97.1% .013 17.38);--color-red-200: oklch(88.5% .062 18.334);--color-red-700: oklch(50.5% .213 27.518);--color-red-950: oklch(25.8% .092 26.042);--color-amber-50: oklch(98.7% .022 95.277);--color-amber-200: oklch(92.4% .12 95.746);--color-amber-800: oklch(47.3% .137 46.201);--color-amber-950: oklch(27.9% .077 45.635);--color-blue-400: oklch(70.7% .165 254.624);--color-blue-500: oklch(62.3% .214 259.815);--color-blue-600: oklch(54.6% .245 262.881);--color-slate-50: oklch(98.4% .003 247.858);--color-slate-100: oklch(96.8% .007 247.896);--color-slate-200: oklch(92.9% .013 255.508);--color-slate-300: oklch(86.9% .022 252.894);--color-slate-400: oklch(70.4% .04 256.788);--color-slate-500: oklch(55.4% .046 257.417);--color-slate-700: oklch(37.2% .044 257.287);--color-slate-800: oklch(27.9% .041 260.031);--color-slate-900: oklch(20.8% .042 265.755);--color-white: #fff;--spacing: .25rem;--text-xs: .75rem;--text-xs--line-height: calc(1 / .75);--text-sm: .875rem;--text-sm--line-height: calc(1.25 / .875);--text-base: 1rem;--text-base--line-height: 1.5 ;--text-lg: 1.125rem;--text-lg--line-height: calc(1.75 / 1.125);--text-xl: 1.25rem;--text-xl--line-height: calc(1.75 / 1.25);--font-weight-normal: 400;--font-weight-medium: 500;--font-weight-semibold: 600;--leading-snug: 1.375;--radius-lg: .5rem;--radius-xl: .75rem;--radius-2xl: 1rem;--ease-in: cubic-bezier(.4, 0, 1, 1);--ease-out: cubic-bezier(0, 0, .2, 1);--ease-in-out: cubic-bezier(.4, 0, .2, 1);--default-transition-duration: .15s;--default-transition-timing-function: cubic-bezier(.4, 0, .2, 1)}}@layer utilities{.\\@container{container-type:inline-size}.collapse{visibility:collapse}.invisible{visibility:hidden}.visible{visibility:visible}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border-width:0}.absolute{position:absolute}.fixed{position:fixed}.relative{position:relative}.static{position:static}.sticky{position:sticky}.container{width:100%}@media(min-width:40rem){.container{max-width:40rem}}@media(min-width:48rem){.container{max-width:48rem}}@media(min-width:64rem){.container{max-width:64rem}}@media(min-width:80rem){.container{max-width:80rem}}@media(min-width:96rem){.container{max-width:96rem}}.block{display:block}.contents{display:contents}.flex{display:flex}.grid{display:grid}.hidden{display:none}.inline{display:inline}.inline-block{display:inline-block}.table{display:table}.table-cell{display:table-cell}.size-1{width:var(--spacing);height:var(--spacing)}.size-12{width:calc(var(--spacing) * 12);height:calc(var(--spacing) * 12)}.h-40{height:calc(var(--spacing) * 40)}.h-84{height:calc(var(--spacing) * 84)}.h-120{height:calc(var(--spacing) * 120)}.min-h-10{min-height:calc(var(--spacing) * 10)}.max-w-full{max-width:100%}.min-w-0{min-width:0px}.grow{flex-grow:1}.transform{transform:var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )}.transform\\!{transform:var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )!important}.cursor-pointer{cursor:pointer}.resize{resize:both}.flex-wrap{flex-wrap:wrap}.items-center{align-items:center}.justify-between{justify-content:space-between}.justify-end{justify-content:flex-end}.gap-1{gap:var(--spacing)}.gap-2{gap:calc(var(--spacing) * 2)}.gap-3{gap:calc(var(--spacing) * 3)}.gap-4{gap:calc(var(--spacing) * 4)}.rounded{border-radius:.25rem}.border{border-style:var(--tw-border-style);border-width:1px}.border-t{border-top-style:var(--tw-border-style);border-top-width:1px}.border-b{border-bottom-style:var(--tw-border-style);border-bottom-width:1px}.border-b-2{border-bottom-style:var(--tw-border-style);border-bottom-width:2px}.border-\\[var\\(--border-subtle\\)\\]{border-color:var(--border-subtle)}.border-\\[var\\(--dsw-alias-border-l2\\)\\]{border-color:var(--dsw-alias-border-l2)}.border-transparent{border-color:transparent}.bg-\\[var\\(--dsw-alias-bg-module-platform\\)\\]{background-color:var(--dsw-alias-bg-module-platform)}.bg-\\[var\\(--dsw-alias-brand-primary\\)\\]{background-color:var(--dsw-alias-brand-primary)}.object-cover{object-fit:cover}.p-3{padding:calc(var(--spacing) * 3)}.px-2{padding-inline:calc(var(--spacing) * 2)}.px-3{padding-inline:calc(var(--spacing) * 3)}.py-1{padding-block:var(--spacing)}.py-2{padding-block:calc(var(--spacing) * 2)}.pt-3{padding-top:calc(var(--spacing) * 3)}.text-base{font-size:var(--text-base);line-height:var(--tw-leading, var(--text-base--line-height))}.text-sm{font-size:var(--text-sm);line-height:var(--tw-leading, var(--text-sm--line-height))}.text-xs{font-size:var(--text-xs);line-height:var(--tw-leading, var(--text-xs--line-height))}.font-medium{--tw-font-weight: var(--font-weight-medium);font-weight:var(--font-weight-medium)}.font-semibold{--tw-font-weight: var(--font-weight-semibold);font-weight:var(--font-weight-semibold)}.text-wrap{text-wrap:wrap}.text-\\[var\\(--dsw-alias-brand-primary\\)\\]{color:var(--dsw-alias-brand-primary)}.text-\\[var\\(--dsw-alias-label-primary\\)\\]{color:var(--dsw-alias-label-primary)}.text-\\[var\\(--dsw-alias-label-tertiary\\)\\]{color:var(--dsw-alias-label-tertiary)}.text-\\[var\\(--dsw-alias-state-error-primary\\)\\]{color:var(--dsw-alias-state-error-primary)}.text-\\[var\\(--dsw-alias-state-success-primary\\)\\]{color:var(--dsw-alias-state-success-primary)}.text-white{color:var(--color-white)}.capitalize{text-transform:capitalize}.lowercase{text-transform:lowercase}.uppercase{text-transform:uppercase}.italic{font-style:italic}.italic\\!{font-style:italic!important}.ordinal{--tw-ordinal: ordinal;font-variant-numeric:var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )}.line-through{text-decoration-line:line-through}.overline{text-decoration-line:overline}.underline{text-decoration-line:underline}.shadow{--tw-shadow: 0 1px 3px 0 var(--tw-shadow-color, rgb(0 0 0 / .1)), 0 1px 2px -1px var(--tw-shadow-color, rgb(0 0 0 / .1));box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.blur{--tw-blur: blur(8px);filter:var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )}.blur\\!{--tw-blur: blur(8px) !important;filter:var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )!important}.drop-shadow{--tw-drop-shadow-size: drop-shadow(0 1px 2px var(--tw-drop-shadow-color, rgb(0 0 0 / .1))) drop-shadow(0 1px 1px var(--tw-drop-shadow-color, rgb(0 0 0 / .06)));--tw-drop-shadow: drop-shadow(0 1px 2px rgb(0 0 0 / .1)) drop-shadow( 0 1px 1px rgb(0 0 0 / .06));filter:var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )}.invert{--tw-invert: invert(100%);filter:var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )}.filter{filter:var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )}.transition{transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,--tw-gradient-from,--tw-gradient-via,--tw-gradient-to,opacity,box-shadow,transform,translate,scale,rotate,filter,-webkit-backdrop-filter,backdrop-filter,display,content-visibility,overlay,pointer-events;transition-timing-function:var(--tw-ease, var(--default-transition-timing-function));transition-duration:var(--tw-duration, var(--default-transition-duration))}.ease-in{--tw-ease: var(--ease-in);transition-timing-function:var(--ease-in)}.ease-in-out{--tw-ease: var(--ease-in-out);transition-timing-function:var(--ease-in-out)}.ease-out{--tw-ease: var(--ease-out);transition-timing-function:var(--ease-out)}.outline-none{--tw-outline-style: none;outline-style:none}.focus-within\\:ring-2:focus-within{--tw-ring-shadow: var(--tw-ring-inset, ) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.focus-within\\:ring-\\[var\\(--dsw-alias-brand-primary\\)\\]:focus-within{--tw-ring-color: var(--dsw-alias-brand-primary)}@media(hover:hover){.hover\\:text-\\[var\\(--dsw-alias-label-primary\\)\\]:hover{color:var(--dsw-alias-label-primary)}}.focus-visible\\:ring-2:focus-visible{--tw-ring-shadow: var(--tw-ring-inset, ) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.focus-visible\\:ring-\\[var\\(--dsw-alias-brand-primary\\)\\]:focus-visible{--tw-ring-color: var(--dsw-alias-brand-primary)}.focus-visible\\:outline:focus-visible{outline-style:var(--tw-outline-style);outline-width:1px}.focus-visible\\:outline-2:focus-visible{outline-style:var(--tw-outline-style);outline-width:2px}.focus-visible\\:outline-\\[var\\(--dsw-alias-brand-primary\\)\\]:focus-visible{outline-color:var(--dsw-alias-brand-primary)}.disabled\\:opacity-50:disabled{opacity:50%}.disabled\\:opacity-60:disabled{opacity:60%}.aria-selected\\:border-\\[var\\(--dsw-alias-brand-primary\\)\\][aria-selected=true]{border-color:var(--dsw-alias-brand-primary)}.aria-selected\\:text-\\[var\\(--dsw-alias-label-primary\\)\\][aria-selected=true]{color:var(--dsw-alias-label-primary)}@media(min-width:40rem){.sm\\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.sm\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}}}@property --tw-rotate-x{syntax: "*"; inherits: false;}@property --tw-rotate-y{syntax: "*"; inherits: false;}@property --tw-rotate-z{syntax: "*"; inherits: false;}@property --tw-skew-x{syntax: "*"; inherits: false;}@property --tw-skew-y{syntax: "*"; inherits: false;}@property --tw-border-style{syntax: "*"; inherits: false; initial-value: solid;}@property --tw-font-weight{syntax: "*"; inherits: false;}@property --tw-ordinal{syntax: "*"; inherits: false;}@property --tw-slashed-zero{syntax: "*"; inherits: false;}@property --tw-numeric-figure{syntax: "*"; inherits: false;}@property --tw-numeric-spacing{syntax: "*"; inherits: false;}@property --tw-numeric-fraction{syntax: "*"; inherits: false;}@property --tw-shadow{syntax: "*"; inherits: false; initial-value: 0 0 #0000;}@property --tw-shadow-color{syntax: "*"; inherits: false;}@property --tw-shadow-alpha{syntax: "<percentage>"; inherits: false; initial-value: 100%;}@property --tw-inset-shadow{syntax: "*"; inherits: false; initial-value: 0 0 #0000;}@property --tw-inset-shadow-color{syntax: "*"; inherits: false;}@property --tw-inset-shadow-alpha{syntax: "<percentage>"; inherits: false; initial-value: 100%;}@property --tw-ring-color{syntax: "*"; inherits: false;}@property --tw-ring-shadow{syntax: "*"; inherits: false; initial-value: 0 0 #0000;}@property --tw-inset-ring-color{syntax: "*"; inherits: false;}@property --tw-inset-ring-shadow{syntax: "*"; inherits: false; initial-value: 0 0 #0000;}@property --tw-ring-inset{syntax: "*"; inherits: false;}@property --tw-ring-offset-width{syntax: "<length>"; inherits: false; initial-value: 0px;}@property --tw-ring-offset-color{syntax: "*"; inherits: false; initial-value: #fff;}@property --tw-ring-offset-shadow{syntax: "*"; inherits: false; initial-value: 0 0 #0000;}@property --tw-blur{syntax: "*"; inherits: false;}@property --tw-brightness{syntax: "*"; inherits: false;}@property --tw-contrast{syntax: "*"; inherits: false;}@property --tw-grayscale{syntax: "*"; inherits: false;}@property --tw-hue-rotate{syntax: "*"; inherits: false;}@property --tw-invert{syntax: "*"; inherits: false;}@property --tw-opacity{syntax: "*"; inherits: false;}@property --tw-saturate{syntax: "*"; inherits: false;}@property --tw-sepia{syntax: "*"; inherits: false;}@property --tw-drop-shadow{syntax: "*"; inherits: false;}@property --tw-drop-shadow-color{syntax: "*"; inherits: false;}@property --tw-drop-shadow-alpha{syntax: "<percentage>"; inherits: false; initial-value: 100%;}@property --tw-drop-shadow-size{syntax: "*"; inherits: false;}@property --tw-ease{syntax: "*"; inherits: false;}@property --tw-outline-style{syntax: "*"; inherits: false; initial-value: solid;}@layer properties{@supports ((-webkit-hyphens: none) and (not (margin-trim: block))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b)))){*,:before,:after,::backdrop{--tw-rotate-x: initial;--tw-rotate-y: initial;--tw-rotate-z: initial;--tw-skew-x: initial;--tw-skew-y: initial;--tw-border-style: solid;--tw-font-weight: initial;--tw-ordinal: initial;--tw-slashed-zero: initial;--tw-numeric-figure: initial;--tw-numeric-spacing: initial;--tw-numeric-fraction: initial;--tw-shadow: 0 0 #0000;--tw-shadow-color: initial;--tw-shadow-alpha: 100%;--tw-inset-shadow: 0 0 #0000;--tw-inset-shadow-color: initial;--tw-inset-shadow-alpha: 100%;--tw-ring-color: initial;--tw-ring-shadow: 0 0 #0000;--tw-inset-ring-color: initial;--tw-inset-ring-shadow: 0 0 #0000;--tw-ring-inset: initial;--tw-ring-offset-width: 0px;--tw-ring-offset-color: #fff;--tw-ring-offset-shadow: 0 0 #0000;--tw-blur: initial;--tw-brightness: initial;--tw-contrast: initial;--tw-grayscale: initial;--tw-hue-rotate: initial;--tw-invert: initial;--tw-opacity: initial;--tw-saturate: initial;--tw-sepia: initial;--tw-drop-shadow: initial;--tw-drop-shadow-color: initial;--tw-drop-shadow-alpha: 100%;--tw-drop-shadow-size: initial;--tw-ease: initial;--tw-outline-style: solid}}}';
function H(e, i) {
  return { mode: "strict", typeSymbol: e, create: () => i };
}
function R(e, i) {
  const o = H(`dsh-desktop-tools#desktopTools:${e}`, i);
  return { name: e, source: "json", codec: o, strictCodec: o };
}
function u(e, i, o) {
  return {
    service: "desktopTools",
    invocation: { kind: "direct" },
    parameters: i,
    result: H(`dsh-desktop-tools#desktopTools:${e}:result`, o)
  };
}
const v = w.json(), se = {
  package: "dsh-desktop-tools",
  methods: {
    "desktopTools/snapshot": u("snapshot", [], v),
    "desktopTools/update": u("update", [R("config", v)], v),
    "desktopTools/restart": u("restart", [], v),
    "desktopTools/installVision": u("installVision", [], v),
    "desktopTools/openCapture": u("openCapture", [R("mode", w.enum(["image", "video", "long"]))], w.object({ opened: w.literal(!0) })),
    "desktopTools/avatar": u("avatar", [], w.object({ dataUrl: w.string().optional() })),
    "desktopTools/setAvatar": u("setAvatar", [R("dataUrl", w.string()), R("fileName", w.string())], v),
    "desktopTools/restoreAvatar": u("restoreAvatar", [], v),
    "desktopTools/systemPermissions": u("systemPermissions", [], v),
    "desktopTools/openSystemPermission": u("openSystemPermission", [R("right", w.enum(["screen", "accessibility"]))], v)
  }
}, ne = W(se, w), pe = ["slots", "locale", "remote", "remote.desktopTools"];
async function me(e) {
  const i = await e.remote.$mount(ne), o = document.createElement("style");
  o.dataset.dshDesktopTools = "", o.textContent = oe, document.head.append(o);
  const l = "desktopTools";
  e.effect(() => e.locale.register(l, { en: re, zh: ie }), "desktop-tools: dictionaries");
  const r = e.locale.bind(l), g = {
    snapshot: () => e.remote.desktopTools.snapshot(),
    update: (d) => e.remote.desktopTools.update(d),
    restart: () => e.remote.desktopTools.restart(),
    avatar: () => e.remote.desktopTools.avatar(),
    setAvatar: (d, h) => e.remote.desktopTools.setAvatar(d, h),
    restoreAvatar: () => e.remote.desktopTools.restoreAvatar(),
    systemPermissions: () => e.remote.desktopTools.systemPermissions(),
    openSystemPermission: (d) => e.remote.desktopTools.openSystemPermission(d),
    installVision: () => e.remote.desktopTools.installVision(),
    openCapture: (d) => e.remote.desktopTools.openCapture(d)
  }, a = e.slots.inject("settings.section", () => e.slots.register({
    name: "settings.section",
    id: "desktop-tools",
    order: 40,
    label: () => r("title"),
    locale: l,
    inject: () => ({ services: g })
  }, ae));
  let n = !1;
  const y = async () => {
    n || (n = !0, a(), o.remove(), await i());
  };
  return e.effect(() => y, "desktop-tools: Client resources"), y;
}
export {
  me as apply,
  pe as inject
};
