window.__ModuleLoader__.load({ id: "dsh-desktop-tools", factory: (require) => {
  "use strict";
  var module = { exports: {} };
  var exports = module.exports;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  const jsxRuntime = require("react/jsx-runtime");
  const react = require("react");
  const zod = require("zod");
  const KEY_NAMES = {
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
  function acceleratorOf(event) {
    const code = event.code;
    const key = /^Key[A-Z]$/u.test(code) ? code.slice(3) : /^Digit\d$/u.test(code) ? code.slice(5) : /^F([1-9]|1\d|2[0-4])$/u.test(code) ? code : KEY_NAMES[code];
    if (key === void 0) return void 0;
    const modifiers = [];
    if (event.ctrlKey || event.metaKey) modifiers.push("CommandOrControl");
    if (event.altKey) modifiers.push("Alt");
    if (event.shiftKey) modifiers.push("Shift");
    if (modifiers.length === 0 && key !== "PrintScreen") return void 0;
    return [...modifiers, key].join("+");
  }
  function acceleratorLabel(value, platform) {
    if (value === "") return "—";
    const mac = platform === "darwin";
    return value.split("+").map((part) => part === "CommandOrControl" ? mac ? "⌘" : "Ctrl" : mac && part === "Alt" ? "⌥" : mac && part === "Shift" ? "⇧" : part).join(" + ");
  }
  const tabs = ["selection", "floating", "screenshot", "recording"];
  function statusLabel(phase, t) {
    if (phase === "active") return t("featureActive");
    if (phase === "starting") return t("featureStarting");
    if (phase === "error") return t("featureError");
    return t("featureDisabled");
  }
  function applicationMatches(snapshot) {
    const expected = {
      selection: snapshot.config.selection.enabled,
      floatingBall: snapshot.config.floatingBall.enabled,
      capture: snapshot.config.screenshot.enabled || snapshot.config.recording.enabled
    };
    return Object.keys(expected).every((id) => {
      const phase = snapshot.features[id].phase;
      return expected[id] ? phase === "active" : phase === "disabled";
    });
  }
  function ModelFields({ value, disabled, t, onChange }) {
    return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "grid min-w-0 gap-3 sm:grid-cols-3", children: ["provider", "model", "reasoningEffort"].map((field) => /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "grid min-w-0 gap-1 text-sm", children: [
      /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-[var(--dsw-alias-label-tertiary)]", children: t(field === "reasoningEffort" ? "effort" : field) }),
      /* @__PURE__ */ jsxRuntime.jsx(
        "input",
        {
          className: "min-w-0 rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2 text-[var(--dsw-alias-label-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--dsw-alias-brand-primary)] disabled:opacity-60",
          disabled,
          value: value[field] ?? "",
          onChange: (event) => onChange({ ...value, [field]: event.currentTarget.value })
        }
      )
    ] }, field)) });
  }
  function DesktopToolsSettings({ t, services }) {
    const [tab, setTab] = react.useState("selection");
    const [snapshot, setSnapshot] = react.useState();
    const [draft, setDraft] = react.useState();
    const [avatar, setAvatar] = react.useState();
    const [permissions, setPermissions] = react.useState();
    const [busy, setBusy] = react.useState(false);
    const [pending, setPending] = react.useState(false);
    const [message, setMessage] = react.useState("");
    const [capturing, setCapturing] = react.useState();
    const [installing, setInstalling] = react.useState(false);
    const load = async () => {
      setMessage("");
      let result;
      try {
        result = await Promise.race([services.snapshot(), new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error("timeout"));
          }, 15e3);
        })]);
      } catch (error) {
        setMessage(t("loadError") + "（" + (error instanceof Error ? error.message : String(error)) + "）");
        return;
      }
      if (!result.ok) {
        setMessage(t("loadError") + "（" + String(result.error?.message ?? result.error) + "）");
        return;
      }
      setSnapshot(result.value);
      setDraft(result.value.config);
      setMessage("");
      const image = await services.avatar();
      if (image.ok) setAvatar(image.value.dataUrl);
    };
    react.useEffect(() => {
      void load();
    }, []);
    const save = async () => {
      if (draft === void 0 || busy) return;
      setBusy(true);
      setMessage("");
      const result = await services.update(draft);
      setBusy(false);
      if (!result.ok) {
        setMessage(t("saveError"));
        return;
      }
      setSnapshot(result.value.snapshot);
      setDraft(result.value.snapshot.config);
      setPending(!result.value.applied);
      setMessage(result.value.applied ? t("saved") : t("pending"));
    };
    const retry = async () => {
      if (busy) return;
      setBusy(true);
      const result = await services.restart();
      setBusy(false);
      if (!result.ok) {
        setMessage(t("pending"));
        return;
      }
      setSnapshot(result.value);
      const applied = applicationMatches(result.value);
      setPending(!applied);
      setMessage(applied ? t("saved") : t("pending"));
    };
    const setFeature = (feature, enabled2) => {
      if (draft === void 0) return;
      if (feature === "selection") setDraft({ ...draft, selection: { ...draft.selection, enabled: enabled2 } });
      else if (feature === "floating") setDraft({ ...draft, floatingBall: { ...draft.floatingBall, enabled: enabled2 } });
      else if (feature === "screenshot") setDraft({ ...draft, screenshot: { ...draft.screenshot, enabled: enabled2 } });
      else setDraft({ ...draft, recording: { ...draft.recording, enabled: enabled2 } });
    };
    const active = snapshot?.features[tab === "floating" ? "floatingBall" : tab === "selection" ? "selection" : "capture"];
    const enabled = draft === void 0 ? false : tab === "selection" ? draft.selection.enabled : tab === "floating" ? draft.floatingBall.enabled : tab === "screenshot" ? draft.screenshot.enabled : draft.recording.enabled;
    const setShortcut = (field, value) => {
      if (draft === void 0) return;
      if (field === "screenshot.shortcut") setDraft({ ...draft, screenshot: { ...draft.screenshot, shortcut: value } });
      else if (field === "screenshot.longShortcut") setDraft({ ...draft, screenshot: { ...draft.screenshot, longShortcut: value } });
      else setDraft({ ...draft, recording: { ...draft.recording, shortcut: value } });
    };
    const shortcutValue = (field) => draft === void 0 ? "" : field === "screenshot.shortcut" ? draft.screenshot.shortcut : field === "screenshot.longShortcut" ? draft.screenshot.longShortcut : draft.recording.shortcut;
    const captureShortcut = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setCapturing(void 0);
        return;
      }
      if (/^(Control|Alt|Shift|Meta)$/u.test(event.key)) return;
      event.preventDefault();
      const accelerator = acceleratorOf(event);
      if (accelerator === void 0 || capturing === void 0) {
        setMessage(t("shortcutInvalid"));
        return;
      }
      setShortcut(capturing, accelerator);
      setMessage("");
      setCapturing(void 0);
    };
    const installVision = async () => {
      if (installing) return;
      setInstalling(true);
      setMessage(t("visionInstalling"));
      const result = await services.installVision();
      setInstalling(false);
      if (!result.ok) {
        setMessage(t("visionInstallFailed"));
        return;
      }
      setSnapshot(result.value.snapshot);
      setMessage(result.value.restartRequired ? t("visionRestart") : t("visionReady"));
    };
    react.useEffect(() => {
      if (capturing === void 0) return;
      const listener = (event) => {
        captureShortcut(event);
      };
      document.addEventListener("keydown", listener, true);
      return () => document.removeEventListener("keydown", listener, true);
    }, [capturing]);
    const uploadAvatar = (event) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (file === void 0 || !file.type.match(/^image\/(gif|png|webp)$/u)) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") return;
        void services.setAvatar(reader.result, file.name).then((result) => {
          if (result.ok && typeof reader.result === "string") setAvatar(reader.result);
          else setMessage(t("saveError"));
        });
      };
      reader.readAsDataURL(file);
    };
    const checkPermissions = async () => {
      const result = await services.systemPermissions();
      if (result.ok) setPermissions(result.value);
      else setMessage(t("pending"));
    };
    const setModel = (key, value) => {
      if (draft === void 0) return;
      if (key === "selection") setDraft({ ...draft, selection: { ...draft.selection, model: value } });
      else if (key === "conversationModel") setDraft({ ...draft, floatingBall: { ...draft.floatingBall, conversationModel: value } });
      else setDraft({ ...draft, floatingBall: { ...draft.floatingBall, backgroundModel: value } });
    };
    const setSelectionModelEnabled = (enabled2) => {
      if (draft === void 0) return;
      if (enabled2) setDraft({ ...draft, selection: { ...draft.selection, model: { provider: "deepseek-official", model: "deepseek-flash", reasoningEffort: "max" } } });
      else {
        const { model: _model, ...selection } = draft.selection;
        setDraft({ ...draft, selection });
      }
    };
    if (draft === void 0) return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "grid gap-4", "aria-busy": "true", children: [
      /* @__PURE__ */ jsxRuntime.jsx("h2", { className: "text-base font-semibold text-[var(--dsw-alias-label-primary)]", children: t("title") }),
      message ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsx("p", { role: "alert", className: "text-sm text-[var(--dsw-alias-state-error-primary)]", children: message }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "w-fit rounded border border-[var(--dsw-alias-border-l2)] px-3 py-1.5 text-sm", onClick: () => {
          void load();
        }, children: t("retryLoad") })
      ] }) : /* @__PURE__ */ jsxRuntime.jsx("p", { role: "status", className: "text-sm text-[var(--dsw-alias-label-tertiary)]", children: t("loading") })
    ] });
    return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "grid min-w-0 gap-4 text-[var(--dsw-alias-label-primary)]", "aria-busy": busy, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("header", { className: "flex min-w-0 flex-wrap items-center justify-between gap-3", children: [
        /* @__PURE__ */ jsxRuntime.jsx("h2", { className: "text-base font-semibold", children: t("title") }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-xs text-[var(--dsw-alias-label-tertiary)]", children: snapshot?.runtime === "running" ? t("runtimeRunning") : snapshot?.runtime === "degraded" ? t("runtimeDegraded") : t("runtimeStopped") })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("nav", { className: "flex flex-wrap gap-1 border-b border-[var(--border-subtle)]", "aria-label": t("title"), children: tabs.map((item) => /* @__PURE__ */ jsxRuntime.jsx(
        "button",
        {
          type: "button",
          role: "tab",
          "aria-selected": tab === item,
          onClick: () => setTab(item),
          className: "max-w-full border-b-2 border-transparent px-3 py-2 text-sm text-[var(--dsw-alias-label-tertiary)] hover:text-[var(--dsw-alias-label-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--dsw-alias-brand-primary)] aria-selected:border-[var(--dsw-alias-brand-primary)] aria-selected:text-[var(--dsw-alias-label-primary)]",
          children: t(item)
        },
        item
      )) }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid min-w-0 gap-4", role: "tabpanel", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "flex min-h-10 items-center gap-2 text-sm", children: [
            /* @__PURE__ */ jsxRuntime.jsx("input", { type: "checkbox", checked: enabled, onChange: (event) => setFeature(tab, event.currentTarget.checked) }),
            t("enabled")
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-xs text-[var(--dsw-alias-label-tertiary)]", children: statusLabel(active?.phase ?? "disabled", t) }),
          active?.phase === "error" && active.error && /* @__PURE__ */ jsxRuntime.jsx("span", { role: "alert", className: "basis-full text-xs text-[var(--dsw-alias-state-error-primary)]", children: active.error })
        ] }),
        tab === "selection" && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "grid gap-1 text-sm", children: [
            /* @__PURE__ */ jsxRuntime.jsx("span", { children: t("language") }),
            /* @__PURE__ */ jsxRuntime.jsx("input", { className: "min-w-0 rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2", value: draft.selection.targetLanguage, onChange: (event) => setDraft({ ...draft, selection: { ...draft.selection, targetLanguage: event.currentTarget.value } }) })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "flex min-h-10 items-center gap-2 text-sm", children: [
            /* @__PURE__ */ jsxRuntime.jsx("input", { type: "checkbox", checked: draft.selection.compatibilityCopy, onChange: (event) => setDraft({ ...draft, selection: { ...draft.selection, compatibilityCopy: event.currentTarget.checked } }) }),
            t("compatibilityCopy")
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "flex min-h-10 items-center gap-2 text-sm", children: [
            /* @__PURE__ */ jsxRuntime.jsx("input", { type: "checkbox", checked: draft.selection.model !== void 0, onChange: (event) => setSelectionModelEnabled(event.currentTarget.checked) }),
            t("customModel")
          ] }),
          draft.selection.model === void 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm text-[var(--dsw-alias-label-tertiary)]", children: t("followSession") }) : /* @__PURE__ */ jsxRuntime.jsx(ModelFields, { value: draft.selection.model, disabled: busy, t, onChange: (value) => setModel("selection", value) })
        ] }),
        tab === "floating" && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [
            avatar === void 0 ? /* @__PURE__ */ jsxRuntime.jsx("span", { "aria-hidden": "true", className: "size-12 rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)]" }) : /* @__PURE__ */ jsxRuntime.jsx("img", { src: avatar, alt: "", className: "size-12 rounded border border-[var(--dsw-alias-border-l2)] object-cover" }),
            /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "cursor-pointer rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-[var(--dsw-alias-brand-primary)]", children: [
              t("chooseAvatar"),
              /* @__PURE__ */ jsxRuntime.jsx("input", { className: "sr-only", type: "file", accept: "image/gif,image/png,image/webp", onChange: uploadAvatar })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm", onClick: () => {
              void services.restoreAvatar().then((result) => {
                if (result.ok) void load();
              });
            }, children: t("restoreAvatar") })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx("h3", { className: "text-sm font-medium", children: t("conversationModel") }),
          /* @__PURE__ */ jsxRuntime.jsx(ModelFields, { value: draft.floatingBall.conversationModel, disabled: busy, t, onChange: (value) => setModel("conversationModel", value) }),
          /* @__PURE__ */ jsxRuntime.jsx("h3", { className: "text-sm font-medium", children: t("backgroundModel") }),
          /* @__PURE__ */ jsxRuntime.jsx(ModelFields, { value: draft.floatingBall.backgroundModel, disabled: busy, t, onChange: (value) => setModel("backgroundModel", value) }),
          /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "grid gap-1 text-sm", children: [
            /* @__PURE__ */ jsxRuntime.jsx("span", { children: t("permissionPreset") }),
            /* @__PURE__ */ jsxRuntime.jsxs("select", { className: "rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2", value: draft.floatingBall.permissionPreset, onChange: (event) => setDraft({ ...draft, floatingBall: { ...draft.floatingBall, permissionPreset: event.currentTarget.value } }), children: [
              /* @__PURE__ */ jsxRuntime.jsx("option", { value: "read-only", children: "read-only" }),
              /* @__PURE__ */ jsxRuntime.jsx("option", { value: "workspace-write", children: "workspace-write" }),
              /* @__PURE__ */ jsxRuntime.jsx("option", { value: "danger-full-access", children: "danger-full-access" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "grid gap-1 text-sm", children: [
            /* @__PURE__ */ jsxRuntime.jsx("span", { children: t("coordinateMode") }),
            /* @__PURE__ */ jsxRuntime.jsxs("select", { className: "rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2", value: draft.floatingBall.coordinateMode, onChange: (event) => setDraft({ ...draft, floatingBall: { ...draft.floatingBall, coordinateMode: event.currentTarget.value } }), children: [
              /* @__PURE__ */ jsxRuntime.jsx("option", { value: "millifraction", children: "millifraction" }),
              /* @__PURE__ */ jsxRuntime.jsx("option", { value: "pixel", children: "pixel" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
              /* @__PURE__ */ jsxRuntime.jsx("h3", { className: "text-sm font-medium", children: t("systemPermissions") }),
              /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "text-sm text-[var(--dsw-alias-brand-primary)]", onClick: () => {
                void checkPermissions();
              }, children: t("check") })
            ] }),
            ["screen", "accessibility"].map((right) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 text-sm", children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { children: t(right === "screen" ? "screenPermission" : "accessibilityPermission") }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { children: permissions?.[right] === true ? t("permissionGranted") : permissions?.[right] === false ? t("permissionDenied") : t("permissionUnknown") }),
              /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "text-[var(--dsw-alias-brand-primary)]", onClick: () => {
                void services.openSystemPermission(right).then(() => {
                  void checkPermissions();
                });
              }, children: t("openSettings") })
            ] }, right))
          ] })
        ] }),
        (tab === "screenshot" || tab === "recording") && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid gap-3", children: [
          (tab === "screenshot" ? ["screenshot.shortcut", "screenshot.longShortcut"] : ["recording.shortcut"]).map((field) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-sm text-[var(--dsw-alias-label-tertiary)]", children: t(field === "screenshot.longShortcut" ? "longShortcut" : "shortcut") }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
              /* @__PURE__ */ jsxRuntime.jsx("kbd", { className: "rounded border border-[var(--dsw-alias-border-l2)] px-2 py-1 text-sm", children: acceleratorLabel(shortcutValue(field), snapshot?.platform) }),
              /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--dsw-alias-brand-primary)]", onClick: () => setCapturing(field), children: capturing === field ? t("recordingShortcut") : t("recordShortcut") }),
              shortcutValue(field) !== "" && /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "px-2 py-2 text-sm text-[var(--dsw-alias-label-tertiary)] hover:text-[var(--dsw-alias-label-primary)]", onClick: () => setShortcut(field, ""), children: t("clearShortcut") }),
              /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "px-2 py-2 text-sm text-[var(--dsw-alias-brand-primary)] disabled:opacity-50", disabled: active?.phase !== "active", onClick: () => {
                void services.openCapture(field === "recording.shortcut" ? "video" : field === "screenshot.longShortcut" ? "long" : "image");
              }, children: t("tryNow") })
            ] })
          ] }, field)),
          /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-xs text-[var(--dsw-alias-label-tertiary)]", children: t("globalShortcutHint") })
        ] }),
        tab === "screenshot" && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid gap-2 rounded border border-[var(--dsw-alias-border-l2)] p-3", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx("h3", { className: "text-sm font-medium", children: t("visionTitle") }),
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: snapshot?.vision.state === "ready" ? "text-xs text-[var(--dsw-alias-state-success-primary)]" : "text-xs text-[var(--dsw-alias-label-tertiary)]", children: t(snapshot?.vision.state === "ready" ? "visionStateReady" : snapshot?.vision.state === "missing" ? "visionStateMissing" : snapshot?.vision.state === "disabled" ? "visionStateDisabled" : snapshot?.vision.state === "tool-off" ? "visionStateToolOff" : "visionStateUnknown") })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm text-[var(--dsw-alias-label-tertiary)]", children: t("visionDescription") }),
          snapshot?.vision.state !== "ready" && snapshot?.vision.state !== "tool-off" && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", disabled: installing, className: "rounded bg-[var(--dsw-alias-brand-primary)] px-3 py-2 text-sm text-white disabled:opacity-50", onClick: () => {
              void installVision();
            }, children: installing ? t("visionInstalling") : snapshot?.vision.state === "disabled" ? t("visionEnable") : t("visionInstall") }),
            /* @__PURE__ */ jsxRuntime.jsx("code", { className: "text-xs text-[var(--dsw-alias-label-tertiary)]", children: "dsh plugin add dsh-vision-router" })
          ] })
        ] }),
        tab === "recording" && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid gap-3", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "grid gap-1 text-sm", children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { children: t("recordingFormat") }),
              /* @__PURE__ */ jsxRuntime.jsxs("select", { className: "rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2", value: draft.recording.format, onChange: (event) => setDraft({ ...draft, recording: { ...draft.recording, format: event.currentTarget.value } }), children: [
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "mp4", children: "MP4" }),
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "gif", children: "GIF" }),
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "webm", children: "WebM" })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "grid gap-1 text-sm", children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { children: t("recordingQuality") }),
              /* @__PURE__ */ jsxRuntime.jsxs("select", { className: "rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2", value: draft.recording.quality, onChange: (event) => setDraft({ ...draft, recording: { ...draft.recording, quality: event.currentTarget.value } }), children: [
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "sd", children: t("qualitySd") }),
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "hd", children: t("qualityHd") }),
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "original", children: t("qualityOriginal") })
              ] })
            ] })
          ] }),
          ["systemAudio", "microphone", "knowledgeGraph"].map((field) => /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "flex min-h-10 items-center gap-2 text-sm", children: [
            /* @__PURE__ */ jsxRuntime.jsx("input", { type: "checkbox", checked: draft.recording[field], disabled: field === "systemAudio" && snapshot?.platform === "linux", onChange: (event) => setDraft({ ...draft, recording: { ...draft.recording, [field]: event.currentTarget.checked } }) }),
            t(field === "systemAudio" ? "recordingSystemAudio" : field === "microphone" ? "recordingMicrophone" : "recordingGraph")
          ] }, field)),
          /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-xs text-[var(--dsw-alias-label-tertiary)]", children: t("recordingGraphHint") })
        ] })
      ] }),
      message && /* @__PURE__ */ jsxRuntime.jsx("p", { role: "status", className: message === t("saved") ? "text-sm text-[var(--dsw-alias-state-success-primary)]" : "text-sm text-[var(--dsw-alias-state-error-primary)]", children: message }),
      /* @__PURE__ */ jsxRuntime.jsxs("footer", { className: "flex flex-wrap justify-end gap-2 border-t border-[var(--dsw-alias-border-l2)] pt-3", children: [
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", disabled: busy, className: "rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm disabled:opacity-50", onClick: () => {
          void load();
        }, children: t("check") }),
        pending && /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", disabled: busy, className: "rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm disabled:opacity-50", onClick: () => {
          void retry();
        }, children: t("retry") }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", disabled: busy, className: "rounded bg-[var(--dsw-alias-brand-primary)] px-3 py-2 text-sm text-white disabled:opacity-50", onClick: () => {
          void save();
        }, children: busy ? t("saving") : t("save") })
      ] })
    ] });
  }
  const en = {
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
    loading: "Loading…",
    retryLoad: "Reload",
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
  };
  const zh = {
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
    loading: "正在读取桌面工具状态…",
    retryLoad: "重新读取",
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
  };
  const desktopToolsCss = `/*! tailwindcss v4.3.5 | MIT License | https://tailwindcss.com */
@layer properties;
@layer theme {
  :root, :host {
    --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
    --color-red-50: oklch(97.1% 0.013 17.38);
    --color-red-200: oklch(88.5% 0.062 18.334);
    --color-red-700: oklch(50.5% 0.213 27.518);
    --color-red-950: oklch(25.8% 0.092 26.042);
    --color-amber-50: oklch(98.7% 0.022 95.277);
    --color-amber-200: oklch(92.4% 0.12 95.746);
    --color-amber-800: oklch(47.3% 0.137 46.201);
    --color-amber-950: oklch(27.9% 0.077 45.635);
    --color-blue-400: oklch(70.7% 0.165 254.624);
    --color-blue-500: oklch(62.3% 0.214 259.815);
    --color-blue-600: oklch(54.6% 0.245 262.881);
    --color-slate-50: oklch(98.4% 0.003 247.858);
    --color-slate-100: oklch(96.8% 0.007 247.896);
    --color-slate-200: oklch(92.9% 0.013 255.508);
    --color-slate-300: oklch(86.9% 0.022 252.894);
    --color-slate-400: oklch(70.4% 0.04 256.788);
    --color-slate-500: oklch(55.4% 0.046 257.417);
    --color-slate-700: oklch(37.2% 0.044 257.287);
    --color-slate-800: oklch(27.9% 0.041 260.031);
    --color-slate-900: oklch(20.8% 0.042 265.755);
    --color-white: #fff;
    --spacing: 0.25rem;
    --text-xs: 0.75rem;
    --text-xs--line-height: calc(1 / 0.75);
    --text-sm: 0.875rem;
    --text-sm--line-height: calc(1.25 / 0.875);
    --text-base: 1rem;
    --text-base--line-height: calc(1.5 / 1);
    --text-lg: 1.125rem;
    --text-lg--line-height: calc(1.75 / 1.125);
    --text-xl: 1.25rem;
    --text-xl--line-height: calc(1.75 / 1.25);
    --font-weight-normal: 400;
    --font-weight-medium: 500;
    --font-weight-semibold: 600;
    --leading-snug: 1.375;
    --radius-lg: 0.5rem;
    --radius-xl: 0.75rem;
    --radius-2xl: 1rem;
    --ease-in: cubic-bezier(0.4, 0, 1, 1);
    --ease-out: cubic-bezier(0, 0, 0.2, 1);
    --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
    --default-transition-duration: 150ms;
    --default-transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
}
@layer utilities {
  .\\@container {
    container-type: inline-size;
  }
  .collapse {
    visibility: collapse;
  }
  .invisible {
    visibility: hidden;
  }
  .visible {
    visibility: visible;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border-width: 0;
  }
  .absolute {
    position: absolute;
  }
  .fixed {
    position: fixed;
  }
  .relative {
    position: relative;
  }
  .static {
    position: static;
  }
  .sticky {
    position: sticky;
  }
  .container {
    width: 100%;
    @media (width >= 40rem) {
      max-width: 40rem;
    }
    @media (width >= 48rem) {
      max-width: 48rem;
    }
    @media (width >= 64rem) {
      max-width: 64rem;
    }
    @media (width >= 80rem) {
      max-width: 80rem;
    }
    @media (width >= 96rem) {
      max-width: 96rem;
    }
  }
  .block {
    display: block;
  }
  .contents {
    display: contents;
  }
  .flex {
    display: flex;
  }
  .grid {
    display: grid;
  }
  .hidden {
    display: none;
  }
  .inline {
    display: inline;
  }
  .inline-block {
    display: inline-block;
  }
  .table {
    display: table;
  }
  .table-cell {
    display: table-cell;
  }
  .size-1 {
    width: var(--spacing);
    height: var(--spacing);
  }
  .size-12 {
    width: calc(var(--spacing) * 12);
    height: calc(var(--spacing) * 12);
  }
  .h-40 {
    height: calc(var(--spacing) * 40);
  }
  .h-84 {
    height: calc(var(--spacing) * 84);
  }
  .h-120 {
    height: calc(var(--spacing) * 120);
  }
  .min-h-10 {
    min-height: calc(var(--spacing) * 10);
  }
  .w-fit {
    width: fit-content;
  }
  .max-w-full {
    max-width: 100%;
  }
  .min-w-0 {
    min-width: 0px;
  }
  .grow {
    flex-grow: 1;
  }
  .basis-full {
    flex-basis: 100%;
  }
  .transform {
    transform: var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, );
  }
  .transform\\! {
    transform: var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, ) !important;
  }
  .cursor-pointer {
    cursor: pointer;
  }
  .resize {
    resize: both;
  }
  .flex-wrap {
    flex-wrap: wrap;
  }
  .items-center {
    align-items: center;
  }
  .justify-between {
    justify-content: space-between;
  }
  .justify-end {
    justify-content: flex-end;
  }
  .gap-1 {
    gap: var(--spacing);
  }
  .gap-2 {
    gap: calc(var(--spacing) * 2);
  }
  .gap-3 {
    gap: calc(var(--spacing) * 3);
  }
  .gap-4 {
    gap: calc(var(--spacing) * 4);
  }
  .rounded {
    border-radius: 0.25rem;
  }
  .border {
    border-style: var(--tw-border-style);
    border-width: 1px;
  }
  .border-t {
    border-top-style: var(--tw-border-style);
    border-top-width: 1px;
  }
  .border-b {
    border-bottom-style: var(--tw-border-style);
    border-bottom-width: 1px;
  }
  .border-b-2 {
    border-bottom-style: var(--tw-border-style);
    border-bottom-width: 2px;
  }
  .border-\\[var\\(--border-subtle\\)\\] {
    border-color: var(--border-subtle);
  }
  .border-\\[var\\(--dsw-alias-border-l2\\)\\] {
    border-color: var(--dsw-alias-border-l2);
  }
  .border-transparent {
    border-color: transparent;
  }
  .bg-\\[var\\(--dsw-alias-bg-module-platform\\)\\] {
    background-color: var(--dsw-alias-bg-module-platform);
  }
  .bg-\\[var\\(--dsw-alias-brand-primary\\)\\] {
    background-color: var(--dsw-alias-brand-primary);
  }
  .object-cover {
    object-fit: cover;
  }
  .p-3 {
    padding: calc(var(--spacing) * 3);
  }
  .px-2 {
    padding-inline: calc(var(--spacing) * 2);
  }
  .px-3 {
    padding-inline: calc(var(--spacing) * 3);
  }
  .py-1 {
    padding-block: var(--spacing);
  }
  .py-1\\.5 {
    padding-block: calc(var(--spacing) * 1.5);
  }
  .py-2 {
    padding-block: calc(var(--spacing) * 2);
  }
  .pt-3 {
    padding-top: calc(var(--spacing) * 3);
  }
  .text-base {
    font-size: var(--text-base);
    line-height: var(--tw-leading, var(--text-base--line-height));
  }
  .text-sm {
    font-size: var(--text-sm);
    line-height: var(--tw-leading, var(--text-sm--line-height));
  }
  .text-xs {
    font-size: var(--text-xs);
    line-height: var(--tw-leading, var(--text-xs--line-height));
  }
  .font-medium {
    --tw-font-weight: var(--font-weight-medium);
    font-weight: var(--font-weight-medium);
  }
  .font-semibold {
    --tw-font-weight: var(--font-weight-semibold);
    font-weight: var(--font-weight-semibold);
  }
  .text-wrap {
    text-wrap: wrap;
  }
  .text-\\[var\\(--dsw-alias-brand-primary\\)\\] {
    color: var(--dsw-alias-brand-primary);
  }
  .text-\\[var\\(--dsw-alias-label-primary\\)\\] {
    color: var(--dsw-alias-label-primary);
  }
  .text-\\[var\\(--dsw-alias-label-tertiary\\)\\] {
    color: var(--dsw-alias-label-tertiary);
  }
  .text-\\[var\\(--dsw-alias-state-error-primary\\)\\] {
    color: var(--dsw-alias-state-error-primary);
  }
  .text-\\[var\\(--dsw-alias-state-success-primary\\)\\] {
    color: var(--dsw-alias-state-success-primary);
  }
  .text-white {
    color: var(--color-white);
  }
  .capitalize {
    text-transform: capitalize;
  }
  .lowercase {
    text-transform: lowercase;
  }
  .uppercase {
    text-transform: uppercase;
  }
  .italic {
    font-style: italic;
  }
  .italic\\! {
    font-style: italic !important;
  }
  .ordinal {
    --tw-ordinal: ordinal;
    font-variant-numeric: var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, );
  }
  .line-through {
    text-decoration-line: line-through;
  }
  .overline {
    text-decoration-line: overline;
  }
  .underline {
    text-decoration-line: underline;
  }
  .shadow {
    --tw-shadow: 0 1px 3px 0 var(--tw-shadow-color, rgb(0 0 0 / 0.1)), 0 1px 2px -1px var(--tw-shadow-color, rgb(0 0 0 / 0.1));
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }
  .blur {
    --tw-blur: blur(8px);
    filter: var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, );
  }
  .blur\\! {
    --tw-blur: blur(8px) !important;
    filter: var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, ) !important;
  }
  .drop-shadow {
    --tw-drop-shadow-size: drop-shadow(0 1px 2px var(--tw-drop-shadow-color, rgb(0 0 0 / 0.1))) drop-shadow(0 1px 1px var(--tw-drop-shadow-color, rgb(0 0 0 / 0.06)));
    --tw-drop-shadow: drop-shadow(0 1px 2px rgb(0 0 0 / 0.1)) drop-shadow( 0 1px 1px rgb(0 0 0 / 0.06));
    filter: var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, );
  }
  .invert {
    --tw-invert: invert(100%);
    filter: var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, );
  }
  .filter {
    filter: var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, );
  }
  .transition {
    transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
    transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
    transition-duration: var(--tw-duration, var(--default-transition-duration));
  }
  .ease-in {
    --tw-ease: var(--ease-in);
    transition-timing-function: var(--ease-in);
  }
  .ease-in-out {
    --tw-ease: var(--ease-in-out);
    transition-timing-function: var(--ease-in-out);
  }
  .ease-out {
    --tw-ease: var(--ease-out);
    transition-timing-function: var(--ease-out);
  }
  .outline-none {
    --tw-outline-style: none;
    outline-style: none;
  }
  .focus-within\\:ring-2:focus-within {
    --tw-ring-shadow: var(--tw-ring-inset, ) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }
  .focus-within\\:ring-\\[var\\(--dsw-alias-brand-primary\\)\\]:focus-within {
    --tw-ring-color: var(--dsw-alias-brand-primary);
  }
  @media (hover: hover) {
    .hover\\:text-\\[var\\(--dsw-alias-label-primary\\)\\]:hover {
      color: var(--dsw-alias-label-primary);
    }
  }
  .focus-visible\\:ring-2:focus-visible {
    --tw-ring-shadow: var(--tw-ring-inset, ) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }
  .focus-visible\\:ring-\\[var\\(--dsw-alias-brand-primary\\)\\]:focus-visible {
    --tw-ring-color: var(--dsw-alias-brand-primary);
  }
  .focus-visible\\:outline:focus-visible {
    outline-style: var(--tw-outline-style);
    outline-width: 1px;
  }
  .focus-visible\\:outline-2:focus-visible {
    outline-style: var(--tw-outline-style);
    outline-width: 2px;
  }
  .focus-visible\\:outline-\\[var\\(--dsw-alias-brand-primary\\)\\]:focus-visible {
    outline-color: var(--dsw-alias-brand-primary);
  }
  .disabled\\:opacity-50:disabled {
    opacity: 50%;
  }
  .disabled\\:opacity-60:disabled {
    opacity: 60%;
  }
  .aria-selected\\:border-\\[var\\(--dsw-alias-brand-primary\\)\\][aria-selected="true"] {
    border-color: var(--dsw-alias-brand-primary);
  }
  .aria-selected\\:text-\\[var\\(--dsw-alias-label-primary\\)\\][aria-selected="true"] {
    color: var(--dsw-alias-label-primary);
  }
  @media (width >= 40rem) {
    .sm\\:grid-cols-2 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .sm\\:grid-cols-3 {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
}
@property --tw-rotate-x {
  syntax: "*";
  inherits: false;
}
@property --tw-rotate-y {
  syntax: "*";
  inherits: false;
}
@property --tw-rotate-z {
  syntax: "*";
  inherits: false;
}
@property --tw-skew-x {
  syntax: "*";
  inherits: false;
}
@property --tw-skew-y {
  syntax: "*";
  inherits: false;
}
@property --tw-border-style {
  syntax: "*";
  inherits: false;
  initial-value: solid;
}
@property --tw-font-weight {
  syntax: "*";
  inherits: false;
}
@property --tw-ordinal {
  syntax: "*";
  inherits: false;
}
@property --tw-slashed-zero {
  syntax: "*";
  inherits: false;
}
@property --tw-numeric-figure {
  syntax: "*";
  inherits: false;
}
@property --tw-numeric-spacing {
  syntax: "*";
  inherits: false;
}
@property --tw-numeric-fraction {
  syntax: "*";
  inherits: false;
}
@property --tw-shadow {
  syntax: "*";
  inherits: false;
  initial-value: 0 0 #0000;
}
@property --tw-shadow-color {
  syntax: "*";
  inherits: false;
}
@property --tw-shadow-alpha {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 100%;
}
@property --tw-inset-shadow {
  syntax: "*";
  inherits: false;
  initial-value: 0 0 #0000;
}
@property --tw-inset-shadow-color {
  syntax: "*";
  inherits: false;
}
@property --tw-inset-shadow-alpha {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 100%;
}
@property --tw-ring-color {
  syntax: "*";
  inherits: false;
}
@property --tw-ring-shadow {
  syntax: "*";
  inherits: false;
  initial-value: 0 0 #0000;
}
@property --tw-inset-ring-color {
  syntax: "*";
  inherits: false;
}
@property --tw-inset-ring-shadow {
  syntax: "*";
  inherits: false;
  initial-value: 0 0 #0000;
}
@property --tw-ring-inset {
  syntax: "*";
  inherits: false;
}
@property --tw-ring-offset-width {
  syntax: "<length>";
  inherits: false;
  initial-value: 0px;
}
@property --tw-ring-offset-color {
  syntax: "*";
  inherits: false;
  initial-value: #fff;
}
@property --tw-ring-offset-shadow {
  syntax: "*";
  inherits: false;
  initial-value: 0 0 #0000;
}
@property --tw-blur {
  syntax: "*";
  inherits: false;
}
@property --tw-brightness {
  syntax: "*";
  inherits: false;
}
@property --tw-contrast {
  syntax: "*";
  inherits: false;
}
@property --tw-grayscale {
  syntax: "*";
  inherits: false;
}
@property --tw-hue-rotate {
  syntax: "*";
  inherits: false;
}
@property --tw-invert {
  syntax: "*";
  inherits: false;
}
@property --tw-opacity {
  syntax: "*";
  inherits: false;
}
@property --tw-saturate {
  syntax: "*";
  inherits: false;
}
@property --tw-sepia {
  syntax: "*";
  inherits: false;
}
@property --tw-drop-shadow {
  syntax: "*";
  inherits: false;
}
@property --tw-drop-shadow-color {
  syntax: "*";
  inherits: false;
}
@property --tw-drop-shadow-alpha {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 100%;
}
@property --tw-drop-shadow-size {
  syntax: "*";
  inherits: false;
}
@property --tw-ease {
  syntax: "*";
  inherits: false;
}
@property --tw-outline-style {
  syntax: "*";
  inherits: false;
  initial-value: solid;
}
@layer properties {
  @supports ((-webkit-hyphens: none) and (not (margin-trim: block))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b)))) {
    *, ::before, ::after, ::backdrop {
      --tw-rotate-x: initial;
      --tw-rotate-y: initial;
      --tw-rotate-z: initial;
      --tw-skew-x: initial;
      --tw-skew-y: initial;
      --tw-border-style: solid;
      --tw-font-weight: initial;
      --tw-ordinal: initial;
      --tw-slashed-zero: initial;
      --tw-numeric-figure: initial;
      --tw-numeric-spacing: initial;
      --tw-numeric-fraction: initial;
      --tw-shadow: 0 0 #0000;
      --tw-shadow-color: initial;
      --tw-shadow-alpha: 100%;
      --tw-inset-shadow: 0 0 #0000;
      --tw-inset-shadow-color: initial;
      --tw-inset-shadow-alpha: 100%;
      --tw-ring-color: initial;
      --tw-ring-shadow: 0 0 #0000;
      --tw-inset-ring-color: initial;
      --tw-inset-ring-shadow: 0 0 #0000;
      --tw-ring-inset: initial;
      --tw-ring-offset-width: 0px;
      --tw-ring-offset-color: #fff;
      --tw-ring-offset-shadow: 0 0 #0000;
      --tw-blur: initial;
      --tw-brightness: initial;
      --tw-contrast: initial;
      --tw-grayscale: initial;
      --tw-hue-rotate: initial;
      --tw-invert: initial;
      --tw-opacity: initial;
      --tw-saturate: initial;
      --tw-sepia: initial;
      --tw-drop-shadow: initial;
      --tw-drop-shadow-color: initial;
      --tw-drop-shadow-alpha: 100%;
      --tw-drop-shadow-size: initial;
      --tw-ease: initial;
      --tw-outline-style: solid;
    }
  }
}\r
`;
  function createTypertRemoteInfo(spec2, zod2) {
    return new RemoteInfo(spec2, zod2);
  }
  class RemoteInfo {
    spec;
    zod;
    index;
    constructor(spec2, zod2) {
      this.spec = spec2;
      this.zod = zod2;
    }
    get package() {
      return this.spec.package;
    }
    get descriptors() {
      return this.resolve().descriptors;
    }
    get methods() {
      return this.resolve().methods;
    }
    resolve() {
      if (this.index !== void 0)
        return this.index;
      const zod2 = this.zod;
      const descriptors = [];
      const methods = /* @__PURE__ */ Object.create(null);
      for (const [endpoint, definition] of Object.entries(this.spec.methods)) {
        const separator = endpoint.indexOf("/");
        const namespace = endpoint.slice(0, separator);
        const method2 = endpoint.slice(separator + 1);
        const parameters = definition.parameters.map((parameter2) => ({ ...parameter2, wire: parameter2.wire ?? parameter2.name }));
        const descriptor = {
          ...definition,
          id: `${this.spec.package}#${endpoint}`,
          namespace,
          method: method2,
          parameters,
          result: definition.result.description === void 0 ? definition.result : new ResultValue(definition.result)
        };
        if (definition.invocation.kind === "direct") {
          const inputs = [];
          const direct = Object.assign(descriptor, {
            input(options) {
              const strict = options?.strict === true;
              return inputs[strict ? 1 : 0] ??= new NamedInput(parameters, strict, zod2);
            },
            invoke(remote2, input, signal) {
              const named = input;
              const values = parameters.map((parameter2) => named[parameter2.wire]);
              if (definition.cancellation !== void 0)
                values.push(signal);
              const receiver = Reflect.get(remote2, namespace);
              const call = Reflect.get(receiver, method2);
              return call.apply(receiver, values);
            }
          });
          methods[endpoint] = direct;
        }
        descriptors.push(descriptor);
      }
      return this.index = { descriptors, methods };
    }
  }
  function optional(parameter2) {
    return parameter2.source === "json" && parameter2.acceptsUndefined === true;
  }
  class NamedInput {
    parameters;
    strict;
    zod;
    schema;
    projection;
    constructor(parameters, strict, zod2) {
      this.parameters = parameters;
      this.strict = strict;
      this.zod = zod2;
    }
    codec(parameter2) {
      return this.strict ? parameter2.strictCodec : parameter2.codec;
    }
    create = () => this.schema ??= this.zod.strictObject(Object.fromEntries(this.parameters.map((parameter2) => {
      const value = this.codec(parameter2).create();
      return [parameter2.wire, optional(parameter2) ? value.optional() : value.nonoptional()];
    })));
    get jsonSchema() {
      return this.project().jsonSchema;
    }
    get jsonSchemaError() {
      return this.project().jsonSchemaError;
    }
    project() {
      if (this.projection !== void 0)
        return this.projection;
      const unavailable = this.parameters.find((parameter2) => this.codec(parameter2).jsonSchema === void 0);
      if (unavailable !== void 0) {
        return this.projection = { jsonSchemaError: this.codec(unavailable).jsonSchemaError ?? `No JSON Schema for parameter ${unavailable.wire}` };
      }
      return this.projection = {
        jsonSchema: {
          type: "object",
          properties: Object.fromEntries(this.parameters.map((parameter2) => [parameter2.wire, {
            ...this.codec(parameter2).jsonSchema,
            ...parameter2.description === void 0 ? {} : { description: parameter2.description }
          }])),
          required: this.parameters.filter((parameter2) => !optional(parameter2)).map((parameter2) => parameter2.wire),
          additionalProperties: false
        }
      };
    }
  }
  class ResultValue {
    spec;
    projection;
    constructor(spec2) {
      this.spec = spec2;
    }
    get mode() {
      return this.spec.mode;
    }
    get typeSymbol() {
      return this.spec.typeSymbol;
    }
    get create() {
      return this.spec.create;
    }
    get decode() {
      return this.spec.decode;
    }
    get encode() {
      return this.spec.encode;
    }
    get description() {
      return this.spec.description;
    }
    get jsonSchemaError() {
      return this.spec.jsonSchemaError;
    }
    get jsonSchema() {
      if (this.projection === void 0) {
        const schema = this.spec.jsonSchema;
        this.projection = { value: schema === void 0 ? void 0 : { ...schema, description: this.spec.description } };
      }
      return this.projection.value;
    }
  }
  function codec(typeSymbol, schema) {
    return { mode: "strict", typeSymbol, create: () => schema };
  }
  function parameter(name, schema) {
    const value = codec(`dsh-desktop-tools#desktopTools:${name}`, schema);
    return { name, source: "json", codec: value, strictCodec: value };
  }
  function method(name, parameters, result) {
    return {
      service: "desktopTools",
      invocation: { kind: "direct" },
      parameters,
      result: codec(`dsh-desktop-tools#desktopTools:${name}:result`, result)
    };
  }
  const json = zod.z.json();
  const spec = {
    package: "dsh-desktop-tools",
    methods: {
      "desktopTools/snapshot": method("snapshot", [], json),
      "desktopTools/update": method("update", [parameter("config", json)], json),
      "desktopTools/restart": method("restart", [], json),
      "desktopTools/installVision": method("installVision", [], json),
      "desktopTools/openCapture": method("openCapture", [parameter("mode", zod.z.enum(["image", "video", "long"]))], zod.z.object({ opened: zod.z.literal(true) })),
      "desktopTools/avatar": method("avatar", [], zod.z.object({ dataUrl: zod.z.string().optional() })),
      "desktopTools/setAvatar": method("setAvatar", [parameter("dataUrl", zod.z.string()), parameter("fileName", zod.z.string())], json),
      "desktopTools/restoreAvatar": method("restoreAvatar", [], json),
      "desktopTools/systemPermissions": method("systemPermissions", [], json),
      "desktopTools/openSystemPermission": method("openSystemPermission", [parameter("right", zod.z.enum(["screen", "accessibility"]))], json)
    }
  };
  const remote = createTypertRemoteInfo(spec, zod.z);
  const inject = ["slots", "locale", "remote"];
  async function apply(ctx) {
    const unmount = await ctx.remote.$mount(remote);
    const style = document.createElement("style");
    style.dataset.dshDesktopTools = "";
    style.textContent = desktopToolsCss;
    document.head.append(style);
    const namespace = "desktopTools";
    ctx.effect(() => ctx.locale.register(namespace, { en, zh }), "desktop-tools: dictionaries");
    const t = ctx.locale.bind(namespace);
    const services = {
      snapshot: () => ctx.remote.desktopTools.snapshot(),
      update: (config) => ctx.remote.desktopTools.update(config),
      restart: () => ctx.remote.desktopTools.restart(),
      avatar: () => ctx.remote.desktopTools.avatar(),
      setAvatar: (dataUrl, fileName) => ctx.remote.desktopTools.setAvatar(dataUrl, fileName),
      restoreAvatar: () => ctx.remote.desktopTools.restoreAvatar(),
      systemPermissions: () => ctx.remote.desktopTools.systemPermissions(),
      openSystemPermission: (right) => ctx.remote.desktopTools.openSystemPermission(right),
      installVision: () => ctx.remote.desktopTools.installVision(),
      openCapture: (mode) => ctx.remote.desktopTools.openCapture(mode)
    };
    const disposeSection = ctx.slots.inject("settings.section", () => ctx.slots.register({
      name: "settings.section",
      id: "desktop-tools",
      order: 40,
      label: () => t("title"),
      locale: namespace,
      inject: () => ({ services })
    }, DesktopToolsSettings));
    let disposed = false;
    const dispose = async () => {
      if (disposed) return;
      disposed = true;
      disposeSection();
      style.remove();
      await unmount();
    };
    ctx.effect(() => dispose, "desktop-tools: Client resources");
    return dispose;
  }
  exports.apply = apply;
  exports.inject = inject;
  return module.exports;
} });
