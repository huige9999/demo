Node 的“全局对象”可以理解为：**不用 import / require，任何模块里都能直接访问的运行时能力**。

但注意：Node 里有两类容易混在一起：

1. **真正的全局对象**：比如 `globalThis`、`process`、`Buffer`、`setTimeout`
2. **模块包装后注入的变量**：比如 `__dirname`、`__filename`、`module`、`exports`、`require`

---

## 1. 浏览器里的全局对象是 `window`

前端里你很熟：

```js
console.log(window)
console.log(document)
console.log(location)
console.log(localStorage)

var a = 1
console.log(window.a) // 浏览器非模块脚本里可能是 1
```

浏览器的核心运行环境是：

```txt
window
 ├── document
 ├── location
 ├── navigator
 ├── localStorage
 ├── setTimeout
 └── console
```

所以前端写代码时，很多东西看起来“不用引入”，其实是挂在 `window` 上。

---

## 2. Node 里的全局对象以前主要叫 `global`

Node 没有浏览器的 `window`，它的老牌全局对象是：

```js
console.log(global)
```

例如：

```js
global.name = 'vichel'

console.log(global.name) // vichel
```

它类似浏览器里的：

```js
window.name = 'vichel'
```

所以可以粗暴类比：

```txt
浏览器：window
Node：global
```

---

## 3. 现在更推荐记住 `globalThis`

因为不同环境的全局对象名字不一样：

```txt
浏览器：window
Node：global
Web Worker：self
统一写法：globalThis
```

所以现代 JS 里更推荐：

```js
console.log(globalThis)
```

在 Node 里：

```js
console.log(globalThis === global) // true
```

在浏览器里：

```js
console.log(globalThis === window) // true
```

所以你可以把 `globalThis` 理解成：**JS 官方给不同运行环境统一出来的“全局对象入口”**。

---

## 4. Node 常见真正全局对象

### `console`

这个你最熟：

```js
console.log('hello node')
console.error('error')
console.table([{ name: 'a' }, { name: 'b' }])
```

浏览器和 Node 都有 `console`，但底层输出目标不同：

```txt
浏览器 console → DevTools 控制台
Node console → 终端 stdout / stderr
```

---

### `process`

这是 Node 非常核心的全局对象。

它代表：**当前 Node 进程的信息和控制能力**。

常见用法：

```js
console.log(process.version)      // Node 版本
console.log(process.platform)     // win32 / linux / darwin
console.log(process.cwd())        // 当前命令执行目录
console.log(process.env.NODE_ENV) // 环境变量
console.log(process.argv)         // 命令行参数
```

比如你执行：

```bash
node app.js hello world
```

代码：

```js
console.log(process.argv)
```

大概输出：

```js
[
  '/usr/local/bin/node',
  '/xxx/app.js',
  'hello',
  'world'
]
```

你可以把 `process` 理解成：

```txt
Node 程序和操作系统之间的桥
```

前端里没有这个东西，因为浏览器不允许网页随便读系统进程、环境变量。

---

### `Buffer`

`Buffer` 是 Node 处理二进制数据的对象。

比如文件、图片、网络流，本质都不是字符串，而是字节。

```js
const buf = Buffer.from('hello')

console.log(buf)
// <Buffer 68 65 6c 6c 6f>

console.log(buf.toString())
// hello
```

你可以把它理解成：

```txt
字符串：给人看的文本
Buffer：给机器处理的字节
```

做文件上传、图片处理、网络通信、加密解密时经常会遇到。

---

### 定时器：`setTimeout` / `setInterval` / `setImmediate`

Node 也有：

```js
setTimeout(() => {
  console.log('1 秒后执行')
}, 1000)
```

```js
setInterval(() => {
  console.log('每秒执行')
}, 1000)
```

Node 特有一个比较常见的：

```js
setImmediate(() => {
  console.log('当前事件循环后尽快执行')
})
```

另外还有：

```js
process.nextTick(() => {
  console.log('当前同步代码之后，事件循环之前')
})
```

简单记忆：

