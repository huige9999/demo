下面我们按**第一性原理**过一遍 Node 中的文件 IO。

## 1. 文件 IO 到底是什么？

IO = Input / Output。

文件 IO 就是程序和硬盘文件系统打交道：

```txt
程序  <----读----  文件
程序  ----写---->  文件
```

常见操作就是 CRUD：

```txt
Create   创建文件 / 文件夹
Read     读取文件内容
Update   修改 / 追加内容
Delete   删除文件 / 文件夹
```

Node 里负责文件 IO 的核心模块是：

```js
fs
```

现在更推荐用 Promise 风格：

```js
const fs = require('node:fs/promises')
```

或者 ESM：

```js
import fs from 'node:fs/promises'
```

Node 官方也说明，`fs/promises` 提供的是返回 Promise 的异步文件系统 API。底层文件操作会通过 Node 的线程池处理，不会直接阻塞事件循环主线程。([nodejs.org][1])

---

# 2. Node 文件 IO 有三套写法

Node 的 `fs` 大体有三种风格。

## 2.1 同步 API：简单，但会阻塞

```js
const fs = require('node:fs')

const content = fs.readFileSync('./a.txt', 'utf-8')
console.log(content)
```

特点：

```txt
读文件没完成，后面的代码就不执行。
```

优点：简单。

缺点：阻塞主线程。

适合：

```txt
脚本
启动阶段读取配置
小工具
```

不太适合：

```txt
Web 服务请求处理中频繁使用
高并发接口
```

---

## 2.2 回调 API：老写法

```js
const fs = require('node:fs')

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
不阻塞主线程，但是容易 callback hell。
```

现在了解即可，不是主推。

---

## 2.3 Promise API：现在最推荐

```js
const fs = require('node:fs/promises')

async function main() {
  const content = await fs.readFile('./a.txt', 'utf-8')
  console.log(content)
}

main()
```

这是现在写 Node 文件 IO 最舒服的方式。

你可以先记住一句话：

```txt
日常开发优先用 fs/promises + async/await。
```

---

# 3. 读取文件：readFile

最基本：

```js
const fs = require('node:fs/promises')

async function main() {
  const content = await fs.readFile('./hello.txt', 'utf-8')
  console.log(content)
}

main()
```

这里第二个参数 `'utf-8'` 很关键。

如果你不写编码：

```js
const buffer = await fs.readFile('./hello.txt')
console.log(buffer)
```

拿到的是 `Buffer`。

你可以理解为：

```txt
硬盘里的文件本质上是一堆二进制数据。
如果你告诉 Node 用 utf-8 解码，它就给你字符串。
如果你不告诉它，它就给你原始 Buffer。
```

所以：

```js
await fs.readFile('./hello.txt', 'utf-8') // 字符串
await fs.readFile('./hello.txt')          // Buffer
```

Node 官方学习文档里也把 `fs.readFile()` 作为最简单的读取文件方式介绍。([nodejs.org][2])

---

# 4. 写入文件：writeFile

```js
const fs = require('node:fs/promises')

async function main() {
  await fs.writeFile('./hello.txt', '你好 Node 文件 IO', 'utf-8')
}

main()
```

注意：`writeFile` 默认是**覆盖写入**。

比如原文件是：

```txt
aaa
bbb
```

你执行：

```js
await fs.writeFile('./hello.txt', 'ccc', 'utf-8')
```

文件会变成：

```txt
ccc
```

不是追加，是覆盖。

Node 官方学习文档也把 `fs.writeFile()` 作为最直接的写文件 API。([nodejs.org][3])

---

# 5. 追加内容：appendFile

如果你不想覆盖，而是往后面加：

```js
const fs = require('node:fs/promises')

async function main() {
  await fs.appendFile('./log.txt', '用户登录成功\n', 'utf-8')
}

main()
```

适合做简单日志：

```txt
2026-05-30 用户A登录
2026-05-30 用户B登录
2026-05-30 用户C登录
```

不过真正生产环境日志一般不用自己手搓文件 IO，会用日志库。

---

# 6. 判断文件是否存在：access

很多人会写：

```js
const exists = fs.existsSync('./a.txt')
```

这个可以用，但 Promise 风格里更常见的是：

```js
const fs = require('node:fs/promises')

async function exists(path) {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

async function main() {
  const ok = await exists('./a.txt')
  console.log(ok)
}

main()
```

