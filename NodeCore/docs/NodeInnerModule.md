可以。你可以把 **Node 内置模块**理解成：

> Node.js 自带的一组“标准工具箱”，不需要 `npm install`，直接 `import` / `require` 就能用。

它们主要解决这些事：

```txt
文件读写
路径处理
操作系统信息
命令行参数
网络服务
加密
压缩
事件机制
流式处理
子进程
```

下面我按“前端开发最常用 / 最值得先掌握”的顺序带你过一遍。

---

# 1. fs：文件系统模块

`fs` 是 Node 里最核心的模块之一，用来操作文件和目录。

前端工程里很多工具都离不开它，比如：

```txt
读取配置文件
生成代码
扫描目录
写入构建产物
读取 package.json
```

## 1.1 读取文件

CommonJS 写法：

```js
const fs = require('fs')

const content = fs.readFileSync('./package.json', 'utf-8')
console.log(content)
```

ESM 写法：

```js
import fs from 'node:fs'

const content = fs.readFileSync('./package.json', 'utf-8')
console.log(content)
```

现在官方更推荐加 `node:` 前缀：

```js
import fs from 'node:fs'
```

这样可以明确表示：这是 Node 内置模块，不是 npm 包。

---

## 1.2 同步 API 和异步 API

`fs` 通常有三种用法。

### 同步写法

```js
import fs from 'node:fs'

const content = fs.readFileSync('./a.txt', 'utf-8')
console.log(content)
```

特点：

```txt
简单直观
会阻塞后续代码
适合脚本、小工具、启动阶段读取配置
```

---

### 回调写法

```js
import fs from 'node:fs'

fs.readFile('./a.txt', 'utf-8', (err, data) => {
  if (err) {
    console.error(err)
    return
  }

  console.log(data)
})
```

特点：

```txt
老式 Node 风格
不阻塞
但回调写多了容易嵌套
```

---

### Promise 写法

```js
import fs from 'node:fs/promises'

const content = await fs.readFile('./a.txt', 'utf-8')
console.log(content)
```

这是现在最推荐的写法。

你可以记住：

```js
import fs from 'node:fs/promises'
```

这个导出来的 `fs`，大部分方法都是 Promise 版本。

---

## 1.3 写入文件

```js
import fs from 'node:fs/promises'

await fs.writeFile('./hello.txt', '你好 Node', 'utf-8')
```

追加内容：

```js
await fs.appendFile('./hello.txt', '\n追加一行', 'utf-8')
```

创建目录：

```js
await fs.mkdir('./dist', { recursive: true })
```

读取目录：

```js
const files = await fs.readdir('./src')
console.log(files)
```

判断文件是否存在：

```js
import fs from 'node:fs'

if (fs.existsSync('./package.json')) {
  console.log('存在')
}
```

不过 `existsSync` 一般适合脚本里简单判断，业务服务里不建议滥用。

---

# 2. path：路径处理模块

`path` 专门用来处理文件路径。

为什么需要它？

因为不同系统路径分隔符不一样：

```txt
Windows: C:\Users\xxx\project
macOS/Linux: /Users/xxx/project
```

所以不要自己手写字符串拼路径：

```js
// 不推荐
const filePath = './src/' + filename
```

推荐用 `path.join`：

```js
import path from 'node:path'

const filePath = path.join('src', 'pages', 'home.vue')
console.log(filePath)
```

---

## 常用 API

### path.join

拼接路径：

```js
path.join('src', 'utils', 'index.js')
```

---

### path.resolve

得到绝对路径：

```js
const absPath = path.resolve('src/index.js')
console.log(absPath)
```

你可以理解成：

```txt
join 更像“拼接路径”
resolve 更像“从当前工作目录出发，算出绝对路径”
```

---

### path.dirname

获取目录名：

```js
path.dirname('/user/project/src/index.js')
// /user/project/src
```

---

### path.basename

获取文件名：

```js
path.basename('/user/project/src/index.js')
// index.js
```

---

### path.extname

获取扩展名：

```js
path.extname('/user/project/src/index.js')
// .js
```

---

## 重要：ESM 里没有 __dirname

CommonJS 里可以这样：

```js
console.log(__dirname)
console.log(__filename)
```

但是 ESM 里没有这俩。

ESM 里要这么写：

```js
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log(__dirname)
```

这个你后面写 Node 脚本、Vite 插件、代码生成工具时会经常遇到。

---

# 3. os：操作系统模块

`os` 用来获取当前系统信息。

