import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  extractWechatArticle,
  extractWechatPaywalled,
  importWechatArticle,
  selectionFileName,
  wechatArticleUrl,
  wechatImportLooksShort,
  wechatPaywall,
  WechatArticleError,
} from './selection-archive.ts'

const ARTICLE = 'https://mp.weixin.qq.com/s/abcdef'

const page = (body: string, script = ''): string => `<!doctype html><html><head><meta property="og:title" content="备用标题"></head><body>
  <h1 id="activity-name"> 文章标题 </h1><a id="js_name">作者名</a><em id="publish_time">2026-11-01</em>
  <div class="sidebar">页面外围内容</div>
  <div id="js_content">${body}</div>
  <script>${script}</script>
</body></html>`

test('只接受 mp.weixin.qq.com 的正文地址并规范为 https', () => {
  assert.equal(wechatArticleUrl(' http://mp.weixin.qq.com:80/s/abc#frag ').href, 'https://mp.weixin.qq.com/s/abc')
  assert.equal(wechatArticleUrl('https://mp.weixin.qq.com/s?__biz=1&mid=2').href, 'https://mp.weixin.qq.com/s?__biz=1&mid=2')
  for (const input of ['not a url', 'https://evil.com/s/abc', 'https://user:pw@mp.weixin.qq.com/s/abc',
    'https://mp.weixin.qq.com:8443/s/abc', 'https://mp.weixin.qq.com/mp/profile', 'ftp://mp.weixin.qq.com/s/abc']) {
    assert.throws(() => wechatArticleUrl(input), (error: unknown) => error instanceof WechatArticleError && error.kind === 'invalid-url', input)
  }
})

test('提取正文为 Markdown，只保留公众号图片并统计视频', () => {
  const article = extractWechatArticle(page(`<h2>小节</h2><p>第一段 <a href="/s/other">链接</a> <a href="javascript:alert(1)">脚本</a></p>
    <img data-src="https://mmbiz.qpic.cn/a.png" alt="图[1]"><img src="https://evil.com/b.png"><iframe src="https://v.qq.com/x"></iframe>`), ARTICLE)
  assert.equal(article.title, '文章标题')
  assert.equal(article.author, '作者名')
  assert.equal(article.date, '2026-11-01')
  assert.equal(article.url, ARTICLE)
  assert.deepEqual(article.images, ['https://mmbiz.qpic.cn/a.png'])
  assert.equal(article.videos, 1)
  assert.match(article.markdown, /^## 小节/mu)
  assert.match(article.markdown, /\[链接\]\(https:\/\/mp\.weixin\.qq\.com\/s\/other\)/u)
  assert.match(article.markdown, /!\[图1\]\(https:\/\/mmbiz\.qpic\.cn\/a\.png\)/u)
  assert.match(article.markdown, /\[图片未提供可下载地址\]/u)
  assert.doesNotMatch(article.markdown, /页面外围内容|javascript:/u)
})

test('页面没有正文节点时报告不可用', () => {
  assert.throws(() => extractWechatArticle('<html><body><p>验证页面</p></body></html>', ARTICLE),
    (error: unknown) => error instanceof WechatArticleError && error.kind === 'unavailable')
})

test('识别付费文章的试读比例与售价，已购买或免费时返回 undefined', () => {
  const paid = "var is_pay_subscribe = 0; window.x = { is_pay_subscribe: '1' * 1, is_paid: '0' * 1, pay_subscribe_info: { preview_percent: '30' * 1, fee: '990' * 1 } }"
  assert.deepEqual(wechatPaywall(page('<p>试读</p>', paid)), { previewPercent: 30, fee: 990 })
  assert.equal(wechatPaywall(page('<p>试读</p>', paid.replace("is_paid: '0'", "is_paid: '1'"))), undefined)
  assert.equal(wechatPaywall(page('<p>正文</p>')), undefined)
  const paywalled = extractWechatPaywalled(page('<p>试读片段</p>', paid), ARTICLE)
  assert.equal(paywalled?.title, '文章标题')
  assert.match(paywalled?.preview ?? '', /试读片段/u)
})

test('粘贴导入要求标题和正文非空', () => {
  const article = importWechatArticle({ url: ARTICLE, title: '标题\n第二行', text: ' 正文 ' }, '说明')
  assert.deepEqual([article.title, article.markdown, article.source], ['标题 第二行', '正文', 'pasted'])
  assert.throws(() => importWechatArticle({ url: ARTICLE, title: ' ', text: '正文' }, ''),
    (error: unknown) => error instanceof WechatArticleError && error.kind === 'import-invalid')
})

test('文件名清理非法字符、尾部点号和 Windows 保留名', () => {
  assert.equal(selectionFileName('a<b>:c/d\\e|f?g*h. '), 'a-b--c-d-e-f-g-h')
  assert.equal(selectionFileName('CON'), 'note')
  assert.equal(selectionFileName('com1.txt'), 'note')
  assert.equal(selectionFileName('   '), 'note')
  assert.equal(selectionFileName('x'.repeat(200)).length, 90)
})

test('导入正文不长于试读时提示可能只复制了试读', () => {
  assert.equal(wechatImportLooksShort('一二 三', '一二三'), true)
  assert.equal(wechatImportLooksShort('一二三', '一二三四'), false)
})
