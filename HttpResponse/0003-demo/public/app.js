/**
 * SSE vs 普通流式响应 · 客户端
 * 配套：docs/0003-SSE响应和普通流响应.md
 */

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

class DemoCard {
  constructor(root) {
    this.root = root;
    this.mode = root.dataset.mode;
    this.output = root.querySelector('[data-role="output"]');
    this.log = root.querySelector('[data-role="log"]');
    this.speedSelect = root.querySelector(".speed-select");
    this.btnStart = root.querySelector(".btn-start");
    this.btnReset = root.querySelector(".btn-reset");

    this.es = null;
    this.abort = null;
    this.t0 = 0;
    this.eventCount = 0;

    this.btnStart.addEventListener("click", () => this.start());
    this.btnReset.addEventListener("click", () => this.reset());
  }

  get speed() {
    return this.speedSelect.value;
  }

  reset() {
    if (this.es) {
      this.es.close();
      this.es = null;
    }
    if (this.abort) {
      try { this.abort.abort(); } catch (_) {}
      this.abort = null;
    }
    this.output.textContent = "";
    this.log.innerHTML = "";
    this.eventCount = 0;
    this.btnStart.disabled = false;
  }

  logLine(html) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = html;
    this.log.appendChild(row);
    this.log.scrollTop = this.log.scrollHeight;
  }

  async start() {
    this.reset();
    this.btnStart.disabled = true;
    this.t0 = performance.now();

    try {
      if (this.mode === "sse") {
        await this.runSse();
      } else {
        await this.runStream();
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        this.logLine(`<span class="err">出错: ${escapeHtml(e.message)}</span>`);
      }
    } finally {
      this.btnStart.disabled = false;
    }
  }

  runSse() {
    return new Promise((resolve, reject) => {
      const url = `/api/sse?speed=${this.speed}&_=${Date.now()}`;
      this.es = new EventSource(url);

      this.es.onopen = () => {
        const ms = (performance.now() - this.t0).toFixed(0);
        this.logLine(`<span class="meta">#${++this.eventCount} · open · +${ms}ms</span>`);
      };

      this.es.onmessage = (e) => {
        const ms = (performance.now() - this.t0).toFixed(0);
        let token = "";
        try {
          token = JSON.parse(e.data).token;
        } catch {
          token = e.data;
        }
        this.output.textContent += token;
        this.logLine(
          `<span class="idx">#${++this.eventCount}</span> ` +
          `<span class="meta">+${ms}ms</span> ` +
          `<code>data: ${escapeHtml(e.data)}</code>`
        );
      };

      this.es.addEventListener("done", () => {
        const ms = (performance.now() - this.t0).toFixed(0);
        this.logLine(`<span class="done">event: done · +${ms}ms · 连接关闭</span>`);
        this.es.close();
        this.es = null;
        resolve();
      });

      this.es.onerror = () => {
        if (this.es && this.es.readyState === EventSource.CLOSED) {
          resolve();
        } else {
          reject(new Error("EventSource 连接异常"));
        }
      };
    });
  }

  async runStream() {
    this.abort = new AbortController();
    const res = await fetch(`/api/stream?speed=${this.speed}&_=${Date.now()}`, {
      signal: this.abort.signal,
    });

    const dec = new TextDecoder();
    let text = "";
    let chunkIdx = 0;

    for await (const chunk of res.body) {
      chunkIdx++;
      const ms = (performance.now() - this.t0).toFixed(0);
      const part = dec.decode(chunk, { stream: true });
      text += part;
      this.output.textContent = text;

      const preview = escapeHtml(part.replace(/\n/g, "\\n"));
      this.logLine(
        `<span class="idx">chunk #${chunkIdx}</span> ` +
        `<span class="meta">${fmtBytes(chunk.byteLength)} · +${ms}ms</span> ` +
        `<code>"${preview}"</code>`
      );
    }
    dec.decode();
    const ms = (performance.now() - this.t0).toFixed(0);
    this.logLine(`<span class="done">流结束 · +${ms}ms · 共 ${chunkIdx} 个 chunk</span>`);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".card").forEach((el) => new DemoCard(el));
});
