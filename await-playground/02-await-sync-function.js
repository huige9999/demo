// 实验 2：await 后面跟普通（同步）函数的调用

function syncAdd(a, b) {
  console.log('  syncAdd 被调用了');
  return a + b;
}

function syncReturnsObject() {
  return { name: 'demo' };
}

function syncReturnsNothing() {
  console.log('  syncReturnsNothing 被调用了，没有 return');
}

async function experiment() {
  console.log('--- await syncAdd(1, 2) ---');
  const sum = await syncAdd(1, 2);
  console.log('结果:', sum);

  console.log('\n--- await syncReturnsObject() ---');
  const obj = await syncReturnsObject();
  console.log('结果:', obj);

  console.log('\n--- await syncReturnsNothing() ---');
  const ret = await syncReturnsNothing();
  console.log('返回值:', ret, '(普通函数无 return 时返回 undefined)');

  console.log('\n--- 对比：先调用再 await 常量 ---');
  const x = syncAdd(10, 20); // 先得到 30
  const y = await x;         // await 30，等价于 await Promise.resolve(30)
  console.log('x =', x, ', y =', y);
}

experiment();