不过这里有个重要思维：

```txt
不要过度依赖“先判断是否存在，再操作”。
```

因为文件系统是外部世界，可能出现竞态：

```txt
你刚判断存在
下一秒文件被别人删了
你再读取还是报错
```

所以更稳的方式是：

```js
try {
  const content = await fs.readFile('./a.txt', 'utf-8')
  console.log(content)
} catch (err) {
  console.error('读取失败：', err.message)
}
```

也就是：

```txt
直接做操作，用 try/catch 处理失败。
```

---

# 7. 删除文件：unlink

```js
const fs = require('node:fs/promises')

async function main() {
  await fs.unlink('./hello.txt')
}

main()
```

`unlink` 这个名字对前端来说有点怪。

你可以这样记：

```txt
文件名 -> 文件内容
```

删除文件，本质上是把这个名字和底层文件数据的连接断开，所以叫 `unlink`。

---

# 8. 文件重命名 / 移动：rename

重命名：

```js
await fs.rename('./old.txt', './new.txt')
```

移动：

```js
await fs.rename('./a.txt', './dir/a.txt')
```

你可以理解为：

```txt
rename 既能改名，也能换位置。
```

---

# 9. 创建文件夹：mkdir

```js
await fs.mkdir('./logs')
```

如果父目录不存在会报错。

比如：

```js
await fs.mkdir('./a/b/c')
```

如果 `a/b` 不存在，就失败。

所以常用：

```js
await fs.mkdir('./a/b/c', { recursive: true })
```

这个就类似命令行里的：

```bash
mkdir -p a/b/c
```

---

# 10. 读取目录：readdir

```js
const files = await fs.readdir('./src')
console.log(files)
```

结果类似：

```js
[
  'index.js',
  'utils.js',
  'components'
]
```

如果你想知道每个东西是文件还是文件夹，可以加：

```js
const entries = await fs.readdir('./src', {
  withFileTypes: true
})

for (const entry of entries) {
  console.log(entry.name, entry.isFile(), entry.isDirectory())
}
```

输出可能是：

```txt
index.js true false
components false true
```

这个很适合做：

```txt
遍历目录
生成文件列表
写 CLI 工具
批量处理图片 / 文档
```

---

# 11. 获取文件信息：stat

```js
const stat = await fs.stat('./hello.txt')

console.log(stat.size)
console.log(stat.isFile())
console.log(stat.isDirectory())
console.log(stat.mtime)
```

常用字段：

```txt
size        文件大小，单位 byte
mtime       修改时间
birthtime   创建时间
isFile()    是否文件
isDirectory() 是否目录
```

比如判断文件大小：

```js
const stat = await fs.stat('./video.mp4')

console.log(`文件大小：${stat.size / 1024 / 1024} MB`)
```

---

# 12. 删除文件夹：rm

旧一点的 API 有 `rmdir`，现在更常用：

```js
await fs.rm('./dist', {
  recursive: true,
  force: true
})
```

含义：

```txt
recursive: true   递归删除，里面有文件也删
force: true       不存在也不报错
```

这很像你写构建脚本时：

```txt
先删 dist
再重新 build
```

---

# 13. 复制文件：copyFile

```js
await fs.copyFile('./a.txt', './backup/a.txt')
```

注意：目标目录得先存在。

所以常见写法是：

```js
await fs.mkdir('./backup', { recursive: true })
await fs.copyFile('./a.txt', './backup/a.txt')
```

---

# 14. 路径处理：path 模块必须一起学

文件 IO 经常和路径打交道，所以 `path` 基本是 `fs` 的搭子。

```js
const path = require('node:path')

const filePath = path.join(__dirname, 'data', 'user.json')
```

为什么不要直接写：

```js
const filePath = __dirname + '/data/user.json'
```

因为不同系统路径分隔符不一样：

```txt
Windows: C:\user\app\data\user.json
macOS/Linux: /user/app/data/user.json
```

所以用：

```js
path.join()
```

更稳。

---

# 15. `process.cwd()` 和 `__dirname` 的区别

这个非常关键。

## `process.cwd()`

表示：

```txt
你在哪个目录执行 node 命令。
```

比如：

```bash
cd /Users/vichel/project
node src/index.js
```

那么：

```js
process.cwd()
```

就是：

