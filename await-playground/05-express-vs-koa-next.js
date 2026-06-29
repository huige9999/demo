/**
 * 模拟 Express vs Koa 的 next() 差异
 *
 * 核心：await 表达式会先「求值右侧」，再决定是否挂起。
 *       await next()  →  先执行 next()，再 await 它的返回值
 */

console.log('========== 模拟 Express（next 是同步函数）==========\n');

function createExpressLike() {
  const stack = [];

  function use(fn) {
    stack.push(fn);
  }

  function dispatch(index) {
    if (index >= stack.length) return;

    const fn = stack[index];
    const next = () => dispatch(index + 1); // 同步：立刻调用下一个

    console.log(`[Express] 进入中间件 ${index}`);
    fn(null, null, next);
    console.log(`[Express] 中间件 ${index} 的「同步部分」结束`);
  }

  return { use, run: () => dispatch(0) };
}

const express = createExpressLike();

express.use(async (req, res, next) => {
  console.log('  MW0: before await next()');
  await next(); // ← 关键！
  console.log('  MW0: after await next()  ← 你以为会等下游，其实 next() 已经同步跑完了');
});

express.use((req, res, next) => {
  console.log('  MW1: 下游中间件');
  next();
});

express.use((req, res, next) => {
  console.log('  MW1.5: 更下游');
});

express.run();

console.log('\n--- 微任务阶段 ---');
setTimeout(() => console.log('（对比：这是宏任务，一定在微任务之后）\n'), 0);

// ---------------------------------------------------------------------------

setTimeout(() => {
  console.log('========== 模拟 Koa（next 返回 Promise）==========\n');

  function createKoaLike() {
    const stack = [];

    function use(fn) {
      stack.push(fn);
    }

    function dispatch(index) {
      if (index >= stack.length) return Promise.resolve();

      const fn = stack[index];
      const next = () => dispatch(index + 1); // 返回 Promise，代表下游完成

      console.log(`[Koa] 进入中间件 ${index}`);
      return Promise.resolve(fn(null, next)).then(() => {
        console.log(`[Koa] 中间件 ${index} 完整结束（含 await 之后的代码）`);
      });
    }

    return { use, run: () => dispatch(0) };
  }

  const koa = createKoaLike();

  koa.use(async (ctx, next) => {
    console.log('  MW0: before await next()');
    await next();
    console.log('  MW0: after await next()  ← Koa 里这句真的在下游全部完成后才执行');
  });

  koa.use(async (ctx, next) => {
    console.log('  MW1: 下游中间件');
    await next();
    console.log('  MW1: 下游 after');
  });

  koa.run().then(() => console.log('\n[Koa] 全部完成'));
}, 50);
