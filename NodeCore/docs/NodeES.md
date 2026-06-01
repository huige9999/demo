下面我带你从**第一性原理 + Node 实战规则**过一遍 Node 里的 ES 模块化。

---

# 1. 先抓住本质：模块化解决什么问题？

没有模块化时，所有 JS 都像写在一个大文件里：

```js
const name = 'vichel'

function add(a, b) {
  return a + b
}
```

问题是：

1. 变量容易冲突；
2. 文件之间依赖关系不清晰；
3. 复用困难；
4. 加载顺序容易乱。

所以模块化的本质是：

> **一个文件就是一个独立作用域，并且可以显式暴露能力、显式引入依赖。**

Node 里最早用的是 **CommonJS**：

```js
const fs = require('fs')

module.exports = {
  foo: 123
}
```

后来 JS 官方标准推出了 **ES Modules / ESM**：

```js
import fs from 'node:fs'

export const foo = 123
```

Node 现在同时支持 CommonJS 和 ESM。CommonJS 是 Node 原来的模块系统；ESM 是浏览器和现代 JS 统一的标准模块系统。Node 官方文档也把 ESM 称为 JavaScript 代码复用的官方标准格式。([Node.js][1])

---

# 2. Node 怎么判断一个文件是 ESM 还是 CommonJS？

这是 Node ESM 最容易混的地方。

Node 主要看两个东西：

## 方式一：看文件后缀

```txt
index.mjs  => 一定按 ESM 处理
index.cjs  => 一定按 CommonJS 处理
```

所以你可以直接写：

```js
// index.mjs
import { add } from './math.mjs'

console.log(add(1, 2))
```

```js
// math.mjs
export function add(a, b) {
  return a + b
}
```

---

## 方式二：看 package.json 的 `"type"`

如果你的项目里写：

```json
{
  "type": "module"
}
```

那么：

```txt
.js => 默认按 ESM 处理
```

也就是说：

```js
// index.js
import { add } from './math.js'
```

可以正常运行。

如果你写：

```json
{
  "type": "commonjs"
}
```

或者不写 `type`，大多数普通 `.js` 文件会按 CommonJS 处理。Node 的 package 文档明确说明，`package.json` 会影响包内文件的模块系统判断。([Node.js][2])

实际建议：

```json
{
  "type": "module",
  "scripts": {
    "start": "node src/index.js"
  }
}
```

现代新项目可以优先这么写。

---

# 3. ESM 的基本导出：export

ESM 导出分两类：

## 命名导出

```js
// math.js
export const count = 1

export function add(a, b) {
  return a + b
}

export class Person {}
```

引入时：

```js
import { count, add, Person } from './math.js'

console.log(add(1, 2))
```

你也可以先定义，最后统一导出：

```js
const count = 1

function add(a, b) {
  return a + b
}

export {
  count,
  add
}
```

这个更适合写库，因为出口集中，清晰。

---

## 默认导出

```js
// logger.js
export default function logger(msg) {
  console.log(msg)
}
```

引入：

```js
import logger from './logger.js'

logger('hello')
```

默认导出的名字由引入方自己决定：

```js
import abc from './logger.js'
import myLogger from './logger.js'
```

都可以。

---

# 4. 命名导出 vs 默认导出怎么选？

你可以这样记：

## 命名导出：适合多个能力

```js
// utils.js
export function formatDate() {}

export function formatMoney() {}

export function sleep() {}
```

使用：

```js
import { formatDate, sleep } from './utils.js'
```

优点是清晰、可静态分析、IDE 提示好。

---

## 默认导出：适合一个文件主要就干一件事

```js
// createApp.js
export default function createApp() {}
```

使用：

```js
import createApp from './createApp.js'
```

但我个人建议你在业务代码里多用**命名导出**，少用默认导出。

因为命名导出更利于：

1. 重构；
2. 搜索；
3. 自动导入；
4. 避免乱起名。

例如：

```js
import xxx from './userService.js'
```

你不知道 `xxx` 到底是什么。

而：

```js
import { getUserList } from './userService.js'
```

一眼就知道。

---

# 5. ESM 的 import 语法

## 引入命名导出