```txt
/Users/vichel/project
```

---

## `__dirname`

表示：

```txt
当前 JS 文件所在目录。
```

比如文件在：

```txt
/Users/vichel/project/src/index.js
```

那么 `index.js` 里的：

```js
__dirname
```

就是：

```txt
/Users/vichel/project/src
```

---

## 什么时候用哪个？

项目配置、用户执行命令相关：

```js
path.join(process.cwd(), 'package.json')
```

当前模块旁边的资源文件：

```js
path.join(__dirname, 'template.html')
```

---

# 16. JSON 文件读写

这是最常见实战之一。

## 读取 JSON

```js
const fs = require('node:fs/promises')

async function main() {
  const content = await fs.readFile('./user.json', 'utf-8')
  const user = JSON.parse(content)

  console.log(user.name)
}

main()
```

文件：

```json
{
  "name": "vichel",
  "age": 18
}
```

---

## 写入 JSON

```js
const fs = require('node:fs/promises')

async function main() {
  const user = {
    name: 'vichel',
    age: 18
  }

  await fs.writeFile(
    './user.json',
    JSON.stringify(user, null, 2),
    'utf-8'
  )
}

main()
```

这里：

```js
JSON.stringify(user, null, 2)
```

意思是格式化成漂亮的 JSON：

```json
{
  "name": "vichel",
  "age": 18
}
```

如果你直接：

```js
JSON.stringify(user)
```

会变成一行：

```json
{"name":"vichel","age":18}
```

---

# 17. 大文件不要直接 readFile

`readFile` 会一次性把整个文件读进内存。

小文件没问题：

```txt
配置文件
JSON
模板
普通文本
```

但如果是：

```txt
1GB 日志
几百 MB 视频
超大 CSV
```

就不要直接：

```js
await fs.readFile('./big.log', 'utf-8')
```

因为它会把整个文件塞进内存。

这时候要用**流 stream**。

---

# 18. 文件流：createReadStream / createWriteStream

流的核心思想：

```txt
不要一口气吃完整个文件，而是一块一块读。
```

类似：

```txt
readFile：一口气把整锅饭端上来
stream：一勺一勺吃
```

## 读取大文件

```js
const fs = require('node:fs')

const stream = fs.createReadStream('./big.log', {
  encoding: 'utf-8'
})

stream.on('data', chunk => {
  console.log('读到一块：', chunk.length)
})

stream.on('end', () => {
  console.log('读取结束')
})

stream.on('error', err => {
  console.error('读取失败：', err)
})
```

---

## 复制大文件

```js
const fs = require('node:fs')

const readStream = fs.createReadStream('./big.mp4')
const writeStream = fs.createWriteStream('./copy.mp4')

readStream.pipe(writeStream)
```

这个就很像水管：

```txt
big.mp4 -> 读流 -> 管道 pipe -> 写流 -> copy.mp4
```

这比：

```js
const data = await fs.readFile('./big.mp4')
await fs.writeFile('./copy.mp4', data)
```

更适合大文件。

---

# 19. 更现代的流复制：pipeline

`pipe` 简单，但错误处理稍弱。更推荐：

```js
const fs = require('node:fs')
const { pipeline } = require('node:stream/promises')

async function main() {
  await pipeline(
    fs.createReadStream('./big.mp4'),
    fs.createWriteStream('./copy.mp4')
  )

  console.log('复制完成')
}

main().catch(console.error)
```

这个写法更适合真实项目。

---

# 20. 文件监听：watch

```js
const fs = require('node:fs')

fs.watch('./src', (eventType, filename) => {
  console.log(eventType, filename)
})
```

用途：

```txt
监听文件变化
开发服务器热更新
自动重新构建
自动生成文件
```

不过 `fs.watch` 在不同操作系统上的表现会有差异，所以生产级工具里经常用封装库，比如 `chokidar`。

---

# 21. 错误处理：文件 IO 必须重视

文件 IO 很容易失败。

常见错误：

```txt
ENOENT      文件不存在
EACCES      没有权限
EISDIR      你把目录当文件读了
ENOTDIR     路径中某一段不是目录
EMFILE      打开的文件太多
```

例子：

```js
try {
  const content = await fs.readFile('./a.txt', 'utf-8')
  console.log(content)
} catch (err) {
  if (err.code === 'ENOENT') {
    console.log('文件不存在')
  } else {
    console.error('读取失败：', err)
  }
}
```