```js
import os from 'node:os'

console.log(os.platform())
console.log(os.arch())
console.log(os.cpus())
console.log(os.totalmem())
console.log(os.freemem())
console.log(os.homedir())
```

常见用途：

```txt
判断当前系统是 Windows 还是 macOS/Linux
获取 CPU 核心数
获取用户主目录
做跨平台脚本
```

比如根据 CPU 核心数决定并发数量：

```js
import os from 'node:os'

const cpuCount = os.cpus().length
console.log(`当前 CPU 核心数：${cpuCount}`)
```

---

# 4. process：进程对象

严格说 `process` 不是通过 `import` 引入的模块，而是 Node 的全局对象。

它代表当前正在运行的 Node 进程。

常用场景非常多。

---

## 4.1 获取命令行参数

比如你执行：

```bash
node index.js dev
```

代码里：

```js
console.log(process.argv)
```

输出大概是：

```js
[
  'node路径',
  '脚本路径',
  'dev'
]
```

所以一般会这样取：

```js
const args = process.argv.slice(2)
console.log(args)
```

---

## 4.2 获取环境变量

```js
console.log(process.env.NODE_ENV)
```

比如：

```bash
NODE_ENV=production node index.js
```

代码里可以读到：

```js
process.env.NODE_ENV
```

前端工程里经常看到：

```js
if (process.env.NODE_ENV === 'production') {
  // 生产环境逻辑
}
```

不过在 Vite 里，更常用的是：

```js
import.meta.env.MODE
import.meta.env.VITE_xxx
```

---

## 4.3 当前工作目录

```js
console.log(process.cwd())
```

注意：

```txt
__dirname：当前文件所在目录
process.cwd()：你在哪个目录执行 node 命令
```

比如：

```bash
cd /project
node scripts/build.js
```

那么：

```js
process.cwd()
// /project
```

而：

```js
__dirname
// /project/scripts
```

这个区别非常重要。

---

## 4.4 退出进程

```js
process.exit(0)
```

常见状态码：

```txt
0：正常退出
1：异常退出
```

例如：

```js
if (!config) {
  console.error('缺少配置文件')
  process.exit(1)
}
```

---

# 5. url：URL 处理模块

`url` 用来处理 URL。

现在常用的是标准 `URL` 类：

```js
const url = new URL('https://example.com/path?a=1&b=2')

console.log(url.protocol) // https:
console.log(url.hostname) // example.com
console.log(url.pathname) // /path
console.log(url.searchParams.get('a')) // 1
```

Node 的 `node:url` 里有一个你会经常用到的函数：

```js
import { fileURLToPath } from 'node:url'
```

主要用于 ESM 中把 `import.meta.url` 转成普通路径：

```js
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
```

---

# 6. events：事件模块

`events` 是 Node 事件机制的基础。

很多 Node 对象本质上都是事件驱动的，比如：

```txt
HTTP Server
Stream
Socket
Child Process
```

基本用法：

```js
import { EventEmitter } from 'node:events'

const emitter = new EventEmitter()

emitter.on('done', (data) => {
  console.log('任务完成：', data)
})

emitter.emit('done', {
  id: 1,
  result: 'success'
})
```

你可以把它理解成：

```txt
on：订阅事件
emit：触发事件
```

这和前端里的事件模型很像：

```js
button.addEventListener('click', handler)
button.dispatchEvent(event)
```

---

## once

只监听一次：

```js
emitter.once('ready', () => {
  console.log('只执行一次')
})
```

---

## removeListener

移除监听：

```js
function handler() {
  console.log('触发')
}

emitter.on('test', handler)
emitter.removeListener('test', handler)
```

---

# 7. http：创建 HTTP 服务

`http` 是 Node 原生创建 Web 服务的模块。

Express、Koa、NestJS 这些框架底层都离不开 Node 的 HTTP 能力。

最小服务：

```js
import http from 'node:http'

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.end('你好 Node HTTP')
})

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000')
})
```

你访问：

```txt
http://localhost:3000
```

就能看到响应。

---

## req 和 res

```js
const server = http.createServer((req, res) => {
  console.log(req.method)
  console.log(req.url)

  res.end('hello')
})
```

你可以理解为：

```txt
req：请求对象，浏览器发来的东西
res：响应对象，服务端返回的东西
```

---

## 根据路径返回不同内容

```js
import http from 'node:http'

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.end('home')
  } else if (req.url === '/about') {
    res.end('about')
  } else {
    res.statusCode = 404
    res.end('not found')
  }
})

server.listen(3000)
```

这就是最原始的路由。

框架帮你做的就是把这些东西封装得更好用。

---

