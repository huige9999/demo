// 实验 1：await 后面跟常量 / 字面量

async function experiment() {
  console.log('--- await 数字 ---');
  const n = await 42;
  console.log('结果:', n, '类型:', typeof n);

  console.log('\n--- await 字符串 ---');
  const s = await 'hello';
  console.log('结果:', s);

  console.log('\n--- await null / undefined ---');
  console.log('await null =>', await null);
  console.log('await undefined =>', await undefined);

  console.log('\n--- await 对象 ---');
  const obj = await { a: 1 };
  console.log('结果:', obj);

  console.log('\n--- await 数组 ---');
  const arr = await [1, 2, 3];
  console.log('结果:', arr);
}

experiment();
