// 实验 4：综合对比 —— 常量 vs 同步函数 vs Promise vs 抛错

function throwsSync() {
  throw new Error('同步抛错');
}

async function throwsAsync() {
  throw new Error('异步抛错');
}

async function main() {
  console.log('1. await 常量');
  console.log(await 100);

  console.log('\n2. await 同步函数返回值');
  console.log(await (() => 200)());

  console.log('\n3. await Promise');
  console.log(await Promise.resolve(300));

  console.log('\n4. await 同步抛错（会被包装成 rejected Promise）');
  try {
    await throwsSync();
  } catch (e) {
    console.log('捕获:', e.message);
  }

  console.log('\n5. await async 函数抛错');
  try {
    await throwsAsync();
  } catch (e) {
    console.log('捕获:', e.message);
  }

  console.log('\n6. 微任务顺序：await 非 Promise 值也会「让出」一次微任务');
  console.log('A');
  await 0;
  console.log('B（在 A 之后，但在后面的同步代码之前）');
}

console.log('start');
main().then(() => console.log('done'));
console.log('end（同步，先于 B 打印）');
