/**
 * 第二章内容抓取 · 爬虫
 * ==================================================================
 * 配套文档：docs/0001-第二章内容抓取.md
 *
 * 任务：从 https://www.huanmengacg.com 抓取《Re：从零开始的异世界生活[Web版]》
 *       第二章全部 50 节（第二章1～第二章49 + 第二章幕间）的正文，
 *       去混淆后拼成一份干净的 Markdown。
 *
 * ── 为什么不能「请求完直接拿正文」：站点有反爬混淆 ──────────────────
 * 章节页 #content 容器里，正文段落被做了两层手脚：
 *
 *   1) 顺序被打乱。每个 <p> 上挂了 style="order:NNNN"，渲染靠 flexbox
 *      按 order 升序排；但 HTML 源码里 <p> 是乱序出现的。
 *      ⇒ 解法：解析出 order，按数字升序排序。
 *
 *   2) 塞了若干「诱饵段落」。这些 <p> 多了 class="<data-c>"
 *      （data-c 是 #content 上的一个属性值，每次刷新都变，如 r0fe8e29），
 *      内容是拼凑的半句话，混进正文里读起来就是胡言乱语。
 *      ⇒ 解法：带 class="<data-c>" 的 <p> 直接丢弃。
 *
 *   #content 上还挂着 data-c / data-a 等一堆随机属性，我们把 data-c
 *   当成「诱饵标记」读出来即可，其余无视。
 *
 *   （样例：id=2513 一节，#content 内 141 个 <p>，其中 133 个真段落
 *    order 落在 1000..1146 连续区间，8 个诱饵段落 order 在 1148..1155。）
 *
 * ── 站点还有 Cloudflare 的人机校验 ──────────────────────────────────
 * 用普通 wget/curl（默认 UA）会被拦到「Just a moment...」。
 * 经实测：带上真实的浏览器 UA + Accept 头即可直通拿到 HTML。
 * 所以这里用 Node 原生 https + 一组「像浏览器」的请求头，零依赖。
 *
 * ── 礼貌抓取 ───────────────────────────────────────────────────────
 * 逐节抓，每节之间 sleep（默认 1.5s），带重试，单节失败不影响整本。
 *
 * 用法：
 *   node crawler/fetch-chapters.js              # 抓全部 50 节
 *   node crawler/fetch-chapters.js 2513 2514    # 只抓指定 id
 *   OUT_DIR=../output node crawler/fetch-chapters.js
 *   DELAY_MS=1500 RETRY=4 node crawler/fetch-chapters.js
 * ==================================================================
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const CHAPTERS = require("./chapters");

// ─── 配置（都可被环境变量覆盖） ───────────────────────────────────────
const BASE = "https://www.huanmengacg.com";
const DELAY_MS = Number(process.env.DELAY_MS) || 1000; // 节奏，别把人站锤了
const RETRY = Number(process.env.RETRY) || 6; // 单节最大尝试次数（含首次）
// 实测该站常态：单请求要 2~6s 才回，且约 20% 概率「假死」(建连后不回字节)。
// 经验：假死时【立刻重试】基本都能成，所以超时给 8s、退避给极小值，
// 让「假死」被快速兜住，而不是干等。
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS) || 8000;
const OUT_DIR = path.resolve(
  __dirname,
  process.env.OUT_DIR || path.join(__dirname, "..", "output")
);
// 只抓指定 id（命令行参数），为空则抓全部
const ONLY_IDS = process.argv.slice(2).map((x) => Number(x)).filter(Boolean);

// ─── 像浏览器一样的请求头（绕过基于 UA 的初筛） ──────────────────────
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif," +
    "image/webp,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  Referer: BASE + "/index.php/book/info/8768",
};

// ====================================================================
//  小工具
// ====================================================================
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function chapterUrl(id) {
  return `${BASE}/index.php/book_read_8768_${id}.html`;
}

// HTML 实体 & <标签> 清洗。正文里常见的就这些；遇到没列的也不报错。
function cleanText(html) {
  return html
    .replace(/<br\s*\/?>(?:\s*<br\s*\/?>)*/gi, "\n")
    .replace(/<[^>]+>/g, "") // 去掉所有标签
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&hellip;/g, "…")
    .replace(/&mdash;/g, "—")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&lsquo;/g, "‘")
    .replace(/&rsquo;/g, "’")
    .replace(/&amp;/g, "&") // &amp; 要放在最后，避免 &quot; 被二次解码
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\r/g, "")
    .trim();
}