# 8. crypto：加密与哈希模块

`crypto` 常用于：

```txt
生成 hash
生成随机字符串
密码加密
签名校验
token 相关能力
```

---

## 生成 hash

```js
import crypto from 'node:crypto'

const hash = crypto
  .createHash('sha256')
  .update('hello')
  .digest('hex')

console.log(hash)
```

常见用途：

```txt
文件内容 hash
缓存 key
密码摘要
构建产物命名
```

比如前端构建产物：

```txt
app.8f3a1c.js
```

里面这个 hash 就是类似思想。

---

## 生成随机 ID

```js
import crypto from 'node:crypto'

const id = crypto.randomUUID()
console.log(id)
```

输出类似：

```txt
5a7b8796-19d6-44c2-a3c1-c802b256e1d3
```

---

# 9. stream：流模块

`stream` 是 Node 非常重要但一开始比较难的模块。

你可以先这样理解：

> 流就是“数据不是一次性全部读进内存，而是一块一块地处理”。

比如读取一个 2GB 的大文件，如果用：

```js
await fs.readFile('./big.txt')
```

它会试图一次性把整个文件放进内存。

而流式读取是：

```txt
读一点
处理一点
再读一点
再处理一点
```

---

## 文件读取流

```js
import fs from 'node:fs'

const readStream = fs.createReadStream('./big.txt', 'utf-8')

readStream.on('data', (chunk) => {
  console.log('读取到一块数据：', chunk)
})

readStream.on('end', () => {
  console.log('读取完成')
})
```

---

## pipe 管道

复制文件：

```js
import fs from 'node:fs'

const readStream = fs.createReadStream('./a.txt')
const writeStream = fs.createWriteStream('./b.txt')

readStream.pipe(writeStream)
```

你可以把 `pipe` 理解成：

```txt
水管连接
读取流 -> 写入流
```

---

## 前端视角理解 stream

浏览器里也有类似概念：

```txt
下载大文件
视频播放
fetch streaming
文件上传
```

Node 的流在这些地方特别有用：

```txt
文件上传
日志处理
大文件下载
代理转发
压缩解压
```

---

# 10. child_process：子进程模块

`child_process` 用来在 Node 里执行其他命令。

比如：

```txt
执行 git 命令
执行 pnpm build
调用系统脚本
启动另一个服务
```

---

## exec

```js
import { exec } from 'node:child_process'

exec('node -v', (error, stdout, stderr) => {
  if (error) {
    console.error(error)
    return
  }

  console.log(stdout)
})
```

`exec` 适合执行简单命令，并拿到完整输出。

---

## spawn

```js
import { spawn } from 'node:child_process'

const child = spawn('pnpm', ['build'], {
  stdio: 'inherit',
  shell: true
})
```

`spawn` 更适合长时间运行的命令，比如：

```txt
pnpm dev
npm run build
docker compose up
```

你可以简单记：

```txt
exec：执行短命令，拿结果
spawn：启动一个持续运行的进程，实时输出
```

---

# 11. util：工具模块

`util` 里有一些辅助工具。

比较常见的是 `promisify`，可以把老式回调 API 转成 Promise。

```js
import { promisify } from 'node:util'
import { exec } from 'node:child_process'

const execAsync = promisify(exec)

const { stdout } = await execAsync('node -v')
console.log(stdout)
```

不过现在很多模块已经有 Promise 版本了，所以 `promisify` 没以前那么常用。

---

# 12. zlib：压缩模块

`zlib` 用来做 gzip、deflate、brotli 压缩。

比如压缩文件：

```js
import fs from 'node:fs'
import zlib from 'node:zlib'

fs.createReadStream('./a.txt')
  .pipe(zlib.createGzip())
  .pipe(fs.createWriteStream('./a.txt.gz'))
```

常见用途：

```txt
HTTP gzip 压缩
日志压缩
文件压缩
构建工具压缩产物
```

---

# 13. buffer：二进制数据模块

`Buffer` 用来处理二进制数据。

在 Node 里，很多底层数据不是字符串，而是二进制。

比如：

```txt
文件
图片
网络数据包
加密数据
压缩数据
```

基本用法：

```js
const buf = Buffer.from('hello')

console.log(buf)
console.log(buf.toString())
```

输出类似：

```txt
<Buffer 68 65 6c 6c 6f>
hello
```

你可以先粗暴理解：

> Buffer 是 Node 里的“二进制数组”。

前端里你可能见过：

```txt
ArrayBuffer
Blob
File
```

这些和 Buffer 是同一类问题域。

---

# 14. timers：定时器模块

