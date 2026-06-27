/* ════════════════════════════════════════════════════════════════
 * 字节流消费策略 · 客户端逻辑
 * -----------------------------------------------------------------
 * 配套：docs/0002-字节流消费策略实验方案.md
 *
 * 设计核心：每张卡片跑的都是【同一段骨架】
 *
 *     const res = await fetch(url);
 *     for await (const chunk of res.body) { ... }
 *
 * 差别【只在】chunk 拿到之后交给谁：
 *   实验 0  → 只 log（证明到达方式相同）
 *   实验 1  → 攒进数组，流结束才 createObjectURL（缓冲式）
 *   实验 2  → 按 \n 切分，每行立刻 append 一条记录（增量解析式）
 *   实验 3a → 交给 <video src>，浏览器内置消费者（增量渲染式）
 *
 * 一句话：到达是同一回事，消费是另一回事。
 * ════════════════════════════════════════════════════════════════ */

// ─── 工具：把字节数格式化成人话 ────────────────────────────────────
function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// ─── 工具：把一段字节做成「hex + ASCII」预览 ────────────────────────
// 用于把 chunk 的「样子」亮出来。mp4 文件头是 ftyp box，magic bytes 是
// 66 74 79 70 ('ftyp')——实验 0 切 Content-Type 时，看这一行不变，就
// 证明了「Content-Type 只是个标签，字节没动」。
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// 二进制预览：8 字节 hex + 对应 ASCII（不可打印用 · 占位）
function hexPeekHtml(buf, max = 8) {
  const n = Math.min(max, buf.byteLength);
  let hex = "", ascii = "";
  for (let i = 0; i < n; i++) {
    const b = buf[i];
    hex += b.toString(16).padStart(2, "0") + " ";
    ascii += (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : "·";
  }
  return `<span class="peek-hex">${hex.trim()}</span> <span class="peek-sep">│</span> <span class="peek-ascii">${ascii}</span>`;
}
// 文本流（实验 2 NDJSON）直接显示 UTF-8 片段，比 hex 直观，
// 还能看见「一行 JSON 被切在两个 chunk 之间」
function textPeekHtml(buf, max = 48) {
  const s = new TextDecoder().decode(buf.subarray(0, Math.min(max, buf.byteLength)));
  const safe = escapeHtml(s.replace(/\r/g, "").replace(/\n/g, " ⏎ "));
  return `<span class="peek-ascii">"${safe}"</span>`;
}

// ─── 一张卡片的状态机（共用骨架） ─────────────────────────────────
// 把「流可视化」「时间线」「控件」的 DOM 和状态都收拢到一个对象里，
// 每个实验只需要实现 onChunk / onEnd 两个回调，差别就体现在这里。
class Card {
  constructor(rootEl) {
    this.root = rootEl;
    this.exp = rootEl.dataset.exp;

    // DOM 引用
    this.log = rootEl.querySelector('[data-role="log"]');
    this.timeline = rootEl.querySelector('[data-role="timeline"]');
    this.output = rootEl.querySelector('[data-role="output"]');
    this.ct = rootEl.querySelector('[data-role="ct"]');
    this.fill = rootEl.querySelector(".progress-fill");
    this.progressText = rootEl.querySelector(".progress-text");
    this.btnStart = rootEl.querySelector(".btn-start");
    this.btnReset = rootEl.querySelector(".btn-reset");
    this.speedSelect = rootEl.querySelector(".speed-select");

  // 运行态
  this.total = 0;
  this.received = 0;
  this.t0 = 0;
  this.yielded = false;     // 是否已经出现「第一次可用产出」
  this.yieldAt = null;      // 第一次可用产出的相对时间(ms)
  this.chunkCount = 0;
  this.abort = null;
  this.buf = "";            // 跨 chunk 的字符串缓冲（实验 2 用）
  this.peek = "hex";        // chunk 字节预览模式：'hex' | 'text' | 'none'

    this.btnStart.addEventListener("click", () => this.start());
    this.btnReset.addEventListener("click", () => this.reset());

    this.renderTimeline();
  }

  get speed() { return this.speedSelect.value; }

  // —— 时间线渲染 ——
  renderTimeline() {
    if (!this.timeline) return;
    this.timeline.innerHTML = `
      <div class="tl-track"><div class="tl-fill"></div></div>
      <div class="tl-pt start"></div>
      <div class="tl-pt yield"></div>
      <div class="tl-pt end"></div>
      <span class="tl-label start">流开始</span>
      <span class="tl-label end">流结束</span>
    `;
    const readout = document.createElement("div");
    readout.className = "tl-readout";
    readout.dataset.role = "tl-readout";
    readout.textContent = "尚未运行";
    // 时间线后面追加 readout（保证紧跟在 timeline 之后）
    this.timeline.after(readout);
    this.tlReadout = readout;
    this.tlFill = this.timeline.querySelector(".tl-fill");
    this.tlYield = this.timeline.querySelector(".tl-pt.yield");
  }

  // —— 流开始 ——
  markStart(total) {
    this.total = total;
    this.t0 = performance.now();
    this.received = 0;
    this.chunkCount = 0;
    this.yielded = false;
    this.yieldAt = null;
    this.buf = "";
    if (this.tlReadout) this.tlReadout.textContent = "流进行中…";
  }

  // —— 每收到一块 chunk ——（骨架里大家都走这一步）
  onChunkArrive(chunk) {
    this.chunkCount++;
    this.received += chunk.byteLength;
    const now = performance.now() - this.t0;

    // 字节预览：把这块的字节「样子」亮出来
    let peekHtml = "";
    if (this.peek === "hex") {
      peekHtml = `<div class="peek">${hexPeekHtml(chunk)}</div>`;
    } else if (this.peek === "text") {
      peekHtml = `<div class="peek">${textPeekHtml(chunk)}</div>`;
    }

    // 流可视化：日志 + 进度条
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML =
      `<span class="idx">#${this.chunkCount}</span> ` +
      `${fmtBytes(chunk.byteLength)} | 累计 ${fmtBytes(this.received)}` +
      (this.total ? ` / ${fmtBytes(this.total)}` : "") +
      ` | +${now.toFixed(0)}ms` +
      peekHtml;
    if (this.log) {
      this.log.appendChild(row);
      this.log.scrollTop = this.log.scrollHeight;
    }
    if (this.fill) {
      const pct = this.total ? (this.received / this.total) * 100 : 0;
      this.fill.style.width = pct + "%";
    }
    if (this.progressText) {
      this.progressText.textContent = `${fmtBytes(this.received)} / ${fmtBytes(this.total)}`;
    }
  }

  // —— 标记「第一次可用产出」（各实验在自己 emit 产出的那一刻调用） ——
  markYield() {
    if (this.yielded) return;
    this.yielded = true;
    this.yieldAt = performance.now() - this.t0;
    if (this.tlYield) {
      // 第一次可用产出点放在「已用时间」对应的位置（流可能还没结束，
      // 用时间比例近似；流结束后再按总时长精修）
      this.tlYield.classList.add("show");
      this.placeYieldByElapsed();
    }
    if (this.log) {
      const row = document.createElement("div");
      row.className = "row first-yield";
      row.textContent = `★ 第一次可用产出 @ +${this.yieldAt.toFixed(0)}ms`;
      this.log.appendChild(row);
      this.log.scrollTop = this.log.scrollHeight;
    }
  }

  // 用「已逝去时间 / 当前预估总时长」放置 yield 点（流进行中用）
  placeYieldByElapsed() {
    // 简化：流进行中暂按 yieldAt 放在 track 的左半区，结束后再精修
    const track = this.timeline.querySelector(".tl-track");
    const w = track.clientWidth;
    // 先用 (yieldAt / max(yieldAt, received)) 不准，等 onEnd 用真实总时长修
    const pct = Math.min(95, (this.yieldAt / Math.max(this.yieldAt, 50)) * 8);
    this.tlYield.style.left = pct + "%";
  }

  // —— 流结束 ——
  markEnd() {
    const total = performance.now() - this.t0;
    if (this.tlReadout) {
      const yTxt = this.yielded
        ? `第一次可用产出 <strong>+${(this.yieldAt).toFixed(0)}ms</strong>（占总时长 ${(this.yieldAt / total * 100).toFixed(0)}%）`
        : "（未单独标记产出）";
      this.tlReadout.innerHTML = `流总时长 ${total.toFixed(0)}ms · ${yTxt}`;
    }
    // 流结束后，按真实总时长把 yield 点放准
    if (this.yielded && this.tlYield && this.timeline) {
      const pct = Math.min(98, Math.max(2, (this.yieldAt / total) * 100));
      this.tlYield.style.left = pct + "%";
      const label = document.createElement("span");
      label.className = "tl-label yield";
      label.textContent = `+${this.yieldAt.toFixed(0)}ms`;
      label.style.left = pct + "%";
      this.timeline.appendChild(label);
    }
    // 点亮并排对比区
    if (this.yielded) CompareSection.update(this.exp, this.yieldAt / total);
  }

  // —— 重置 ——
  reset() {
    if (this.abort) { try { this.abort.abort(); } catch (_) {} this.abort = null; }
    this.received = 0; this.total = 0; this.chunkCount = 0;
    this.yielded = false; this.yieldAt = null; this.buf = "";
    if (this.log) this.log.innerHTML = "";
    if (this.fill) this.fill.style.width = "0%";
    if (this.progressText) this.progressText.textContent = "0 / 0 B";
    if (this.output && this.exp === "1") {
      // 实验1：清掉 video
      URL.revokeObjectURL(this.output.src);
      this.output.removeAttribute("src");
      this.output.load();
    }
    if (this.output && this.exp === "2") {
      this.output.querySelector("tbody").innerHTML = "";
    }
    if (this.output && this.exp === "3a") {
      this.output.removeAttribute("src");
      this.output.load();
    }
    this.renderTimeline();
    this.btnStart.disabled = false;
  }

  // —— 启动（子类覆盖 run()） ——
  async start() {
    this.reset();
    this.btnStart.disabled = true;
    this.abort = new AbortController();
    try {
      await this.run();
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error(`[exp ${this.exp}]`, e);
        if (this.log) {
          const row = document.createElement("div");
          row.className = "row";
          row.style.color = "var(--end)";
          row.textContent = `出错: ${e.message}`;
          this.log.appendChild(row);
        }
      }
    } finally {
      this.btnStart.disabled = false;
    }
  }

  // 默认空实现，子类覆盖
  async run() {}
}

