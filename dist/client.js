window.__ModuleLoader__.load({ id: "dsh-desktop-tools", factory: (require) => {
  "use strict";
  var module = { exports: {} };
  var exports = module.exports;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  const jsxRuntime = require("react/jsx-runtime");
  const react = require("react");
  const dshClientUiPrimitives = require("@deepseek-ai/dsh-client-ui-primitives");
  const zod = require("zod");
  const LANGUAGES = [
    ["en", "English"],
    ["简体中文", "简体中文"],
    ["繁體中文", "繁體中文"],
    ["日本語", "日本語"],
    ["한국어", "한국어"],
    ["Français", "Français"],
    ["Deutsch", "Deutsch"],
    ["Español", "Español"],
    ["Português", "Português"],
    ["Русский", "Русский"],
    ["العربية", "العربية"],
    ["हिन्दी", "हिन्दी"],
    ["Italiano", "Italiano"],
    ["Tiếng Việt", "Tiếng Việt"],
    ["ไทย", "ไทย"]
  ];
  const OTHER_LANGUAGE = "__other__";
  function languageChoice(value) {
    const normalized = value === "English" ? "en" : value === "zh" || value === "Chinese" || value === "中文" ? "简体中文" : value;
    return LANGUAGES.some(([key]) => key === normalized) ? normalized : OTHER_LANGUAGE;
  }
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
  const ROW_CLASS = "flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b-[0.5px] border-[var(--dsw-alias-border-l2)] py-4 last:border-b-0";
  const SELECTOR_CLASS = "inline-flex h-9 max-w-full min-w-0 cursor-pointer items-center gap-3 rounded-[var(--dsw-radius-md)] border-0 bg-[var(--dsw-alias-bg-module-platform)] px-3.5 text-sm leading-[22px] text-[var(--dsw-alias-label-primary)] hover:enabled:bg-[var(--dsw-alias-interactive-bg-hover)] disabled:cursor-default disabled:opacity-60";
  const INPUT_CLASS = "h-9 min-w-0 rounded-[var(--dsw-radius-md)] border-0 bg-[var(--dsw-alias-bg-module-platform)] px-3.5 text-sm leading-[22px] text-[var(--dsw-alias-label-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--dsw-alias-brand-primary)] disabled:opacity-60";
  const BUTTON_BASE = "inline-flex h-9 min-w-[58px] flex-none cursor-pointer items-center justify-center whitespace-nowrap rounded-[var(--dsw-radius-md)] border-[0.5px] border-solid px-3.5 text-sm leading-[22px] no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dsw-alias-state-business-primary)] disabled:cursor-default disabled:opacity-50";
  const BUTTON_CLASS = `${BUTTON_BASE} border-[var(--dsw-alias-border-l3)] bg-transparent text-[var(--dsw-alias-label-primary)] hover:enabled:bg-[var(--dsw-alias-interactive-bg-hover)]`;
  const PRIMARY_BUTTON_CLASS = `${BUTTON_BASE} border-transparent bg-[var(--dsw-alias-button-primary-fill)] font-medium text-[var(--dsw-alias-label-primary-foreground)] hover:enabled:bg-[var(--dsw-alias-button-primary-hover)]`;
  function Row({ title, description, children, alert }) {
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: ROW_CLASS, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex min-w-[220px] flex-1 basis-[220px] flex-col gap-1 pr-0 sm:pr-12", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-sm leading-[22px] text-[var(--dsw-alias-label-primary)]", children: title }),
        description !== void 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-xs leading-[18px] text-[var(--dsw-alias-label-tertiary)]", children: description }),
        alert !== void 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { role: "alert", className: "text-xs leading-[18px] text-[var(--dsw-alias-state-error-primary)]", children: alert })
      ] }),
      children !== void 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2", children })
    ] });
  }
  function Select({ value, options, onChange, disabled = false, label }) {
    const [open, setOpen] = react.useState(false);
    const current = options.find((option) => option.id === value);
    return /* @__PURE__ */ jsxRuntime.jsx(
      dshClientUiPrimitives.Menu,
      {
        open,
        onClose: () => setOpen(false),
        items: options,
        selectedId: value,
        onSelect: (id) => {
          setOpen(false);
          if (id !== value) onChange(id);
        },
        align: "end",
        portal: true,
        anchor: /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: SELECTOR_CLASS, "aria-haspopup": "menu", "aria-expanded": open, "aria-label": label, disabled: disabled || options.length === 0, onClick: () => setOpen((previous) => !previous), children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "min-w-0 truncate", children: current?.label ?? value }),
          /* @__PURE__ */ jsxRuntime.jsx(dshClientUiPrimitives.IconChevronDownOutlineRegular, { className: "flex-none" })
        ] })
      }
    );
  }
  function ModelRows({ heading, description, value, disabled, t, catalog, onChange }) {
    const title = heading ?? t("model");
    if (catalog === void 0 || catalog.groups.length === 0) {
      return /* @__PURE__ */ jsxRuntime.jsx(Row, { title, description, children: ["provider", "model", "reasoningEffort"].map((field) => /* @__PURE__ */ jsxRuntime.jsx(
        "input",
        {
          className: `${INPUT_CLASS} w-36`,
          disabled,
          "aria-label": t(field === "reasoningEffort" ? "effort" : field),
          placeholder: t(field === "reasoningEffort" ? "effort" : field),
          value: value[field] ?? "",
          onChange: (event) => onChange({ ...value, [field]: event.currentTarget.value })
        },
        field
      )) });
    }
    const group = catalog.groups.find((item) => item.id === value.provider);
    const model = group?.models.find((item) => item.id === value.model);
    const efforts = model?.reasoning?.efforts ?? [];
    const pickModel = (providerId, modelId) => {
      const nextGroup = catalog.groups.find((item) => item.id === providerId);
      const nextModel = nextGroup?.models.find((item) => item.id === modelId) ?? nextGroup?.models[0];
      if (nextGroup === void 0 || nextModel === void 0) return;
      const nextEfforts = nextModel.reasoning?.efforts ?? [];
      const effort = nextEfforts.some((item) => item.id === value.reasoningEffort) ? value.reasoningEffort : nextModel.reasoning?.defaultEffort ?? nextEfforts[0]?.id;
      onChange({ provider: nextGroup.id, model: nextModel.id, ...effort === void 0 ? {} : { reasoningEffort: effort } });
    };
    const unavailable = (label) => `${label}（${t("modelUnavailable")}）`;
    const providerOptions = [...group === void 0 ? [{ id: value.provider, label: unavailable(value.provider) }] : [], ...catalog.groups.map((item) => ({ id: item.id, label: item.name }))];
    const modelOptions = [...model === void 0 ? [{ id: value.model, label: unavailable(value.model) }] : [], ...group?.models.map((item) => ({ id: item.id, label: item.name })) ?? []];
    const effortOptions = efforts.length === 0 ? [{ id: "", label: t("effortNone") }] : [...value.reasoningEffort !== void 0 && !efforts.some((item) => item.id === value.reasoningEffort) ? [{ id: value.reasoningEffort, label: unavailable(value.reasoningEffort) }] : [], ...efforts.map((item) => ({ id: item.id, label: item.name }))];
    return /* @__PURE__ */ jsxRuntime.jsxs(Row, { title, description: description ?? `${t("provider")} / ${t("model")} / ${t("effort")}`, children: [
      /* @__PURE__ */ jsxRuntime.jsx(Select, { label: t("provider"), value: value.provider, options: providerOptions, disabled, onChange: (id) => pickModel(id, void 0) }),
      /* @__PURE__ */ jsxRuntime.jsx(Select, { label: t("model"), value: value.model, options: modelOptions, disabled: disabled || group === void 0, onChange: (id) => pickModel(value.provider, id) }),
      /* @__PURE__ */ jsxRuntime.jsx(
        Select,
        {
          label: t("effort"),
          value: value.reasoningEffort ?? "",
          options: effortOptions,
          disabled: disabled || efforts.length === 0,
          onChange: (effort) => {
            const { reasoningEffort: _effort, ...rest } = value;
            onChange(effort === "" ? rest : { ...rest, reasoningEffort: effort });
          }
        }
      )
    ] });
  }
  function DesktopToolsSettings({ t, services }) {
    const [tab, setTab] = react.useState("selection");
    const [snapshot, setSnapshot] = react.useState();
    const [draft, setDraft] = react.useState();
    const [avatar, setAvatar] = react.useState();
    const [defaultAvatar, setDefaultAvatar] = react.useState();
    const [catalog, setCatalog] = react.useState();
    const [customLanguage, setCustomLanguage] = react.useState(false);
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
      setCustomLanguage(languageChoice(result.value.config.selection.targetLanguage) === OTHER_LANGUAGE);
      const image = await services.avatar();
      if (image.ok) {
        setAvatar(image.value.dataUrl);
        setDefaultAvatar(image.value.defaultDataUrl);
      }
      void services.modelCatalog().then(setCatalog, () => {
        setCatalog(void 0);
      });
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
    if (draft === void 0) return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "flex min-w-0 flex-col gap-3 text-[var(--dsw-alias-label-primary)]", "aria-busy": "true", children: [
      /* @__PURE__ */ jsxRuntime.jsx("h2", { className: "m-0 text-lg font-semibold", children: t("title") }),
      message ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsx("p", { role: "alert", className: "m-0 text-sm text-[var(--dsw-alias-state-error-primary)]", children: message }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: `${BUTTON_CLASS} w-fit`, onClick: () => {
          void load();
        }, children: t("retryLoad") })
      ] }) : /* @__PURE__ */ jsxRuntime.jsx("p", { role: "status", className: "m-0 text-[13px] text-[var(--dsw-alias-label-tertiary)]", children: t("loading") })
    ] });
    const enableKey = tab === "selection" ? "enableSelection" : tab === "floating" ? "enableFloating" : tab === "screenshot" ? "enableScreenshot" : "enableRecording";
    const languageOptions = [...LANGUAGES.map(([id, label]) => ({ id, label })), { id: OTHER_LANGUAGE, label: t("otherLanguage") }];
    const permissionText = (right) => permissions?.[right] === true ? t("permissionGranted") : permissions?.[right] === false ? t("permissionDenied") : t("permissionUnknown");
    const shortcutRow = (field) => /* @__PURE__ */ jsxRuntime.jsxs(
      Row,
      {
        title: t(field === "screenshot.longShortcut" ? "longShortcut" : "shortcut"),
        description: capturing === field ? t("recordingShortcut") : t("shortcutDescription"),
        children: [
          /* @__PURE__ */ jsxRuntime.jsx("kbd", { className: "inline-flex h-9 min-w-[58px] items-center justify-center rounded-[var(--dsw-radius-md)] bg-[var(--dsw-alias-bg-module-platform)] px-3 font-[inherit] text-sm", children: acceleratorLabel(shortcutValue(field), snapshot?.platform) }),
          /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: BUTTON_CLASS, onClick: () => setCapturing(capturing === field ? void 0 : field), children: capturing === field ? t("cancelRecording") : t("recordShortcut") }),
          shortcutValue(field) !== "" && /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: BUTTON_CLASS, onClick: () => setShortcut(field, ""), children: t("clearShortcut") }),
          /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: BUTTON_CLASS, disabled: active?.phase !== "active", onClick: () => {
            void services.openCapture(field === "recording.shortcut" ? "video" : field === "screenshot.longShortcut" ? "long" : "image");
          }, children: t("tryNow") })
        ]
      },
      field
    );
    return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "flex min-w-0 flex-col gap-3 text-[var(--dsw-alias-label-primary)]", "aria-busy": busy, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex min-w-0 flex-col gap-1", children: [
        /* @__PURE__ */ jsxRuntime.jsx("h2", { className: "m-0 text-lg font-semibold", children: t("title") }),
        /* @__PURE__ */ jsxRuntime.jsxs("p", { className: "m-0 text-[13px] text-[var(--dsw-alias-label-tertiary)]", children: [
          t("intro"),
          " · ",
          snapshot?.runtime === "running" ? t("runtimeRunning") : snapshot?.runtime === "degraded" ? t("runtimeDegraded") : t("runtimeStopped")
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { role: "tablist", "aria-label": t("title"), className: "mt-0.5 flex flex-wrap items-end gap-x-[22px] border-b-[0.5px] border-[var(--dsw-alias-border-l2)]", children: tabs.map((item, index) => /* @__PURE__ */ jsxRuntime.jsx(
        "button",
        {
          id: `desktop-tools-tab-${item}`,
          type: "button",
          role: "tab",
          "aria-selected": tab === item,
          "aria-controls": "desktop-tools-panel",
          tabIndex: tab === item ? 0 : -1,
          "data-active": tab === item ? "true" : void 0,
          onClick: () => setTab(item),
          onKeyDown: (event) => {
            const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length : void 0;
            if (next === void 0) return;
            event.preventDefault();
            setTab(tabs[next]);
            document.getElementById(`desktop-tools-tab-${tabs[next]}`)?.focus();
          },
          className: "relative flex-none cursor-pointer border-0 bg-transparent px-px pb-[9px] pt-[7px] font-[inherit] text-[13px] leading-5 text-[var(--dsw-alias-label-tertiary)] hover:text-[var(--dsw-alias-label-primary)] focus-visible:rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dsw-alias-state-business-primary)] data-[active=true]:text-[var(--dsw-alias-label-primary)] data-[active=true]:after:absolute data-[active=true]:after:inset-x-0 data-[active=true]:after:-bottom-px data-[active=true]:after:h-0.5 data-[active=true]:after:rounded-t-[2px] data-[active=true]:after:bg-[var(--dsw-alias-label-primary)] data-[active=true]:after:content-['']",
          children: t(item)
        },
        item
      )) }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { id: "desktop-tools-panel", role: "tabpanel", "aria-labelledby": `desktop-tools-tab-${tab}`, className: "flex min-w-0 flex-col pt-0.5", children: [
        /* @__PURE__ */ jsxRuntime.jsx(Row, { title: t(enableKey), description: enabled ? statusLabel(active?.phase ?? "disabled", t) : t("featureDisabled"), alert: active?.phase === "error" && active.error ? active.error : void 0, children: /* @__PURE__ */ jsxRuntime.jsx(dshClientUiPrimitives.Switch, { checked: enabled, disabled: busy, label: t(enableKey), onChange: (next) => setFeature(tab, next) }) }),
        tab === "selection" && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          /* @__PURE__ */ jsxRuntime.jsxs(Row, { title: t("language"), description: t("languageDescription"), children: [
            customLanguage && /* @__PURE__ */ jsxRuntime.jsx(
              "input",
              {
                className: `${INPUT_CLASS} w-40`,
                "aria-label": t("otherLanguage"),
                placeholder: t("otherLanguagePlaceholder"),
                maxLength: 80,
                value: languageChoice(draft.selection.targetLanguage) === OTHER_LANGUAGE ? draft.selection.targetLanguage : "",
                onChange: (event) => setDraft({ ...draft, selection: { ...draft.selection, targetLanguage: event.currentTarget.value } })
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx(
              Select,
              {
                label: t("language"),
                value: customLanguage ? OTHER_LANGUAGE : languageChoice(draft.selection.targetLanguage),
                options: languageOptions,
                onChange: (value) => {
                  setCustomLanguage(value === OTHER_LANGUAGE);
                  if (value !== OTHER_LANGUAGE) setDraft({ ...draft, selection: { ...draft.selection, targetLanguage: value } });
                }
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx(Row, { title: t("compatibilityCopy"), description: t("compatibilityCopyDescription"), children: /* @__PURE__ */ jsxRuntime.jsx(dshClientUiPrimitives.Switch, { checked: draft.selection.compatibilityCopy, disabled: busy, label: t("compatibilityCopy"), onChange: (next) => setDraft({ ...draft, selection: { ...draft.selection, compatibilityCopy: next } }) }) }),
          /* @__PURE__ */ jsxRuntime.jsx(Row, { title: t("customModel"), description: draft.selection.model === void 0 ? t("followSession") : t("customModelDescription"), children: /* @__PURE__ */ jsxRuntime.jsx(dshClientUiPrimitives.Switch, { checked: draft.selection.model !== void 0, disabled: busy, label: t("customModel"), onChange: setSelectionModelEnabled }) }),
          draft.selection.model !== void 0 && /* @__PURE__ */ jsxRuntime.jsx(ModelRows, { value: draft.selection.model, disabled: busy, t, catalog, onChange: (value) => setModel("selection", value) })
        ] }),
        tab === "floating" && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          /* @__PURE__ */ jsxRuntime.jsxs(Row, { title: t("avatar"), description: avatar === void 0 && defaultAvatar !== void 0 ? `${t("avatarDescription")} ${t("defaultAvatar")}` : t("avatarDescription"), children: [
            (avatar ?? defaultAvatar) === void 0 ? /* @__PURE__ */ jsxRuntime.jsx("span", { "aria-hidden": "true", className: "size-9 rounded-[var(--dsw-radius-md)] bg-[var(--dsw-alias-bg-module-platform)]" }) : /* @__PURE__ */ jsxRuntime.jsx("img", { src: avatar ?? defaultAvatar, alt: t("avatar"), className: "size-9 rounded-[var(--dsw-radius-md)] object-cover" }),
            /* @__PURE__ */ jsxRuntime.jsxs("label", { className: `${BUTTON_CLASS} focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--dsw-alias-state-business-primary)]`, children: [
              t("chooseAvatar"),
              /* @__PURE__ */ jsxRuntime.jsx("input", { className: "sr-only", type: "file", accept: "image/gif,image/png,image/webp", onChange: uploadAvatar })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: BUTTON_CLASS, onClick: () => {
              void services.restoreAvatar().then((result) => {
                if (result.ok) void load();
              });
            }, children: t("restoreAvatar") })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx(ModelRows, { heading: t("conversationModel"), description: t("conversationModelDescription"), value: draft.floatingBall.conversationModel, disabled: busy, t, catalog, onChange: (value) => setModel("conversationModel", value) }),
          /* @__PURE__ */ jsxRuntime.jsx(ModelRows, { heading: t("backgroundModel"), description: t("backgroundModelDescription"), value: draft.floatingBall.backgroundModel, disabled: busy, t, catalog, onChange: (value) => setModel("backgroundModel", value) }),
          /* @__PURE__ */ jsxRuntime.jsx(Row, { title: t("permissionPreset"), description: t("permissionPresetDescription"), children: /* @__PURE__ */ jsxRuntime.jsx(
            Select,
            {
              label: t("permissionPreset"),
              value: draft.floatingBall.permissionPreset,
              disabled: busy,
              options: [{ id: "read-only", label: "read-only" }, { id: "workspace-write", label: "workspace-write" }, { id: "danger-full-access", label: "danger-full-access" }],
              onChange: (value) => setDraft({ ...draft, floatingBall: { ...draft.floatingBall, permissionPreset: value } })
            }
          ) }),
          /* @__PURE__ */ jsxRuntime.jsx(Row, { title: t("coordinateMode"), description: t("coordinateModeDescription"), children: /* @__PURE__ */ jsxRuntime.jsx(
            Select,
            {
              label: t("coordinateMode"),
              value: draft.floatingBall.coordinateMode,
              disabled: busy,
              options: [{ id: "millifraction", label: "millifraction" }, { id: "pixel", label: "pixel" }],
              onChange: (value) => setDraft({ ...draft, floatingBall: { ...draft.floatingBall, coordinateMode: value } })
            }
          ) }),
          /* @__PURE__ */ jsxRuntime.jsx(Row, { title: t("systemPermissions"), description: t("systemPermissionsDescription"), children: /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: BUTTON_CLASS, onClick: () => {
            void checkPermissions();
          }, children: t("check") }) }),
          ["screen", "accessibility"].map((right) => /* @__PURE__ */ jsxRuntime.jsx(Row, { title: t(right === "screen" ? "screenPermission" : "accessibilityPermission"), description: permissionText(right), children: /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: BUTTON_CLASS, onClick: () => {
            void services.openSystemPermission(right).then(() => {
              void checkPermissions();
            });
          }, children: t("openSettings") }) }, right))
        ] }),
        tab === "screenshot" && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          shortcutRow("screenshot.shortcut"),
          shortcutRow("screenshot.longShortcut"),
          /* @__PURE__ */ jsxRuntime.jsx(Row, { title: t("visionTitle"), description: /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
            t("visionDescription"),
            /* @__PURE__ */ jsxRuntime.jsx("br", {}),
            t(snapshot?.vision.state === "ready" ? "visionStateReady" : snapshot?.vision.state === "missing" ? "visionStateMissing" : snapshot?.vision.state === "disabled" ? "visionStateDisabled" : snapshot?.vision.state === "tool-off" ? "visionStateToolOff" : "visionStateUnknown")
          ] }), children: snapshot?.vision.state !== "ready" && snapshot?.vision.state !== "tool-off" && /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", disabled: installing, className: PRIMARY_BUTTON_CLASS, onClick: () => {
            void installVision();
          }, children: installing ? t("visionInstalling") : snapshot?.vision.state === "disabled" ? t("visionEnable") : t("visionInstall") }) })
        ] }),
        tab === "recording" && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          shortcutRow("recording.shortcut"),
          /* @__PURE__ */ jsxRuntime.jsx(Row, { title: t("recordingFormat"), description: t("recordingFormatDescription"), children: /* @__PURE__ */ jsxRuntime.jsx(
            Select,
            {
              label: t("recordingFormat"),
              value: draft.recording.format,
              disabled: busy,
              options: [{ id: "mp4", label: "MP4" }, { id: "gif", label: "GIF" }, { id: "webm", label: "WebM" }],
              onChange: (value) => setDraft({ ...draft, recording: { ...draft.recording, format: value } })
            }
          ) }),
          /* @__PURE__ */ jsxRuntime.jsx(Row, { title: t("recordingQuality"), description: t("recordingQualityDescription"), children: /* @__PURE__ */ jsxRuntime.jsx(
            Select,
            {
              label: t("recordingQuality"),
              value: draft.recording.quality,
              disabled: busy,
              options: [{ id: "sd", label: t("qualitySd") }, { id: "hd", label: t("qualityHd") }, { id: "original", label: t("qualityOriginal") }],
              onChange: (value) => setDraft({ ...draft, recording: { ...draft.recording, quality: value } })
            }
          ) }),
          ["systemAudio", "microphone", "knowledgeGraph"].map((field) => {
            const label = t(field === "systemAudio" ? "recordingSystemAudio" : field === "microphone" ? "recordingMicrophone" : "recordingGraph");
            return /* @__PURE__ */ jsxRuntime.jsx(Row, { title: label, description: field === "knowledgeGraph" ? t("recordingGraphHint") : void 0, children: /* @__PURE__ */ jsxRuntime.jsx(
              dshClientUiPrimitives.Switch,
              {
                checked: draft.recording[field],
                disabled: busy || field === "systemAudio" && snapshot?.platform === "linux",
                label,
                onChange: (next) => setDraft({ ...draft, recording: { ...draft.recording, [field]: next } })
              }
            ) }, field);
          })
        ] })
      ] }),
      message && /* @__PURE__ */ jsxRuntime.jsx("p", { role: "status", className: message === t("saved") ? "m-0 text-[13px] text-[var(--dsw-alias-state-success-primary)]" : "m-0 text-[13px] text-[var(--dsw-alias-state-error-primary)]", children: message }),
      /* @__PURE__ */ jsxRuntime.jsxs("footer", { className: "flex flex-wrap justify-end gap-2 border-t-[0.5px] border-[var(--dsw-alias-border-l2)] pt-4", children: [
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", disabled: busy, className: BUTTON_CLASS, onClick: () => {
          void load();
        }, children: t("check") }),
        pending && /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", disabled: busy, className: BUTTON_CLASS, onClick: () => {
          void retry();
        }, children: t("retry") }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", disabled: busy, className: PRIMARY_BUTTON_CLASS, onClick: () => {
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
    intro: "Selection toolbar, floating assistant, screenshot and screen recording that work across the whole system.",
    enableSelection: "Enable selection toolbar",
    enableFloating: "Enable floating assistant",
    enableScreenshot: "Enable screenshot",
    enableRecording: "Enable screen recording",
    languageDescription: "Language used by translate and explain on selected text.",
    compatibilityCopyDescription: "Also writes the selection to the clipboard, for apps whose selection cannot be read directly.",
    customModelDescription: "Use the model below for the selection toolbar instead of the current session model.",
    avatarDescription: "Image shown on the floating ball. GIF, PNG or WebP.",
    conversationModelDescription: "Model used when chatting with the floating assistant.",
    backgroundModelDescription: "Model used for background work such as recognizing and summarizing screenshots.",
    permissionPresetDescription: "Tool permissions for floating assistant sessions.",
    coordinateModeDescription: "How screen positions are expressed when the assistant operates the screen.",
    systemPermissionsDescription: "Operating the screen needs these system permissions.",
    shortcutDescription: "Works system-wide, even when DSH is in the background. Save to apply.",
    recordingFormatDescription: "Format selected when a new recording starts.",
    recordingQualityDescription: "Resolution selected when a new recording starts.",
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
    cancelRecording: "Cancel",
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
    recordingGraphHint: "The knowledge graph recognizes text in key frames with dsh-vision-router; speech is not transcribed. GIF recordings have no sound.",
    otherLanguage: "Other language…",
    otherLanguagePlaceholder: "Type a target language",
    modelUnavailable: "unavailable",
    effortNone: "Not supported",
    defaultAvatar: "Default avatar"
  };
  const zh = {
    title: "桌面工具",
    selection: "划词工具栏",
    floating: "悬浮球",
    screenshot: "截图",
    recording: "录屏",
    intro: "在整个系统里使用的划词工具栏、悬浮球、截图与录屏。",
    enableSelection: "启用划词工具栏",
    enableFloating: "启用悬浮球",
    enableScreenshot: "启用截图",
    enableRecording: "启用录屏",
    languageDescription: "划词翻译、解释时使用的目标语言。",
    compatibilityCopyDescription: "同时把选中的文字写入剪贴板，兼容无法直接读取选区的应用。",
    customModelDescription: "划词工具栏改用下面选定的模型，不跟随当前会话。",
    avatarDescription: "悬浮球上显示的图片，支持 GIF、PNG、WebP。",
    conversationModelDescription: "与悬浮球对话时使用的模型。",
    backgroundModelDescription: "识别、总结截图等后台任务使用的模型。",
    permissionPresetDescription: "悬浮球会话可使用的工具权限。",
    coordinateModeDescription: "悬浮球操作屏幕时表示位置的方式。",
    systemPermissionsDescription: "悬浮球操作屏幕需要以下系统授权。",
    shortcutDescription: "系统级快捷键，DSH 在后台时同样可以唤起。保存后生效。",
    recordingFormatDescription: "开始新录制时默认选中的格式。",
    recordingQualityDescription: "开始新录制时默认选中的清晰度。",
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
    cancelRecording: "取消",
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
    recordingGraphHint: "知识图谱通过 dsh-vision-router 识别关键帧中的文字生成，不转写语音。GIF 不含声音。",
    otherLanguage: "其他语言…",
    otherLanguagePlaceholder: "输入目标语言",
    modelUnavailable: "当前不可用",
    effortNone: "不支持",
    defaultAvatar: "默认头像"
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
  .m-0 {
    margin: 0px;
  }
  .mt-0 {
    margin-top: 0px;
  }
  .mt-0\\.5 {
    margin-top: calc(var(--spacing) * 0.5);
  }
  .ml-auto {
    margin-left: auto;
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
  .inline-flex {
    display: inline-flex;
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
  .size-9 {
    width: calc(var(--spacing) * 9);
    height: calc(var(--spacing) * 9);
  }
  .size-12 {
    width: calc(var(--spacing) * 12);
    height: calc(var(--spacing) * 12);
  }
  .h-9 {
    height: calc(var(--spacing) * 9);
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
  .w-36 {
    width: calc(var(--spacing) * 36);
  }
  .w-40 {
    width: calc(var(--spacing) * 40);
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
  .min-w-\\[58px\\] {
    min-width: 58px;
  }
  .min-w-\\[220px\\] {
    min-width: 220px;
  }
  .flex-1 {
    flex: 1;
  }
  .flex-none {
    flex: none;
  }
  .flex-grow {
    flex-grow: 1;
  }
  .grow {
    flex-grow: 1;
  }
  .basis-\\[220px\\] {
    flex-basis: 220px;
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
  .flex-col {
    flex-direction: column;
  }
  .flex-wrap {
    flex-wrap: wrap;
  }
  .items-center {
    align-items: center;
  }
  .items-end {
    align-items: flex-end;
  }
  .justify-between {
    justify-content: space-between;
  }
  .justify-center {
    justify-content: center;
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
  .gap-6 {
    gap: calc(var(--spacing) * 6);
  }
  .gap-x-6 {
    column-gap: calc(var(--spacing) * 6);
  }
  .gap-x-\\[22px\\] {
    column-gap: 22px;
  }
  .gap-y-3 {
    row-gap: calc(var(--spacing) * 3);
  }
  .truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .overflow-x-auto {
    overflow-x: auto;
  }
  .rounded {
    border-radius: 0.25rem;
  }
  .rounded-\\[var\\(--dsw-radius-md\\)\\] {
    border-radius: var(--dsw-radius-md);
  }
  .border {
    border-style: var(--tw-border-style);
    border-width: 1px;
  }
  .border-0 {
    border-style: var(--tw-border-style);
    border-width: 0px;
  }
  .border-\\[0\\.5px\\] {
    border-style: var(--tw-border-style);
    border-width: 0.5px;
  }
  .border-t {
    border-top-style: var(--tw-border-style);
    border-top-width: 1px;
  }
  .border-t-\\[0\\.5px\\] {
    border-top-style: var(--tw-border-style);
    border-top-width: 0.5px;
  }
  .border-b {
    border-bottom-style: var(--tw-border-style);
    border-bottom-width: 1px;
  }
  .border-b-2 {
    border-bottom-style: var(--tw-border-style);
    border-bottom-width: 2px;
  }
  .border-b-\\[0\\.5px\\] {
    border-bottom-style: var(--tw-border-style);
    border-bottom-width: 0.5px;
  }
  .border-solid {
    --tw-border-style: solid;
    border-style: solid;
  }
  .border-\\[var\\(--dsw-alias-border-l2\\)\\] {
    border-color: var(--dsw-alias-border-l2);
  }
  .border-\\[var\\(--dsw-alias-border-l3\\)\\] {
    border-color: var(--dsw-alias-border-l3);
  }
  .border-transparent {
    border-color: transparent;
  }
  .bg-\\[var\\(--dsw-alias-bg-module-platform\\)\\] {
    background-color: var(--dsw-alias-bg-module-platform);
  }
  .bg-\\[var\\(--dsw-alias-button-primary-fill\\)\\] {
    background-color: var(--dsw-alias-button-primary-fill);
  }
  .bg-transparent {
    background-color: transparent;
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
  .px-3\\.5 {
    padding-inline: calc(var(--spacing) * 3.5);
  }
  .px-px {
    padding-inline: 1px;
  }
  .py-1 {
    padding-block: var(--spacing);
  }
  .py-2 {
    padding-block: calc(var(--spacing) * 2);
  }
  .py-4 {
    padding-block: calc(var(--spacing) * 4);
  }
  .pt-0 {
    padding-top: 0px;
  }
  .pt-0\\.5 {
    padding-top: calc(var(--spacing) * 0.5);
  }
  .pt-3 {
    padding-top: calc(var(--spacing) * 3);
  }
  .pt-4 {
    padding-top: calc(var(--spacing) * 4);
  }
  .pt-\\[7px\\] {
    padding-top: 7px;
  }
  .pr-0 {
    padding-right: 0px;
  }
  .pb-\\[9px\\] {
    padding-bottom: 9px;
  }
  .font-\\[inherit\\] {
    font-family: inherit;
  }
  .text-base {
    font-size: var(--text-base);
    line-height: var(--tw-leading, var(--text-base--line-height));
  }
  .text-lg {
    font-size: var(--text-lg);
    line-height: var(--tw-leading, var(--text-lg--line-height));
  }
  .text-sm {
    font-size: var(--text-sm);
    line-height: var(--tw-leading, var(--text-sm--line-height));
  }
  .text-xs {
    font-size: var(--text-xs);
    line-height: var(--tw-leading, var(--text-xs--line-height));
  }
  .text-\\[13px\\] {
    font-size: 13px;
  }
  .leading-5 {
    --tw-leading: calc(var(--spacing) * 5);
    line-height: calc(var(--spacing) * 5);
  }
  .leading-\\[18px\\] {
    --tw-leading: 18px;
    line-height: 18px;
  }
  .leading-\\[22px\\] {
    --tw-leading: 22px;
    line-height: 22px;
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
  .whitespace-nowrap {
    white-space: nowrap;
  }
  .text-\\[var\\(--dsw-alias-label-primary\\)\\] {
    color: var(--dsw-alias-label-primary);
  }
  .text-\\[var\\(--dsw-alias-label-primary-foreground\\)\\] {
    color: var(--dsw-alias-label-primary-foreground);
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
  .no-underline {
    text-decoration-line: none;
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
  .last\\:border-b-0:last-child {
    border-bottom-style: var(--tw-border-style);
    border-bottom-width: 0px;
  }
  .focus-within\\:outline-2:focus-within {
    outline-style: var(--tw-outline-style);
    outline-width: 2px;
  }
  .focus-within\\:outline-offset-2:focus-within {
    outline-offset: 2px;
  }
  .focus-within\\:outline-\\[var\\(--dsw-alias-state-business-primary\\)\\]:focus-within {
    outline-color: var(--dsw-alias-state-business-primary);
  }
  @media (hover: hover) {
    .hover\\:text-\\[var\\(--dsw-alias-label-primary\\)\\]:hover {
      color: var(--dsw-alias-label-primary);
    }
  }
  .focus-visible\\:rounded-\\[2px\\]:focus-visible {
    border-radius: 2px;
  }
  .focus-visible\\:ring-2:focus-visible {
    --tw-ring-shadow: var(--tw-ring-inset, ) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }
  .focus-visible\\:ring-\\[var\\(--dsw-alias-brand-primary\\)\\]:focus-visible {
    --tw-ring-color: var(--dsw-alias-brand-primary);
  }
  .focus-visible\\:outline-2:focus-visible {
    outline-style: var(--tw-outline-style);
    outline-width: 2px;
  }
  .focus-visible\\:outline-offset-2:focus-visible {
    outline-offset: 2px;
  }
  .focus-visible\\:outline-\\[var\\(--dsw-alias-state-business-primary\\)\\]:focus-visible {
    outline-color: var(--dsw-alias-state-business-primary);
  }
  @media (hover: hover) {
    .hover\\:enabled\\:bg-\\[var\\(--dsw-alias-button-primary-hover\\)\\]:hover:enabled {
      background-color: var(--dsw-alias-button-primary-hover);
    }
    .hover\\:enabled\\:bg-\\[var\\(--dsw-alias-interactive-bg-hover\\)\\]:hover:enabled {
      background-color: var(--dsw-alias-interactive-bg-hover);
    }
  }
  .disabled\\:cursor-default:disabled {
    cursor: default;
  }
  .disabled\\:opacity-50:disabled {
    opacity: 50%;
  }
  .disabled\\:opacity-60:disabled {
    opacity: 60%;
  }
  .data-\\[active\\=true\\]\\:text-\\[var\\(--dsw-alias-label-primary\\)\\][data-active="true"] {
    color: var(--dsw-alias-label-primary);
  }
  .data-\\[active\\=true\\]\\:after\\:absolute[data-active="true"]::after {
    content: var(--tw-content);
    position: absolute;
  }
  .data-\\[active\\=true\\]\\:after\\:inset-x-0[data-active="true"]::after {
    content: var(--tw-content);
    inset-inline: 0px;
  }
  .data-\\[active\\=true\\]\\:after\\:-bottom-px[data-active="true"]::after {
    content: var(--tw-content);
    bottom: -1px;
  }
  .data-\\[active\\=true\\]\\:after\\:h-0\\.5[data-active="true"]::after {
    content: var(--tw-content);
    height: calc(var(--spacing) * 0.5);
  }
  .data-\\[active\\=true\\]\\:after\\:rounded-t-\\[2px\\][data-active="true"]::after {
    content: var(--tw-content);
    border-top-left-radius: 2px;
    border-top-right-radius: 2px;
  }
  .data-\\[active\\=true\\]\\:after\\:bg-\\[var\\(--dsw-alias-label-primary\\)\\][data-active="true"]::after {
    content: var(--tw-content);
    background-color: var(--dsw-alias-label-primary);
  }
  .data-\\[active\\=true\\]\\:after\\:content-\\[\\'\\'\\][data-active="true"]::after {
    --tw-content: '';
    content: var(--tw-content);
  }
  @media (width >= 40rem) {
    .sm\\:pr-12 {
      padding-right: calc(var(--spacing) * 12);
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
@property --tw-leading {
  syntax: "*";
  inherits: false;
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
@property --tw-content {
  syntax: "*";
  initial-value: "";
  inherits: false;
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
      --tw-leading: initial;
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
      --tw-content: "";
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
      "desktopTools/avatar": method("avatar", [], zod.z.object({ dataUrl: zod.z.string().optional(), defaultDataUrl: zod.z.string().optional() })),
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
    let sessionRemote;
    const sessionScope = ctx.inject(["remote.session"], (scope) => {
      sessionRemote = scope.remote.session;
      scope.effect(() => () => {
        sessionRemote = void 0;
      }, "desktop-tools: model catalog");
    });
    const section = ctx.inject(["remote.desktopTools"], (inner) => {
      const tools = () => inner.remote.desktopTools;
      const services = {
        snapshot: () => tools().snapshot(),
        update: (config) => tools().update(config),
        restart: () => tools().restart(),
        avatar: () => tools().avatar(),
        setAvatar: (dataUrl, fileName) => tools().setAvatar(dataUrl, fileName),
        restoreAvatar: () => tools().restoreAvatar(),
        systemPermissions: () => tools().systemPermissions(),
        openSystemPermission: (right) => tools().openSystemPermission(right),
        installVision: () => tools().installVision(),
        openCapture: (mode) => tools().openCapture(mode),
        async modelCatalog() {
          if (sessionRemote === void 0) return void 0;
          const result = await sessionRemote.modelCatalog();
          return result.ok ? result.value : void 0;
        }
      };
      inner.effect(() => inner.slots.inject("settings.section", () => inner.slots.register({
        name: "settings.section",
        id: "desktop-tools",
        order: 40,
        label: () => t("title"),
        locale: namespace,
        inject: () => ({ services })
      }, DesktopToolsSettings)), "desktop-tools: settings section");
    });
    try {
      await section;
    } catch (error) {
      await section.dispose();
      style.remove();
      await unmount();
      throw error;
    }
    let disposed = false;
    const dispose = async () => {
      if (disposed) return;
      disposed = true;
      await section.dispose();
      await sessionScope.dispose();
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
