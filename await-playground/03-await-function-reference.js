// 实验 3：await 后面跟「函数本身」（没有括号调用）

function greet() {
  console.log('  greet 被调用了！');
  return 'hi';
}

async function experiment() {
  console.log('--- await greet（不调用）---');
  const fn = await greet; // 注意：没有 ()
  console.log('结果:', fn);
  console.log('是函数吗?', typeof fn === 'function');
  console.log('greet 有没有被执行?', '—— 看上面有没有打印');

  console.log('\n--- await greet()（调用）---');
  const msg = await greet();
  console.log('结果:', msg);
}

experiment();
