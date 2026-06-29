/**
 * 拆解：await next() 到底什么时候执行 next()？
 *
 * 结论：await 右侧表达式会先完整求值，求值过程中 next() 已经同步执行完毕。
 */

function syncNext() {
  console.log('  → syncNext() 被调用（同步执行下游）');
  downstream();
  console.log('  → syncNext() 返回 undefined');
  return undefined;
}

function downstream() {
  console.log('    → downstream 执行');
}

async function demo() {
  console.log('1. 到达 await 之前');
  await syncNext(); // 等价于：const tmp = syncNext(); await tmp;
  console.log('2. await 之后的代码（微任务）');
}

console.log('start');
demo();
console.log('end（同步，仍在当前宏任务）');
