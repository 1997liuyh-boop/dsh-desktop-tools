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
} as const

export const zh = {
  title: '桌面工具', selection: '划词工具栏', floating: '悬浮球', screenshot: '截屏', recording: '录屏',
  enabled: '启用', language: '目标语言', compatibilityCopy: '将所选文本复制到剪贴板', followSession: '跟随当前会话', customModel: '固定使用此模型', model: '模型', provider: '服务商', effort: '推理强度',
  conversationModel: '对话模型', backgroundModel: '后台模型', permissionPreset: '权限预设', coordinateMode: '坐标模式',
  avatar: '头像', chooseAvatar: '选择图片', restoreAvatar: '恢复默认头像', systemPermissions: '系统权限', screenPermission: '屏幕录制', accessibilityPermission: '辅助功能', check: '重新检测', openSettings: '打开系统设置',
  shortcut: '快捷键', recordShortcut: '录制快捷键', recordingShortcut: '按下组合键，按 Esc 取消。',
  save: '保存', saving: '正在保存…', retry: '重试应用', saved: '已保存并生效', pending: '已保存，当前未生效', loadError: '无法读取桌面工具设置。', saveError: '无法保存桌面工具设置。',
  noRuntime: '仅可在 DSH Desktop 中使用。', runtimeStopped: '辅助进程已停止', runtimeRunning: '辅助进程运行中', runtimeDegraded: '部分功能需要处理',
  featureDisabled: '已停用', featureStarting: '正在启动', featureActive: '运行中', featureError: '发生错误', permissionGranted: '已授权', permissionDenied: '未授权', permissionUnknown: '未知',
} satisfies Record<keyof typeof en, string>

export type DesktopToolsLocaleKey = keyof typeof en
