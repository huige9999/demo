/**
 * 字节流消费策略 · demo 服务端
 * ------------------------------------------------------------------
 * 配套文档：docs/0002-字节流消费策略实验方案.md
 *
 * 设计原则（必须对着文档自洽）：
 *   1. 零依赖 —— 只用 Node 原生 http / fs，没有任何魔法层。
 *   2. 服务端「故意变慢」（demo 的命根子）：不直接 stream.pipe(res)，
 *      而是手动「读一块 → res.write → setTimeout(speed) → 再读一块」，
 *      人为把字节「一滴一滴」挤到 socket 上，否则 localhost 太快，
 *      缓冲式 / 增量式根本看不出区别。
 *   3. 服务端「裸」：每个接口的差别【只有】
 *        - Content-Type 头不同
 *        - 字节来源不同（mp4 文件 / 服务端现造的文本）
 *      处理逻辑完全一样，都是「把字节按节流节奏写出去」。
 *      这坐实文档那句「网络层只干一件事：把字节按顺序可靠地送到」。
 *
 * 接口清单（见文档第六节）：
 *   GET /                         静态首页 index.html
 *   GET /same-bytes?ct=&speed=    实验0  Content-Type 由 ct 定，节流，字节=mp4
 *   GET /api/blob?speed=          实验1  application/octet-stream，节流，字节=mp4
 *   GET /api/ndjson?speed=        实验2  application/x-ndjson，节流，字节=生成文本
 *   GET /raw        (+Range)      实验3a video/mp4，支持 Range，节流
 * ------------------------------------------------------------------
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const VIDEO_PATH = path.join(ROOT, "assets", "video.mp4");

// ─── 启动时把 video.mp4 一次性读进内存（536KB，无所谓） ───────────────
// 读成 Buffer 后，所有「按字节范围发」的逻辑（含 Range）都退化为切片，
// 处理逻辑极度统一、好讲。
const VIDEO_BUF = fs.readFileSync(VIDEO_PATH);
const VIDEO_TOTAL = VIDEO_BUF.length;

// ─── 节流速度档位（文档决策 1 / 第十节推荐值） ────────────────────────
//   slow 200ms/块  —— 演示用，把「流」看清楚
//   mid   50ms/块  —— 默认
//   fast  10ms/块  —— 快速跑完
const SPEED_TABLE = { slow: 200, mid: 50, fast: 10 };
function resolveSpeed(query) {
  return SPEED_TABLE[query.speed] ?? SPEED_TABLE.mid;
}

// ─── 核心：节流发送 ───────────────────────────────────────────────────
// 把一段字节「一块一块」地写到 res，每块之间隔 speedMs 毫秒。
// 这是整个 demo 能不能「摸到流」的关键：不节流，所有实验瞬间完成。
//
//   buf       要发的完整 Buffer
//   speedMs   每块之间的间隔
//   chunkSize 每块多大
//   start/end 可选，要发送的字节范围（含端点，用于 Range）；默认整段
function sendThrottled(res, buf, { speedMs, chunkSize, start = 0, end = buf.length - 1 }) {
  let offset = start;
  const stop = end + 1; // end 是闭区间

  function writeChunk() {
    if (res.writableEnded) return;

    if (offset >= stop) {
      res.end();
      return;
    }

    const sliceEnd = Math.min(offset + chunkSize, stop);
    const ok = res.write(buf.subarray(offset, sliceEnd));

    offset = sliceEnd;

    if (ok) {
      // socket 缓冲没满，按节流间隔发下一块
      setTimeout(writeChunk, speedMs);
    } else {
      // 缓冲满了（背压），等 drain 后再继续，避免内存爆掉
      res.once("drain", () => setTimeout(writeChunk, speedMs));
    }
  }

  writeChunk();
}

// ─── Range 解析（实验 3a 必须实现，否则 <video> 边下边播/拖动会异常） ──
// 仅支持单段 Range：bytes=start-end / bytes=start- / bytes=-suffix
function parseRange(rangeHeader, total) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || "");
  if (!m) return null;

  const s = m[1];
  const e = m[2];
  let start, end;

  if (s === "" && e === "") return null;
  if (s === "") {
    // 后缀范围：取最后 N 个字节
    const suffix = parseInt(e, 10);
    if (suffix === 0) return null;
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else {
    start = parseInt(s, 10);
    end = e === "" ? total - 1 : parseInt(e, 10);
  }

  if (start > end || start >= total || start < 0) return null;
  end = Math.min(end, total - 1);
  return { start, end };
}

// ─── NDJSON 字节源（实验 2：字节来自服务端现造的文本） ────────────────
// 造一批「学生记录」，每行一个 JSON 对象。这是 demo 里唯一不是 mp4 字节
// 的接口——故意如此，证明「增量解析」对任何字节流都成立。
function buildNdjsonBuffer() {
  const classes = ["一班", "二班", "三班"];
  const names = ["张三", "李四", "王五", "赵六", "钱七", "孙八", "周九", "吴十"];
  const lines = [];
  for (let i = 0; i < 40; i++) {
    const rec = {
      id: i,
      name: names[i % names.length] + i,
      class: classes[i % classes.length],
      score: 50 + ((i * 37) % 51), // 50~100，确定性数字，方便对照
      ts: Date.now() + i,
    };
    lines.push(JSON.stringify(rec));
  }
  return Buffer.from(lines.join("\n") + "\n", "utf8");
}
const NDJSON_BUF = buildNdjsonBuffer();

// ─── 静态文件服务（首页 + app.js + style.css） ────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mp4": "video/mp4",
};

function serveStatic(req, res) {
  let pathname = url.parse(req.url).pathname;
  if (pathname === "/") pathname = "/index.html";

  const filePath = path.join(PUBLIC_DIR, pathname);
  // 防路径穿越
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
    });
    res.end(data);
  });
}

// ─── 实验 0：控制实验 ─────────────────────────────────────────────────
// 同一份字节（mp4）、同一种节流，【只改 Content-Type 这一个头】。
// 白名单校验，杜绝 CRLF 头注入。
const CT_WHITELIST = {
  "video/mp4": "video/mp4",
  "application/json": "application/json",
  "application/octet-stream": "application/octet-stream",
  "text/event-stream": "text/event-stream; charset=utf-8",
};

function handleSameBytes(req, res, query) {
  const ct = CT_WHITELIST[query.ct] || "application/octet-stream";
  const speedMs = resolveSpeed(query);

  res.writeHead(200, {
    "Content-Type": ct,
    "Content-Length": VIDEO_TOTAL,
    "Cache-Control": "no-store",
    // 暴露给 JS 读（实验0 会在卡片里打印 content-type，本就同源可读，这里显式声明）
    "Access-Control-Expose-Headers": "Content-Type",
  });

  // 32KB/块：536KB ≈ 17 块，节奏清楚又不至于太碎
  sendThrottled(res, VIDEO_BUF, { speedMs, chunkSize: 32 * 1024 });
}

// ─── 实验 1：缓冲式（.blob 路线） ─────────────────────────────────────
function handleBlob(req, res, query) {
  const speedMs = resolveSpeed(query);
  res.writeHead(200, {
    "Content-Type": "application/octet-stream",
    "Content-Length": VIDEO_TOTAL,
    "Cache-Control": "no-store",
  });
  sendThrottled(res, VIDEO_BUF, { speedMs, chunkSize: 32 * 1024 });
}

// ─── 实验 2：增量解析式（NDJSON 路线） ────────────────────────────────
function handleNdjson(req, res, query) {
  const speedMs = resolveSpeed(query);
  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Content-Length": NDJSON_BUF.length,
    "Cache-Control": "no-store",
  });
  // 故意用很小的块（48 字节）：一行 JSON 会被拆到多个 chunk 里，
  // 这样客户端「保留半行缓冲」的跨 chunk 切分逻辑才真的有用武之地。
  sendThrottled(res, NDJSON_BUF, { speedMs, chunkSize: 48 });
}

// ─── 实验 3a：浏览器内置消费者（video + Range） ───────────────────────
function handleRaw(req, res, query) {
  const speedMs = resolveSpeed(query);
  const range = parseRange(req.headers["range"], VIDEO_TOTAL);

  if (range) {
    const len = range.end - range.start + 1;
    res.writeHead(206, {
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
      "Content-Range": `bytes ${range.start}-${range.end}/${VIDEO_TOTAL}`,
      "Content-Length": len,
      "Cache-Control": "no-store",
    });
    // Range 的块要适配这段长度，别切块 > 范围
    sendThrottled(res, VIDEO_BUF, {
      speedMs,
      chunkSize: Math.min(32 * 1024, len),
      start: range.start,
      end: range.end,
    });
  } else {
    // 没带 Range：返回整段 200（仍然节流）
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
      "Content-Length": VIDEO_TOTAL,
      "Cache-Control": "no-store",
    });
    sendThrottled(res, VIDEO_BUF, { speedMs, chunkSize: 32 * 1024 });
  }
}

// ─── 路由总入口 ───────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const query = parsed.query || {};
  const speedTag = query.speed || "mid";

  if (req.method !== "GET") {
    res.writeHead(405);
    res.end("method not allowed");
    return;
  }

  switch (pathname) {
    case "/":
    case "/index.html":
    case "/app.js":
    case "/style.css":
      serveStatic(req, res);
      break;

    case "/same-bytes":
      console.log(`[${new Date().toISOString()}] /same-bytes  ct=${query.ct}  speed=${speedTag}`);
      handleSameBytes(req, res, query);
      break;

    case "/api/blob":
      console.log(`[${new Date().toISOString()}] /api/blob    speed=${speedTag}`);
      handleBlob(req, res, query);
      break;

    case "/api/ndjson":
      console.log(`[${new Date().toISOString()}] /api/ndjson  speed=${speedTag}`);
      handleNdjson(req, res, query);
      break;

    case "/raw":
      console.log(
        `[${new Date().toISOString()}] /raw        speed=${speedTag}  range=${req.headers["range"] || "-"}`
      );
      handleRaw(req, res, query);
      break;

    default:
      res.writeHead(404);
      res.end("not found");
  }
});

server.listen(PORT, () => {
  console.log("──────────────────────────────────────────────────────────");
  console.log("  字节流消费策略 · demo 服务已启动");
  console.log(`  首页:        http://localhost:${PORT}/`);
  console.log(`  video.mp4:   ${VIDEO_TOTAL} bytes`);
  console.log(`  ndjson:      ${NDJSON_BUF.length} bytes`);
  console.log(`  速度档位:    slow=${SPEED_TABLE.slow}ms  mid=${SPEED_TABLE.mid}ms  fast=${SPEED_TABLE.fast}ms`);
  console.log("──────────────────────────────────────────────────────────");
});