```txt
setTimeout(fn, 0)：下轮事件循环的 timer 阶段
setImmediate(fn)：当前轮事件循环后面阶段
process.nextTick(fn)：当前同步任务结束后马上插队执行
```

刚入门不需要过度纠结事件循环细节，知道它们都是异步调度工具即可。

---

### `queueMicrotask`

Node 里也支持微任务：

```js
queueMicrotask(() => {
  console.log('microtask')
})

console.log('sync')
```

输出：

```txt
sync
microtask
```

和浏览器里的微任务概念接近。

---

### `URL` / `URLSearchParams`

Node 里也有这些 Web 标准对象：

```js
const url = new URL('https://example.com/list?page=1&size=10')

console.log(url.hostname)
// example.com

console.log(url.searchParams.get('page'))
// 1
```

这类对象浏览器和 Node 都能用。

---

### `fetch`

现代 Node 也内置了 `fetch`：

```js
const res = await fetch('https://example.com')
const text = await res.text()

console.log(text)
```

以前 Node 请求接口常用 `axios`、`node-fetch`，现在简单场景直接用内置 `fetch` 也可以。

---

## 5. 容易误解的：`__dirname` 和 `__filename`

这两个经常被说成“全局变量”，但严格讲，它们不是挂在 `global` 上的真正全局对象。

它们是 CommonJS 模块包装时注入进来的变量。

```js
console.log(__dirname)
console.log(__filename)
```

假设文件路径是：

```txt
/Users/vichel/project/src/app.js
```

那么：

```js
console.log(__dirname)
// /Users/vichel/project/src

console.log(__filename)
// /Users/vichel/project/src/app.js
```

记忆：

```txt
__dirname：当前文件所在目录
__filename：当前文件完整路径
```

它们非常常用于读文件：

```js
const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, 'data.txt')
const content = fs.readFileSync(filePath, 'utf-8')

console.log(content)
```

---

## 6. `require`、`module`、`exports` 也不是严格全局对象

CommonJS 里你可以直接写：

```js
const fs = require('fs')

module.exports = {
  name: 'vichel'
}

exports.age = 18
```

它们看起来像全局变量，但其实也是 Node 对每个模块做了一层包装。

Node 大致会把你的代码包成这样：

```js
(function (exports, require, module, __filename, __dirname) {
  // 你的模块代码
})
```

所以这些东西是“模块作用域变量”，不是 `global.xxx`。

验证一下：

```js
console.log(global.require)
// undefined 或不建议依赖

console.log(typeof require)
// function
```

这也是你之前学 TS / CommonJS 时容易混乱的点：
**CommonJS 模块不是浏览器里那种直接丢到全局，而是 Node 给每个文件包了一层函数作用域。**

---

## 7. CommonJS 里的模块级变量关系

### `module.exports`

真正导出的对象是：

```js
module.exports
```

例如：

```js
// a.js
module.exports = {
  name: 'vichel',
  sayHi() {
    console.log('hi')
  }
}
```

```js
// main.js
const a = require('./a')

console.log(a.name)
a.sayHi()
```

---

### `exports`

`exports` 默认只是 `module.exports` 的快捷引用：

```js
console.log(exports === module.exports) // true
```

所以这样可以：

```js
exports.name = 'vichel'
exports.sayHi = function () {
  console.log('hi')
}
```

但这样不行：

```js
exports = {
  name: 'vichel'
}
```

因为你只是让 `exports` 这个局部变量指向了新对象，没改到真正导出的 `module.exports`。

正确写法是：

```js
module.exports = {
  name: 'vichel'
}
```

---

## 8. ESM 里没有 `__dirname`、`__filename`、`require`

如果你用的是 ES Module：

```json
{
  "type": "module"
}
```

或者文件名是：

```txt
index.mjs
```

那么这些不能直接用：

```js
console.log(__dirname)  // 报错
console.log(__filename) // 报错
const fs = require('fs') // 报错
```

ESM 中要这样拿当前文件路径：

```js
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log(__filename)
console.log(__dirname)
```

