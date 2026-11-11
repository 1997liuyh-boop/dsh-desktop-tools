/** 桌面工具设置页的中英文文案。 */
export const en = {
  title: 'Desktop tools', selection: 'Selection toolbar', floating: 'Floating assistant', screenshot: 'Screenshot', recording: 'Screen recording',
  enabled: 'Enabled', language: 'Target language', compatibilityCopy: 'Copy selected text to clipboard', followSession: 'Follow the current session', customModel: 'Use a fixed model', model: 'Model', provider: 'Provider', effort: 'Reasoning effort',
  conversationModel: 'Conversation model', backgroundModel: 'Background model', permissionPreset: 'Permission preset', coordinateMode: 'Coordinate mode',
  avatar: 'Avatar', chooseAvatar: 'Choose image', restoreAvatar: 'Restore default', systemPermissions: 'System permissions', screenPermission: 'Screen recording', accessibilityPermission: 'Accessibility', check: 'Check', openSettings: 'Open system settings',
  shortcut: 'Shortcut', recordShortcut: 'Record shortcut', recordingShortcut: 'Press a key combination. Escape cancels.',
  save: 'Save', saving: 'Saving…', retry: 'Retry apply', saved: 'Saved and applied', pending: 'Saved, not yet applied', loadError: 'Could not load desktop tools settings.', saveError: 'Could not save desktop tools settings.',
  noRuntime: 'Available only in DSH Desktop.', runtimeStopped: 'Helper is stopped', runtimeRunning: 'Helper is running', runtimeDegraded: 'Some tools need attention',
  featureDisabled: 'Disabled', featureStarting: 'Starting', featureActive: 'Running', featureError: 'Error', permissionGranted: 'Granted', permissionDenied: 'Not granted', permissionUnknown: 'Unknown',
  longShortcut: 'Long screenshot shortcut', clearShortcut: 'Clear', tryNow: 'Try now', shortcutInvalid: 'Use at least one modifier key (Ctrl/⌘, Alt or Shift) with a letter, number or function key.',
  globalShortcutHint: 'Shortcuts work system-wide, even when DSH is in the background. Save to apply.',
  visionTitle: 'Prerequisite: dsh-vision-router', visionDescription: 'Extract text, Translate and Knowledge graph on screenshots use the OCR tools of the dsh-vision-router plugin. Other tools work without it.',
  visionInstall: 'Install dsh-vision-router', visionEnable: 'Enable dsh-vision-router', visionInstalling: 'Installing dsh-vision-router…', visionInstallFailed: 'Could not install dsh-vision-router. Check the plugin manager.',
  visionRestart: 'dsh-vision-router is installed. Restart DSH to finish enabling it.', visionReady: 'dsh-vision-router is ready.',
  visionStateReady: 'Ready', visionStateMissing: 'Not installed', visionStateDisabled: 'Installed, disabled', visionStateToolOff: 'Installed, vision tools off', visionStateUnknown: 'Unknown',
  recordingFormat: 'Default format', recordingQuality: 'Default quality', qualitySd: 'SD 720p', qualityHd: 'HD 1080p', qualityOriginal: 'Original',
  recordingSystemAudio: 'Record system sound by default', recordingMicrophone: 'Record microphone by default', recordingGraph: 'Generate a knowledge graph after recording by default',
  recordingGraphHint: 'The knowledge graph recognizes text in key frames with dsh-vision-router; speech is not transcribed. GIF recordings have no sound.',
} as const

export const zh = {
  title: '桌面工具', selection: '划词工具栏', floating: '悬浮球', screenshot: '截图', recording: '录屏',
  enabled: '启用', language: '目标语言', compatibilityCopy: '将所选文本复制到剪贴板', followSession: '跟随当前会话', customModel: '固定使用此模型', model: '模型', provider: '服务商', effort: '推理强度',
  conversationModel: '对话模型', backgroundModel: '后台模型', permissionPreset: '权限预设', coordinateMode: '坐标模式',
  avatar: '头像', chooseAvatar: '选择图片', restoreAvatar: '恢复默认头像', systemPermissions: '系统权限', screenPermission: '屏幕录制', accessibilityPermission: '辅助功能', check: '重新检测', openSettings: '打开系统设置',
  shortcut: '快捷键', recordShortcut: '录制快捷键', recordingShortcut: '按下组合键，按 Esc 取消。',
  save: '保存', saving: '正在保存…', retry: '重试应用', saved: '已保存并生效', pending: '已保存，当前未生效', loadError: '无法读取桌面工具设置。', saveError: '无法保存桌面工具设置。',
  noRuntime: '仅可在 DSH Desktop 中使用。', runtimeStopped: '辅助进程已停止', runtimeRunning: '辅助进程运行中', runtimeDegraded: '部分功能需要处理',
  featureDisabled: '已停用', featureStarting: '正在启动', featureActive: '运行中', featureError: '发生错误', permissionGranted: '已授权', permissionDenied: '未授权', permissionUnknown: '未知',
  longShortcut: '长截图快捷键', clearShortcut: '清除', tryNow: '立即试用', shortcutInvalid: '请至少使用一个修饰键（Ctrl/⌘、Alt 或 Shift）加字母、数字或功能键。',
  globalShortcutHint: '快捷键为系统级，DSH 在后台时同样可以唤起。保存后生效。',
  visionTitle: '前置插件：dsh-vision-router', visionDescription: '截图的「提取文字」「翻译」「知识图谱」使用 dsh-vision-router 插件的 OCR 工具，其他功能不依赖它。',
  visionInstall: '一键安装 dsh-vision-router', visionEnable: '启用 dsh-vision-router', visionInstalling: '正在安装 dsh-vision-router…', visionInstallFailed: '安装 dsh-vision-router 失败，请在插件管理中查看原因。',
  visionRestart: 'dsh-vision-router 已安装，重启 DSH 后生效。', visionReady: 'dsh-vision-router 已就绪。',
  visionStateReady: '已就绪', visionStateMissing: '未安装', visionStateDisabled: '已安装，未启用', visionStateToolOff: '已安装，视觉工具已关闭', visionStateUnknown: '未知',
  recordingFormat: '默认格式', recordingQuality: '默认清晰度', qualitySd: '标清 720p', qualityHd: '高清 1080p', qualityOriginal: '原画',
  recordingSystemAudio: '默认录制系统声音', recordingMicrophone: '默认录制麦克风', recordingGraph: '默认在录制结束后生成知识图谱',
  recordingGraphHint: '知识图谱通过 dsh-vision-router 识别关键帧中的文字生成，不转写语音。GIF 不含声音。',
} satisfies Record<keyof typeof en, string>

export type DesktopToolsLocaleKey = keyof typeof en
