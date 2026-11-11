/** 顶部工具栏使用的内联线性图标（24×24，currentColor 描边）。 */

const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

/** 图标名称到 SVG 字符串的映射。 */
export const icons = {
  screenshot: svg('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/>'),
  video: svg('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>'),
  long: svg('<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>'),
  rect: svg('<rect x="4" y="5" width="16" height="14" rx="1.5"/>'),
  ellipse: svg('<ellipse cx="12" cy="12" rx="8.5" ry="6.5"/>'),
  line: svg('<path d="M5 19 19 5"/>'),
  pen: svg('<path d="M4 20c3-1 4-3 6-6l7-7a2 2 0 0 0-3-3l-7 7c-3 2-5 3-6 6z"/><path d="m13 6 3 3"/>'),
  arrow: svg('<path d="M5 19 19 5M10 5h9v9"/>'),
  text: svg('<path d="M5 6V5h14v1M12 5v14M9 19h6"/>'),
  number: svg('<circle cx="12" cy="12" r="8.5"/><path d="M11 9.5 12.5 8v8"/>'),
  mosaic: svg('<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 9.33h16M4 14.66h16M9.33 4v16M14.66 4v16"/><path d="M4 4h5.33v5.33H4zM14.66 9.33H20v5.33h-5.34zM9.33 14.66h5.33V20H9.33z" fill="currentColor" stroke="none"/>'),
  pin: svg('<path d="M9 4h6l-1 5 3 3H7l3-3z"/><path d="M12 12v8"/>'),
  graph: svg('<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="m8.3 7 7.4.3M7.3 8.2l3.5 7.6M16.7 9.2l-3.5 6.6"/>'),
  translate: svg('<path d="M4 5h8M8 3v2M5.5 9c1.5 3 3.5 5 6.5 6M10.5 5C10 9 7.5 13 4 15"/><path d="m13 21 4-9 4 9M14.5 18h5"/>'),
  ocr: svg('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 9h8M12 9v7"/>'),
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  forward: svg('<path d="m14 5 7 7-7 7"/><path d="M21 12H9a6 6 0 0 0-6 6v1"/>'),
  save: svg('<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7"/>'),
  chevron: '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  record: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="currentColor"/></svg>',
  pause: svg('<path d="M9 5v14M15 5v14"/>'),
  play: svg('<path d="m7 5 12 7-12 7z"/>'),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="1.5"/>'),
  folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  scroll: svg('<rect x="7" y="3" width="10" height="18" rx="5"/><path d="M12 7v4M9.5 15.5 12 18l2.5-2.5"/>'),
  sound: svg('<path d="M4 10v4h3l5 4V6L7 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'),
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
} as const

/** 图标名称。 */
export type IconName = keyof typeof icons
