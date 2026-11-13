/**
 * DSH 宿主提供的界面原语（运行时由模块表注入，构建时不打包）。
 * 只声明桌面工具设置页用到的部分，参数取自宿主「通用设置」「权限」「插件」设置页的实际用法。
 */
declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { ReactNode } from 'react'

  /** 开关：与「通用设置 → 显示代码工作视图」相同的控件。 */
  export function Switch(props: {
    /** 是否打开 */
    checked: boolean
    /** 是否禁用 */
    disabled?: boolean
    /** 读屏名称 */
    label: string
    /** 悬停提示 */
    title?: string
    /** 追加类名 */
    className?: string
    /** 切换时回调新值 */
    onChange: (next: boolean) => void
  }): ReactNode

  /** 菜单项。 */
  export interface MenuItem {
    /** 选项标识 */
    id: string
    /** 选项文字 */
    label: string
    /** 是否禁用 */
    disabled?: boolean
  }

  /** 浮层菜单：与「通用设置 → 权限」下拉相同，anchor 是触发按钮，选中项带对勾。 */
  export function Menu(props: {
    /** 是否展开 */
    open: boolean
    /** 关闭（点击外部、Esc）时回调 */
    onClose: () => void
    /** 选项 */
    items: readonly MenuItem[]
    /** 当前选中项 */
    selectedId?: string
    /** 选中某项时回调 */
    onSelect: (id: string) => void
    /** 与触发按钮的水平对齐 */
    align?: 'start' | 'end'
    /** 展开方向 */
    side?: 'top' | 'bottom'
    /** 是否挂到页面顶层，避免被设置面板裁切 */
    portal?: boolean
    /** 触发按钮 */
    anchor: ReactNode
  }): ReactNode

  /** 下拉箭头图标。 */
  export function IconChevronDownOutlineRegular(props: { className?: string }): ReactNode
}