ESM 里当前模块的信息来自：

```js
import.meta.url
```

例如：

```js
console.log(import.meta.url)
```

可能输出：

```txt
file:///Users/vichel/project/src/index.js
```

---

## 9. Node 全局对象速查表

| 名称                | 类型            | 作用                    |
| ----------------- | ------------- | --------------------- |
| `global`          | 真全局对象         | Node 的全局对象            |
| `globalThis`      | 真全局对象         | 跨环境统一全局对象             |
| `console`         | 真全局对象         | 日志输出                  |
| `process`         | 真全局对象         | 当前 Node 进程信息          |
| `Buffer`          | 真全局对象         | 处理二进制数据               |
| `setTimeout`      | 真全局对象         | 延迟执行                  |
| `setInterval`     | 真全局对象         | 间隔执行                  |
| `setImmediate`    | 真全局对象         | 当前事件循环后执行             |
| `queueMicrotask`  | 真全局对象         | 添加微任务                 |
| `URL`             | 真全局对象         | URL 解析                |
| `URLSearchParams` | 真全局对象         | 查询参数处理                |
| `fetch`           | 真全局对象         | 网络请求                  |
| `__dirname`       | CommonJS 注入变量 | 当前文件目录                |
| `__filename`      | CommonJS 注入变量 | 当前文件完整路径              |
| `require`         | CommonJS 注入变量 | 引入模块                  |
| `module`          | CommonJS 注入变量 | 当前模块对象                |
| `exports`         | CommonJS 注入变量 | `module.exports` 快捷引用 |

---

## 10. 和前端最重要的区别

浏览器里：

```txt
JS 运行在网页沙箱里
核心对象是 window
能操作 DOM、BOM、浏览器存储
不能直接操作文件系统和进程
```

Node 里：

```txt
JS 运行在操作系统进程里
核心对象是 global / globalThis
能操作文件、网络、进程、环境变量
没有 DOM、没有 window、没有 document
```

所以：

```js
console.log(window)   // Node 里报错
console.log(document) // Node 里报错
```

Node 里没有：

```js
window
document
localStorage // 严格说 Node 不是浏览器环境
alert
location
navigator // 部分现代 Node 可能有兼容性对象，但不要按浏览器方式依赖
```

---

## 11. 你最该掌握的几个

按实战优先级，我建议你先重点记这些：

```txt
第一梯队：
process
__dirname
__filename
require
module.exports
Buffer

第二梯队：
globalThis
setTimeout / setInterval
URL / URLSearchParams
fetch

第三梯队：
setImmediate
process.nextTick
queueMicrotask
```

尤其是全栈、脚手架、工程化里，最常见的是：

```js
process.cwd()
process.env
__dirname
path.join()
module.exports
Buffer
```

例如读取项目根目录配置：

```js
const path = require('path')
const fs = require('fs')

const configPath = path.join(process.cwd(), 'config.json')

if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  console.log(config)
}
```

这里有两个路径概念非常关键：

```txt
process.cwd()：你在哪个目录执行 node 命令
__dirname：当前 JS 文件所在目录
```

举个例子：

```txt
项目结构：
project
 ├── scripts
 │    └── read.js
 └── config.json
```

你在 `project` 目录执行：

```bash
node scripts/read.js
```

那么：

```js
console.log(process.cwd())
// /xxx/project

console.log(__dirname)
// /xxx/project/scripts
```

这个区别在写 CLI、脚手架、构建工具时非常重要。

---

## 12. 一句话总结

Node 全局对象可以这样理解：

```txt
global / globalThis 是 Node 的全局入口；
process 让 JS 能感知和控制当前进程；
Buffer 让 JS 能处理二进制；
__dirname / __filename / require / module / exports 是 CommonJS 给每个文件注入的模块能力；
Node 没有 window / document，因为它不是浏览器，而是跑在操作系统上的 JS 运行时。
```

你只要先把这条主线抓住，后面学 Node 文件系统、CLI、NestJS、工程化脚本都会顺很多。