```js
import { add } from './math.js'
```

## 引入默认导出

```js
import logger from './logger.js'
```

## 同时引入默认导出和命名导出

```js
import logger, { level } from './logger.js'
```

对应导出：

```js
export const level = 'info'

export default function logger() {}
```

---

## 起别名

```js
import { add as sum } from './math.js'

console.log(sum(1, 2))
```

---

## 整体引入

```js
import * as math from './math.js'

console.log(math.add(1, 2))
console.log(math.count)
```

这就像把模块暴露出来的所有命名导出收进一个对象里。

---

## 只执行模块，不拿导出

```js
import './setup.js'
```

适合初始化逻辑：

```js
// setup.js
console.log('初始化环境变量')
```

比如：

```js
import 'dotenv/config'
```

---

# 6. Node ESM 最大的坑：相对路径必须写完整后缀

在前端 Vite / Webpack 里你可能经常写：

```js
import { add } from './math'
```

但在 Node 原生 ESM 里，通常要写：

```js
import { add } from './math.js'
```

否则容易报错。

这是因为 Node 原生 ESM 更接近浏览器模块解析规则，不会像打包工具那样帮你自动补全。

所以：

```js
import { add } from './math.js'
```

而不是：

```js
import { add } from './math'
```

目录索引也不要想当然：

```js
// 不推荐指望 Node 自动找 ./utils/index.js
import { foo } from './utils/index.js'
```

---

# 7. Node 内置模块推荐加 `node:` 前缀

以前 CommonJS 里：

```js
const fs = require('fs')
```

ESM 里可以写：

```js
import fs from 'fs'
```

但现在更推荐写：

```js
import fs from 'node:fs'
import path from 'node:path'
```

或者：

```js
import { readFile } from 'node:fs/promises'
```

这样一眼能看出这是 Node 内置模块，不是 npm 包。

Node 官方文档里的文件系统模块也同时展示了 ESM 和 CommonJS 两种用法。([Node.js][3])

---

# 8. ESM 中没有 CommonJS 的这些东西

在 CommonJS 中你有：

```js
__dirname
__filename
require
module
exports
```

但在 ESM 中，这些默认没有。

比如你写：

```js
console.log(__dirname)
```

会报错。

ESM 里要这样拿当前文件路径：

```js
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log(__filename)
console.log(__dirname)
```

你可以先不用背，记住一句话：

> **CommonJS 的文件环境变量，在 ESM 里要通过 `import.meta.url` 自己还原。**

---

# 9. import.meta.url 是什么？

在浏览器里，一个模块本质上是一个 URL。

在 Node ESM 里也延续这个模型。

```js
console.log(import.meta.url)
```

可能输出：

```txt
file:///Users/vichel/project/src/index.js
```

它不是普通路径，而是一个 `file://` URL。

所以要转成普通文件路径：

```js
import { fileURLToPath } from 'node:url'

const filename = fileURLToPath(import.meta.url)
```

---

# 10. ESM 是静态结构，CommonJS 是运行时结构

这是理解 ESM 的关键。

CommonJS：

```js
const name = './math.js'

const math = require(name)
```

可以运行时决定加载谁。

甚至：

```js
if (true) {
  const fs = require('fs')
}
```

而 ESM 的静态 import 必须写在顶层：

```js
import { add } from './math.js'
```

不能这样：

```js
if (true) {
  import { add } from './math.js' // 错
}
```

为什么？

因为 ESM 的设计目标是：

> 在代码执行前，就能知道模块依赖图。

这样有利于：

1. 静态分析；
2. tree-shaking；
3. 循环依赖处理；
4. 浏览器预加载；
5. 工具链优化。

---

# 11. 那 ESM 想动态加载怎么办？

用动态 import：

```js
const math = await import('./math.js')

console.log(math.add(1, 2))
```

它返回一个 Promise。

可以配合条件：

```js
if (process.env.NODE_ENV === 'development') {
  const devTools = await import('./dev-tools.js')
  devTools.start()
}
```

这就类似 CommonJS 的运行时加载能力。

---

# 12. ESM 支持顶层 await

在 ESM 文件中可以直接写：

