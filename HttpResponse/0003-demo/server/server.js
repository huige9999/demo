/**
 * SSE vs 普通流式响应 · demo 服务端
 * ------------------------------------------------------------------
 * 配套文档：docs/0003-SSE响应和普通流响应.md
 *
 * 接口：
 *   GET /                    静态首页
 *   GET /api/sse?speed=      SSE（text/event-stream）
 *   GET /api/stream?speed=   普通文本流（text/plain）
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = Number(process.env.PORT) || 3001;
const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");

const SPEED_TABLE = { slow: 400, mid: 200, fast: 80 };
function resolveSpeed(query) {
  return SPEED_TABLE[query.speed] ?? SPEED_TABLE.mid;
}

// 同一段 token 序列，两个接口共用
const TOKENS = [
  "你", "好", "，", "这", "是", "一", "段", "模", "拟", "的",
  "流", "式", "输", "出", "。", "S", "S", "E", " ", "与", "普", "通", "流",
  "用", "相", "同", "数", "据", "，", "方", "便", "对", "比", "。",
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

function serveStatic(req, res) {
  let pathname = url.parse(req.url).pathname;
  if (pathname === "/") pathname = "/index.html";

  const filePath = path.join(PUBLIC_DIR, pathname);
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

function streamTokens(res, req, speedMs, onToken) {
  let i = 0;

  function sendNext() {
    if (res.writableEnded) return;

    if (i >= TOKENS.length) {
      onToken(null, i);
      res.end();
      return;
    }

    const token = TOKENS[i];
    onToken(token, i);
    i++;
    setTimeout(sendNext, speedMs);
  }

  req.on("close", () => {
    i = TOKENS.length;
  });

  sendNext();
}

function handleSse(req, res, query) {
  const speedMs = resolveSpeed(query);

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // 注释行：部分代理靠首包 flush 连接
  res.write(": connected\n\n");

  streamTokens(res, req, speedMs, (token, index) => {
    if (token === null) {
      res.write("event: done\ndata: [DONE]\n\n");
      return;
    }
    const payload = JSON.stringify({ token, index });
    res.write(`data: ${payload}\n\n`);
  });
}

function handlePlainStream(req, res, query) {
  const speedMs = resolveSpeed(query);

  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
  });

  streamTokens(res, req, speedMs, (token) => {
    if (token === null) return;
    res.write(token);
  });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const query = parsed.query || {};

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

    case "/api/sse":
      console.log(`[${new Date().toISOString()}] /api/sse     speed=${query.speed || "mid"}`);
      handleSse(req, res, query);
      break;

    case "/api/stream":
      console.log(`[${new Date().toISOString()}] /api/stream  speed=${query.speed || "mid"}`);
      handlePlainStream(req, res, query);
      break;

    default:
      res.writeHead(404);
      res.end("not found");
  }
});

server.listen(PORT, () => {
  console.log("──────────────────────────────────────────────────────────");
  console.log("  SSE vs 普通流式响应 · demo 已启动");
  console.log(`  首页:  http://localhost:${PORT}/`);
  console.log(`  SSE:   http://localhost:${PORT}/api/sse`);
  console.log(`  流:    http://localhost:${PORT}/api/stream`);
  console.log("──────────────────────────────────────────────────────────");
});