/* ═══════════════════ 实验 0 · 控制实验 ═══════════════════ */
class Exp0 extends Card {
  async run() {
    this.peek = "hex"; // mp4 字节 → hex+ASCII，盯着 ftyp 魔数
    const ctSelect = this.root.querySelector("#exp0-ct");
    const ct = ctSelect.value;
    const res = await fetch(`/same-bytes?ct=${encodeURIComponent(ct)}&speed=${this.speed}`, {
      signal: this.abort.signal,
    });
    // 头一到这里就拿到了 —— 先显示出来
    const gotCt = res.headers.get("content-type");
    if (this.ct) this.ct.textContent = gotCt || "(null)";

    const total = Number(res.headers.get("content-length")) || 0;
    this.markStart(total);

    for await (const chunk of res.body) {
      this.onChunkArrive(chunk);
      // 实验 0：不做任何消费，只 log —— 证明「到达方式相同」
    }
    this.markEnd();
  }
}

/* ═══════════════════ 实验 1 · 缓冲式（.blob 路线） ═══════════════════ */
class Exp1 extends Card {
  async run() {
    this.peek = "hex"; // 同实验0，mp4 字节
    const res = await fetch(`/api/blob?speed=${this.speed}`, {
      signal: this.abort.signal,
    });
    const total = Number(res.headers.get("content-length")) || 0;
    this.markStart(total);

    const chunks = [];
    for await (const chunk of res.body) {
      this.onChunkArrive(chunk);
      chunks.push(chunk);          // 攒着……什么都不干
      // 注意：这里【故意不】 markYield —— 缓冲式必须等流结束
    }

    // —— 流到这里才结束 ——
    const blob = new Blob(chunks, { type: "video/mp4" });
    const url = URL.createObjectURL(blob);
    this.output.src = url;          // 此刻才能播
    this.markYield();               // 「第一次可用产出」= 流结束
    this.markEnd();
  }
}