```js
const data = await fetch('https://example.com')

console.log(await data.text())
```

不需要包一层：

```js
async function main() {}
main()
```

例如 Node 脚本里：

```js
import { readFile } from 'node:fs/promises'

const content = await readFile('./package.json', 'utf-8')

console.log(content)
```

这在 CommonJS 里不能直接这么写。

---

# 13. ESM 和 CommonJS 的导出差异

CommonJS 导出的是一个对象：

```js
// math.cjs
function add(a, b) {
  return a + b
}

module.exports = {
  add
}
```

使用：

```js
const { add } = require('./math.cjs')
```

ESM 是显式导出绑定：

```js
// math.js
export function add(a, b) {
  return a + b
}
```

使用：

```js
import { add } from './math.js'
```

这里有个重要概念：

> ESM 的导出是 live binding，不是简单拷贝值。

例如：

```js
// counter.js
export let count = 0

export function inc() {
  count++
}
```

```js
// index.js
import { count, inc } from './counter.js'

console.log(count) // 0
inc()
console.log(count) // 1
```

`count` 会跟着模块内部变化。

但注意，导入方不能直接改：

```js
import { count } from './counter.js'

count++ // 报错
```

你可以理解为：

> 我拿到的是对模块内部变量的只读观察窗口。

---

# 14. Node ESM 如何引入 CommonJS？

假设有一个 CommonJS 文件：

```js
// legacy.cjs
module.exports = {
  name: 'legacy',
  say() {
    console.log('hello')
  }
}
```

在 ESM 中可以这样引入：

```js
import legacy from './legacy.cjs'

console.log(legacy.name)
legacy.say()
```

因为 CommonJS 的 `module.exports` 会作为默认导出给 ESM 使用。

---

# 15. CommonJS 如何引入 ESM？

这个方向更麻烦。

CommonJS 不能直接：

```js
const mod = require('./esm.js')
```

更通用的方式是用动态 import：

```js
// index.cjs
async function main() {
  const mod = await import('./esm.js')
  console.log(mod.add(1, 2))
}

main()
```

所以迁移时一般建议：

> 新项目全 ESM；老项目 CommonJS 就先别混太深。真要混，用 `.cjs` / `.mjs` 明确边界。

---

# 16. package.json 里的 exports 是什么？

你写业务项目时不一定马上用，但做 npm 包时很重要。

以前一个包可能这样被使用：

```js
import lodash from 'lodash'
import debounce from 'lodash/debounce'
```

也就是别人可以随便访问你包里的内部路径。

现在可以通过 `exports` 控制对外入口：

```json
{
  "name": "my-lib",
  "type": "module",
  "exports": {
    ".": "./src/index.js",
    "./utils": "./src/utils/index.js"
  }
}
```

别人只能这样用：

```js
import { foo } from 'my-lib'
import { bar } from 'my-lib/utils'
```

不能随便：

```js
import xxx from 'my-lib/src/internal/xxx.js'
```

你可以把 `exports` 理解为：

> 包的公共 API 白名单。

Node 的 package 文档专门说明了 `package.json` 字段对包和模块系统的影响。([Node.js][2])

---

# 17. package.json 里的 imports 是什么？

`imports` 是给包内部用的路径别名。

例如：

```json
{
  "type": "module",
  "imports": {
    "#utils/*": "./src/utils/*.js"
  }
}
```

内部文件可以写：

```js
import { sleep } from '#utils/sleep.js'
```

它有个特点：通常以 `#` 开头。

你可以理解为 Node 原生版 alias。

不过在普通业务项目中，很多人还是靠 TypeScript / Vite / tsconfig paths 做 alias。Node 原生跑的时候要特别注意二者是否一致。

---

# 18. 最小实战：创建一个 Node ESM 项目

目录：

```txt
node-esm-demo
├─ package.json
└─ src
   ├─ index.js
   ├─ math.js
   └─ file.js
```

`package.json`：

```json
{
  "name": "node-esm-demo",
  "type": "module",
  "scripts": {
    "start": "node src/index.js"
  }
}
```

`src/math.js`：

```js
export function add(a, b) {
  return a + b
}

export function multiply(a, b) {
  return a * b
}
```