Node 里也有：

```js
setTimeout
setInterval
setImmediate
```

常见：

```js
setTimeout(() => {
  console.log('1 秒后执行')
}, 1000)
```

`timers/promises` 可以用 Promise 风格：

```js
import { setTimeout } from 'node:timers/promises'

await setTimeout(1000)
console.log('1 秒后执行')
```

这个在写脚本时很好用。

---

# 15. assert：断言模块

`assert` 用于测试或校验。

```js
import assert from 'node:assert'

assert.strictEqual(1 + 1, 2)
```

如果不成立，会直接抛错：

```js
assert.strictEqual(1 + 1, 3)
// AssertionError
```

你写一些轻量测试、脚本校验时可以用它。

---

# 16. readline：命令行交互模块

`readline` 用来做命令行输入输出。

比如问用户一个问题：

```js
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const rl = readline.createInterface({ input, output })

const name = await rl.question('你的名字是？')
console.log(`你好，${name}`)

rl.close()
```

很多脚手架工具都会用类似能力，例如：

```txt
create-vite
create-react-app
npm init
pnpm create
```

它们会问你：

```txt
项目名是什么？
选择 Vue 还是 React？
是否使用 TypeScript？
```

背后就有这种命令行交互思想。

---

# 17. worker_threads：多线程模块

Node 默认是单线程执行 JS 的，但可以用 `worker_threads` 开启工作线程。

常用于 CPU 密集型任务，比如：

```txt
图片处理
大规模计算
加密计算
AST 批量分析
```

简单理解：

```txt
child_process：开一个新进程
worker_threads：开一个新线程
```

前端类比：

```txt
Web Worker
```

你现在不用急着掌握，知道它解决“CPU 密集型任务阻塞主线程”的问题就行。

---

# 18. Node 内置模块优先级

对你这个前端工程师来说，我建议优先级这样排：

## 第一梯队：必须熟

```txt
fs
path
process
url
```

这几个是写脚本、工程化工具、配置读取、代码生成最常用的。

---

## 第二梯队：应该会

```txt
http
events
stream
child_process
crypto
```

这些和服务端、构建工具、CLI、框架底层关系很大。

---

## 第三梯队：知道即可

```txt
os
util
zlib
buffer
readline
assert
worker_threads
```

遇到场景再深入。

---

# 19. 一个小综合案例：读取 package.json 并生成项目信息

这个案例串一下：

```txt
fs：读文件
path：拼路径
process：获取当前执行目录
crypto：生成 hash
```

代码：

```js
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const packagePath = path.resolve(process.cwd(), 'package.json')

const content = await fs.readFile(packagePath, 'utf-8')

const hash = crypto
  .createHash('md5')
  .update(content)
  .digest('hex')

const pkg = JSON.parse(content)

console.log({
  name: pkg.name,
  version: pkg.version,
  hash
})
```

你执行：

```bash
node index.js
```

它会读取当前项目的 `package.json`，解析项目信息，并生成内容 hash。

这就是很多工程化脚本的雏形。

---

# 20. 再给你一个前端工程化视角的记忆表

| 模块               | 你可以怎么记        |
| ---------------- | ------------- |
| `fs`             | 操作文件          |
| `path`           | 处理路径          |
| `os`             | 获取操作系统信息      |
| `process`        | 当前 Node 进程    |
| `url`            | 处理 URL        |
| `events`         | 发布订阅 / 事件机制   |
| `http`           | 创建 HTTP 服务    |
| `crypto`         | hash、加密、随机 ID |
| `stream`         | 流式处理大数据       |
| `child_process`  | 执行外部命令        |
| `util`           | 工具函数          |
| `zlib`           | 压缩解压          |
| `buffer`         | 二进制数据         |
| `readline`       | 命令行交互         |
| `assert`         | 断言测试          |
| `worker_threads` | 多线程           |

---

# 21. 最小学习路径

你现在不用平均用力。建议按这个顺序练：

```txt
第一步：fs + path
写一个脚本：扫描某个目录下所有 .js 文件

第二步：process + readline
写一个 CLI：用户输入项目名，然后创建目录

第三步：http
写一个原生 Node 小服务器，理解 req/res

第四步：child_process
写一个脚本：自动执行 pnpm build

第五步：stream
写一个大文件复制脚本，理解 pipe

第六步：crypto
给文件内容生成 hash
```

Node 内置模块不是靠背 API 学会的，而是靠“写脚本、写 CLI、写小服务”串起来的。你先重点拿下 `fs / path / process / http / child_process`，对前端工程化的帮助最大。