/* ═══════════════════ 实验 2 · 增量解析式（NDJSON） ═══════════════════ */
class Exp2 extends Card {
  async run() {
    this.peek = "text"; // 文本流 → 直接显示 UTF-8 片段，看得见跨 chunk 切分
    const res = await fetch(`/api/ndjson?speed=${this.speed}`, {
      signal: this.abort.signal,
    });
    const total = Number(res.headers.get("content-length")) || 0;
    this.markStart(total);

    const dec = new TextDecoder();
    const tbody = this.output.querySelector("tbody");
    let n = 0;

    for await (const chunk of res.body) {
      this.onChunkArrive(chunk);
      // 关键：把这块拼进跨 chunk 缓冲，再按 \n 切
      this.buf += dec.decode(chunk, { stream: true });
      let idx;
      while ((idx = this.buf.indexOf("\n")) !== -1) {
        const line = this.buf.slice(0, idx).trim();
        this.buf = this.buf.slice(idx + 1);
        if (!line) continue;
        const rec = JSON.parse(line);
        n++;
        const tr = document.createElement("tr");
        tr.innerHTML =
          `<td>${n}</td><td>${rec.id}</td><td>${rec.name}</td>` +
          `<td>${rec.class}</td><td>${rec.score}</td>`;
        tbody.appendChild(tr);
        // 滚动到底，让「一条一条蹦出来」看得见
        this.output.parentElement.scrollTop = this.output.parentElement.scrollHeight;
        // —— 切出第一行就立刻 emit，这就是「第一次可用产出」——
        this.markYield();
      }
    }
    this.buf += dec.decode(); // flush
    this.markEnd();
  }
}

