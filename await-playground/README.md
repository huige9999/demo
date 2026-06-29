# await 试验场

研究 `await` 后面跟**普通函数**、**常量**等非 Promise 值时会发生什么。

## 运行方式

在项目根目录或本目录下执行：

```bash
node await-playground/01-await-constant.js
node await-playground/02-await-sync-function.js
node await-playground/03-await-function-reference.js
node await-playground/04-await-all.js
```

## 核心结论（先剧透，跑完再对照）

1. **`await` 只能写在 `async` 函数（或模块顶层，ES2022+）里**
2. **`await` 后面可以是任意值**，不限于 Promise
3. 若值**不是** Promise / Thenable，引擎会当作 `Promise.resolve(值)` 处理——**不会挂起**，立刻得到该值
4. **`await fn()`**（普通同步函数）：执行函数，对其**返回值**做上述包装
5. **`await fn`**（不加括号）：对**函数对象本身**做包装，得到的是函数引用，不会执行函数