`src/file.js`：

```js
import { readFile } from 'node:fs/promises'

export async function readPackageJson() {
  return readFile('./package.json', 'utf-8')
}
```

`src/index.js`：

```js
import { add, multiply } from './math.js'
import { readPackageJson } from './file.js'

console.log(add(1, 2))
console.log(multiply(2, 3))

const content = await readPackageJson()
console.log(content)
```

运行：

```bash
npm start
```

---

# 19. TypeScript 里怎么配？

如果你写 Node + TS，现在常见配置是：

`package.json`：

```json
{
  "type": "module"
}
```

`tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "strict": true
  }
}
```

为什么是 `NodeNext`？

因为 Node 的 ESM 规则和浏览器、打包工具不完全一样，尤其是：

1. `.js` 后缀；
2. `package.json` 的 `type`；
3. `.cjs` / `.mjs`；
4. `exports` / `imports`。

`NodeNext` 会让 TypeScript 更贴近 Node 原生模块解析。

---

# 20. 你最容易遇到的几个报错

## 报错一：Cannot use import statement outside a module

一般是因为 Node 把你的 `.js` 当 CommonJS 了。

解决：

```json
{
  "type": "module"
}
```

或者文件改成：

```txt
index.mjs
```

---

## 报错二：ReferenceError: require is not defined in ES module scope

你在 ESM 里写了：

```js
const fs = require('fs')
```

改成：

```js
import fs from 'node:fs'
```

或者：

```js
import { readFile } from 'node:fs/promises'
```

---

## 报错三：__dirname is not defined

ESM 里没有 `__dirname`。

改成：

```js
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
```

---

## 报错四：Cannot find module './xxx'

可能是你少写了后缀。

错误：

```js
import { add } from './math'
```

正确：

```js
import { add } from './math.js'
```

---

# 21. 用一句话对比 CommonJS 和 ESM

CommonJS：

```js
const x = require('x')
module.exports = {}
```

特点：

> Node 早期方案，运行时加载，灵活，但静态分析弱。

ESM：

```js
import x from 'x'
export {}
```

特点：

> JavaScript 官方标准，静态结构，适合现代工具链、浏览器、Node 统一生态。

---

# 22. 你作为前端开发者怎么记？

你可以这样建立心智模型：

## 在浏览器 / Vite 里

你写：

```js
import App from './App.vue'
import { createApp } from 'vue'
```

这是前端工程化帮你处理后的体验。

---

## 在 Node 原生 ESM 里

你写的是更底层、更严格的模块路径：

```js
import { createServer } from 'node:http'
import { add } from './math.js'
```

注意两个点：

1. Node 内置模块加 `node:`；
2. 本地相对路径加 `.js` 后缀。

---

# 23. 最后给你一个实战判断口诀

以后你看到一个 Node 项目，先看这三个东西：

```txt
1. package.json 里有没有 "type": "module"
2. 文件后缀是 .js / .mjs / .cjs
3. 代码里用的是 import/export 还是 require/module.exports
```

判断规则：

```txt
.mjs              => ESM
.cjs              => CommonJS
.js + type module => ESM
.js + 无 type      => 多数情况下 CommonJS
.js + type commonjs => CommonJS
```

日常新项目建议：

```txt
Node 新项目：type: module + import/export
老项目维护：尊重原来的 CommonJS，不要随便混
写工具库：认真设计 exports
写 TS Node 项目：module/moduleResolution 用 NodeNext
```

最小记忆版：

```js
// ESM 导入
import { readFile } from 'node:fs/promises'
import { add } from './math.js'

// ESM 导出
export function add(a, b) {
  return a + b
}

// 默认导出
export default function main() {}
```

你先把这个掌握住，Node ESM 的主线就通了。

[1]: https://nodejs.org/api/esm.html?utm_source=chatgpt.com "ECMAScript modules | Node.js v25.8.1 Documentation"
[2]: https://nodejs.org/api/packages.html?utm_source=chatgpt.com "Modules: Packages | Node.js v25.8.1 Documentation"
[3]: https://nodejs.org/api/fs.html?utm_source=chatgpt.com "File system | Node.js v25.8.1 Documentation"
