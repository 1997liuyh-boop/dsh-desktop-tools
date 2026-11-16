/** 自定义划词动作提示词、工具栏按钮列表与截图提问提示词测试。 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { composeCaptureAskPrompt, composeSelectionCustomPrompt, DESKTOP_SELECTION_PREAMBLE, selectionToolbarItems } from './selection-prompt.ts'

test('自定义提示词替换 {text} 与 {language}，并带上桌面划词前言', () => {
  const prompt = composeSelectionCustomPrompt('把 {text} 译成 {language}', '你好', 'en')
  assert.equal(prompt, `${DESKTOP_SELECTION_PREAMBLE}\n\n把 你好 译成 English`)
})

test('模板没有 {text} 时把选中文字附在末尾', () => {
  const prompt = composeSelectionCustomPrompt('总结要点', '正文', '简体中文')
  assert.ok(prompt.endsWith('总结要点\n\n<selected-text>\n正文\n</selected-text>'))
})

test('选中文字里的占位符和替换符不会被二次处理', () => {
  const prompt = composeSelectionCustomPrompt('改写：{text}', '包含 {language} 和 $& 的文字', 'en')
  assert.ok(prompt.endsWith('改写：包含 {language} 和 $& 的文字'))
})

test('工具栏按钮按配置顺序给出，自定义动作带名称，悬空引用被忽略', () => {
  const items = selectionToolbarItems({
    customActions: [{ id: 'polish', name: '润色' }],
    toolbarItems: ['custom:polish', 'translate', 'custom:gone', 'search'],
  })
  assert.deepEqual(items, [{ id: 'custom:polish', label: '润色' }, { id: 'translate' }, { id: 'search' }])
})

test('截图提问：附图时不带识别文字，追问带上最近的问答', () => {
  const image = composeCaptureAskPrompt({ question: '这是什么？', history: [], chinese: true })
  assert.match(image, /attached as an image/u)
  assert.doesNotMatch(image, /recognized-text|previous-question/u)
  assert.match(image, /Simplified Chinese/u)
  assert.ok(image.endsWith('<question>\n这是什么？\n</question>'))

  const text = composeCaptureAskPrompt({
    question: '第二个问题', history: [{ question: '第一个问题', answer: '第一个回答' }], recognizedText: 'OCR 结果', chinese: false,
  })
  assert.match(text, /<recognized-text>\nOCR 结果\n<\/recognized-text>/u)
  assert.match(text, /<previous-question>\n第一个问题\n<\/previous-question>\n<previous-answer>\n第一个回答\n<\/previous-answer>/u)
  assert.match(text, /the language of the question/u)
})