对于文件 IO，你要有一个意识：

```txt
不是代码语法对了就一定成功。
因为文件系统是外部世界：文件可能不存在，权限可能不够，路径可能错，磁盘可能满。
```

---

# 22. 实战 1：确保目录存在后写入文件

```js
const fs = require('node:fs/promises')
const path = require('node:path')

async function writeFileSafe(filePath, content) {
  const dir = path.dirname(filePath)

  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(filePath, content, 'utf-8')
}

async function main() {
  await writeFileSafe('./logs/app/2026-05-30.log', '启动成功\n')
}

main()
```

这个非常常用。

你可以理解为：

```txt
我要写文件，但我先保证它的父目录存在。
```

---

# 23. 实战 2：读取 JSON 配置，如果不存在就创建默认配置

```js
const fs = require('node:fs/promises')

async function readConfig() {
  try {
    const content = await fs.readFile('./config.json', 'utf-8')
    return JSON.parse(content)
  } catch (err) {
    if (err.code === 'ENOENT') {
      const defaultConfig = {
        port: 3000,
        env: 'development'
      }

      await fs.writeFile(
        './config.json',
        JSON.stringify(defaultConfig, null, 2),
        'utf-8'
      )

      return defaultConfig
    }

    throw err
  }
}

async function main() {
  const config = await readConfig()
  console.log(config)
}

main()
```

这类逻辑在 CLI 工具、脚手架、配置系统里很常见。

---

# 24. 实战 3：递归扫描目录

```js
const fs = require('node:fs/promises')
const path = require('node:path')

async function walk(dir) {
  const entries = await fs.readdir(dir, {
    withFileTypes: true
  })

  const result = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      const children = await walk(fullPath)
      result.push(...children)
    } else {
      result.push(fullPath)
    }
  }

  return result
}

async function main() {
  const files = await walk('./src')
  console.log(files)
}

main()
```

这个就是很多工具的底层雏形：

```txt
eslint 扫文件
vite 找模块
脚手架复制模板
markdown 博客扫描文章
```

---

# 25. 你作为前端，要重点掌握哪几个？

你不用一开始把所有 API 背下来。

先抓住这几个：

```txt
readFile      读文件
writeFile     写文件，覆盖
appendFile    追加
mkdir         创建目录
readdir       读取目录
stat          获取文件信息
rm            删除文件/目录
rename        重命名/移动
copyFile      复制文件
access        判断权限/存在性
```

再加两个配套模块：

```txt
path          处理路径
stream        处理大文件
```

---

# 26. 一张心智图

```txt
Node 文件 IO
│
├─ 小文件
│  ├─ readFile
│  ├─ writeFile
│  └─ appendFile
│
├─ 目录
│  ├─ mkdir
│  ├─ readdir
│  └─ rm
│
├─ 文件信息
│  ├─ stat
│  └─ access
│
├─ 文件变动
│  ├─ rename
│  ├─ copyFile
│  └─ unlink
│
├─ 大文件
│  ├─ createReadStream
│  ├─ createWriteStream
│  └─ pipeline
│
└─ 路径处理
   ├─ path.join
   ├─ path.resolve
   ├─ path.dirname
   ├─ __dirname
   └─ process.cwd()
```

---

# 27. 最后用一句话总结

Node 文件 IO 的本质就是：

```txt
用 fs 模块和操作系统文件系统打交道；
小文件用 fs/promises；
大文件用 stream；
路径永远配合 path；
所有文件操作都要准备好处理失败。
```

你现在最应该练的是这三个小任务：

```txt
1. 写一个脚本：读取 package.json，打印 name 和 scripts。
2. 写一个脚本：扫描 src 目录下所有 .js 文件。
3. 写一个脚本：把某个目录复制到另一个目录。
```

这三个练完，Node 文件 IO 的主线基本就通了。

[1]: https://nodejs.org/api/fs.html?utm_source=chatgpt.com "File system | Node.js v25.8.1 Documentation"
[2]: https://nodejs.org/en/learn/manipulating-files/reading-files-with-nodejs?utm_source=chatgpt.com "Reading files with Node.js"
[3]: https://nodejs.org/en/learn/manipulating-files/writing-files-with-nodejs?utm_source=chatgpt.com "Writing files with Node.js"