/* ═══════════════════ 实验 3a · 浏览器内置消费者 ═══════════════════ */
// 这张卡片的流由浏览器接管，JS 读不到 chunk —— 这恰恰是文档 Layer 4
// 要演示的现象：「浏览器为少数场景内置了专门的消费者，看起来像自动，
// 本质还是上层在消费同一个字节流」。所以我们不 for await，只把 src
// 交给 <video>，然后靠轮询 resource timing + canplay 事件来标记时间线。
class Exp3a extends Card {
  async run() {
    const video = this.output;
    const src = `/raw?speed=${this.speed}&_=${Date.now()}`;
    // 总长度已知（同源文件固定）
    this.markStart(548957);

    // canplay：浏览器攒够头几个 chunk、能开始播了 → 这就是「第一次可用产出」
    const onCanPlay = () => {
      this.markYield();
    };
    video.addEventListener("canplay", onCanPlay, { once: true });

    // 监听传输进度（浏览器自管的 Range 流，用 performance API 估）
    const poll = setInterval(() => {
      const entries = performance.getEntriesByName(src, "resource");
      if (entries.length) {
        const e = entries[entries.length - 1];
        // transferSize 在 206 + no-store 下可能为 0，退而用 duration 估
        const pct = this.total ? Math.min(100, (e.duration / 50) * 1) : 0;
        // 进度条只能粗略体现「在流动」
        if (this.fill) this.fill.style.width = Math.max(this.received ? 100 : 40, 0) + "%";
      }
    }, 200);
    this._poll = poll;

    video.src = src;

    // 等 video 把流「消费完」（loadeddata 表示首帧，等播放或 ended 当结束近似）
    const done = new Promise((resolve) => {
      const finish = () => {
        clearInterval(poll);
        resolve();
      };
      // 用 progress 事件粗略估结束；loadeddata 后给个保底
      video.addEventListener("loadeddata", () => {
        // 给一点时间让 markYield(canplay) 先触发
        setTimeout(finish, 300);
      }, { once: true });
    });
    await done;
    this.markEnd();
  }

  reset() {
    if (this._poll) clearInterval(this._poll);
    super.reset();
  }
}

/* ═══════════════════ 并排对比区 ═══════════════════ */
const CompareSection = {
  // 记录各实验 yield 点占总时长的比例
  ratios: {},
  update(exp, ratio) {
    this.ratios[exp] = ratio;
    const el = document.getElementById(`cmp-${exp}`);
    if (!el) return;
    el.classList.add("active");
    // 清掉旧的静态文案，加一个 marker
    let marker = el.querySelector(".cmp-marker");
    if (!marker) {
      marker = document.createElement("span");
      marker.className = "cmp-marker";
      el.appendChild(marker);
    }
    // 把 marker 放在比例位置（留出两端 padding）
    const pct = 4 + ratio * 92;
    marker.style.left = pct + "%";
  },
};

/* ═══════════════════ 启动：实例化所有卡片 ═══════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".card").forEach((el) => {
    const exp = el.dataset.exp;
    switch (exp) {
      case "0":  new Exp0(el); break;
      case "1":  new Exp1(el); break;
      case "2":  new Exp2(el); break;
      case "3a": new Exp3a(el); break;
    }
  });
});
