# 第二章内容抓取 · 爬虫

抓取《Re：从零开始的异世界生活[Web版]》第二章全部 50 节正文，
去混淆后拼成一份干净的 Markdown / txt。

> 配套文档：
> - [`../docs/0001-第二章内容抓取.md`](../docs/0001-第二章内容抓取.md) —— 首次实战记录
> - [`../docs/0002-幻梦轻小说站抓取经验沉淀.md`](../docs/0002-幻梦轻小说站抓取经验沉淀.md) —— **可复用经验**（下次抓这个站先读这篇）

## 文件

| 文件 | 作用 |
|---|---|
| `chapters.js` | 第二章章节清单（**阅读顺序 = 数组顺序**，不是 id 顺序） |
| `fetch-chapters.js` | 爬虫主程序，零依赖（只用 Node 原生 `https`） |

## 用法

```bash
# 抓全部 50 节
node crawler/fetch-chapters.js

# 只抓指定 id（断点续抓 / 单独补抓失败节）
node crawler/fetch-chapters.js 2513 2514

# 可调参数（环境变量）
DELAY_MS=1000 RETRY=5 node crawler/fetch-chapters.js
OUT_DIR=../some-dir node crawler/fetch-chapters.js
```

产物默认写到 `RE0/output/`：每节一个 `<序号>.txt`，外加汇总 `第二章.md`。
（`output/` 已加入 `.gitignore`，正文不入库。）

## 它解决了什么（反爬 / 混淆）

直接 `curl` 拿到的章节页正文是「读不通」的，站点做了两层手脚：

### 1. 段落顺序被打乱

每个 `<p>` 挂了 `style="order:NNNN"`，靠 flexbox 按 `order` 升序渲染，
但 HTML 源码里 `<p>` 是乱序出现的。
→ **解析 `order`，按数字升序排序。**

### 2. 混入「诱饵段落」

部分 `<p>` 多了 `class="<data-c>"`（`data-c` 是 `#content` 容器上的属性值，
每次刷新都变，如 `r0fe8e29`），内容是拼凑的半句话，混进去读起来就是胡言乱语。
→ **带 `class="<data-c>"` 的 `<p>` 整段丢弃。**

### 3. Cloudflare 人机校验

默认 UA 的请求会被拦到「Just a moment...」。
→ **带一组真实浏览器的请求头（UA / Accept / Accept-Language / Referer）即可直通。**

解码逻辑见 `fetch-chapters.js` 顶部注释和 `extractParagraphs()`。

## 礼貌抓取

- 逐节抓，节间默认 `DELAY_MS=1500ms`；
- 单节失败自动退避重试（默认 `RETRY=4` 次）；
- 某节彻底失败会跳过并继续，最后在汇总里留占位、列出失败清单，可单独补抓。