// 用回调包一个 https.get，带超时与可重试错误判断。
// 实测要点：该站常「建连成功却不回字节」，所以
//   ① 显式带 Connection: close，不复用连接，杜绝 keep-alive 卡死；
//   ② 用 setTimeout 做「整体兜底」，比 req.timeout(只管 socket 静默) 更可靠；
//   ③ 任何出口都 socket.destroy()，绝不留挂起的连接。
function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn, val, socket) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (socket) socket.destroy();
      fn(val);
    };

    const req = https.get(
      url,
      { headers: { ...HEADERS, Connection: "close" }, timeout: TIMEOUT_MS },
      (res) => {
        // 整段读不完也算超时：只要到点还没 end，就强制掐断交给重试。
        const watchdog = setTimeout(
          () => done(reject, new Error("timeout"), req.socket),
          TIMEOUT_MS
        );
        // 跟随重定向
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          clearTimeout(watchdog);
          res.resume();
          return done(resolve, fetchHtml(new URL(res.headers.location, url).href));
        }
        if (res.statusCode !== 200) {
          clearTimeout(watchdog);
          res.resume();
          return done(reject, new Error(`HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          clearTimeout(watchdog);
          done(resolve, Buffer.concat(chunks).toString("utf8"));
        });
        res.on("error", (e) => {
          clearTimeout(watchdog);
          done(reject, e, req.socket);
        });
      }
    );

    // 兜底定时器：建连阶段就卡住也要能跳出
    const timer = setTimeout(
      () => done(reject, new Error("timeout"), req.socket),
      TIMEOUT_MS + 1000
    );

    req.on("timeout", () => done(reject, new Error("timeout"), req.socket));
    req.on("error", (e) => done(reject, e));
  });
}

// 带重试的抓取：网络抖动 / 偶发 5xx / Cloudflare 抽风 / 服务端假死都能扛。
// 该站「假死」概率高（~20%）但立刻重试就好，所以退避给极小值（不浪费 30s）。
async function fetchWithRetry(url) {
  let lastErr;
  for (let attempt = 1; attempt <= RETRY; attempt++) {
    try {
      const html = await fetchHtml(url);
      // Cloudflare 拦截页的特征：标题里出现 "Just a moment"
      if (/just a moment/i.test(html) || /performing a security check/i.test(html)) {
        throw new Error("blocked by Cloudflare");
      }
      return html;
    } catch (e) {
      lastErr = e;
      if (attempt >= RETRY) break;
      // 假死重试基本秒成，给个极小退避（500ms + 一点抖动）即可；
      // Cloudflare/5xx 才需要稍长，但这里统一用小退避，靠次数堆。
      const backoff = 500 + Math.floor(Math.random() * 500);
      console.warn(
        `    ! 抓取失败(第${attempt}/${RETRY}次)：${e.message}，${backoff}ms 后重试`
      );
      await sleep(backoff);
    }
  }
  throw lastErr;
}

// ====================================================================
//  核心：从单页 HTML 抽取并去混淆得到正文段落数组
// ====================================================================
function extractParagraphs(html) {
  // 1) 定位正文容器 #content，并取出它的 data-c（诱饵标记，每次刷新都变）
  const containerM = html.match(/<div\b[^>]*\bid="content"[^>]*>/i);
  if (!containerM) throw new Error("找不到 #content 容器");
  const containerTag = containerM[0];
  const decoyClass = (containerTag.match(/data-c="([^"]+)"/) || [])[1];
  if (!decoyClass) throw new Error("缺少 data-c，无法识别诱饵段落");

  // 2) 截取 #content 内部（到匹配的 </div>）。正文里不会出现嵌套 div，
  //    所以「下一个 </div>」就是 #content 的闭合，足够稳。
  const after = html.slice(containerM.index + containerTag.length);
  const closeIdx = after.indexOf("</div>");
  const inner = closeIdx === -1 ? after : after.slice(0, closeIdx);

  // 3) 逐个 <p>：读 order 值 + 判断是不是诱饵（诱饵 = 带 class="data-c"）
  const decoyRe = new RegExp(`class=["']\\s*${decoyClass}\\s*["']`);
  const items = [];
  for (const m of inner.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const tag = m[0].slice(0, m[0].indexOf(">"));
    const orderM = tag.match(/order:\s*(\d+)/);
    if (!orderM) continue; // 没有 order 的 <p> 不是正文
    const text = cleanText(m[1]);
    if (!text) continue;
    if (decoyRe.test(tag)) continue; // 诱饵段落，丢弃
    items.push({ order: Number(orderM[1]), text });
  }

  if (items.length === 0) throw new Error("正文为空（解析可能失败）");

  // 4) 关键：按 order 升序排，恢复被打乱的阅读顺序
  items.sort((a, b) => a.order - b.order);
  return items.map((x) => x.text);
}

// ====================================================================
//  主流程
// ====================================================================
async function main() {
  const targets =
    ONLY_IDS.length > 0
      ? CHAPTERS.filter((c) => ONLY_IDS.includes(c.id))
      : CHAPTERS;

  if (targets.length === 0) {
    console.error("没有匹配的章节，检查命令行 id 参数。");
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const total = targets.length;
  console.log("──────────────────────────────────────────────────────────");
  console.log(`  第二章抓取：共 ${total} 节`);
  console.log(`  输出目录：  ${OUT_DIR}`);
  console.log(`  节奏：      ${DELAY_MS}ms/节，单节最多重试 ${RETRY} 次`);
  console.log("──────────────────────────────────────────────────────────\n");

  const allParts = []; // 汇总成单文件
  const failed = [];

  for (let i = 0; i < total; i++) {
    const ch = targets[i];
    const idx = `[${String(i + 1).padStart(2)}/${total}]`;
    console.log(`${idx} 抓取 ${ch.seq}（id=${ch.id}）…`);

    let paragraphs;
    try {
      const html = await fetchWithRetry(chapterUrl(ch.id));
      paragraphs = extractParagraphs(html);
    } catch (e) {
      console.warn(`    ✗ 失败：${e.message}（已跳过，继续）`);
      failed.push(ch);
      // 失败的章节在汇总里留个占位，方便事后补抓
      allParts.push(`# ${ch.seq}　『${ch.title}』\n\n> ⚠️ 抓取失败：${e.message}\n`);
      await sleep(DELAY_MS);
      continue;
    }

    // 单节也落一份文件，断点续抓 / 单独看都方便
    const fileName = `${ch.seq}.txt`.replace(/[\\/:*?"<>|]/g, "_");
    const singleBody = paragraphs.join("\n\n");
    fs.writeFileSync(path.join(OUT_DIR, fileName), singleBody + "\n", "utf8");

    console.log(`    ✓ ${paragraphs.length} 段 → ${fileName}`);

    allParts.push(`## ${ch.seq}　『${ch.title}』\n\n${singleBody}`);

    // 礼貌延时（最后一节不用等）
    if (i < total - 1) await sleep(DELAY_MS);
  }

  // 汇总成一本 Markdown
  const header = [
    "# Re：从零开始的异世界生活[Web版] · 第二章",
    "",
    `> 抓取自 ${BASE}/index.php/book/info/8768`,
    `> 共 ${total} 节，成功 ${total - failed.length} 节，失败 ${failed.length} 节`,
    `> 生成时间：${new Date().toISOString()}`,
    "",
    "---",
    "",
  ].join("\n");
  const allPath = path.join(OUT_DIR, "第二章.md");
  fs.writeFileSync(allPath, header + allParts.join("\n\n---\n\n") + "\n", "utf8");

  console.log("\n──────────────────────────────────────────────────────────");
  console.log(`  完成。汇总文件：${allPath}`);
  if (failed.length) {
    console.log(`  失败章节：${failed.map((c) => `${c.seq}(id=${c.id})`).join(", ")}`);
    console.log("  可用 `node crawler/fetch-chapters.js <id>…` 单独补抓。");
  }
  console.log("──────────────────────────────────────────────────────────");
  process.exit(failed.length ? 2 : 0);
}

main().catch((e) => {
  console.error("未预期错误：", e);
  process.exit(1);
});
