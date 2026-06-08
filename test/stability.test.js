const http = require('http');

const BASE_URL = 'http://127.0.0.1:10086/command';

function request(action, args, session) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ action, args, session });
    const req = http.request(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 60000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const elapsed = Date.now() - startTime;
        try {
          const parsed = JSON.parse(body);
          resolve({ ...parsed, _elapsedMs: elapsed });
        } catch (e) {
          resolve({ ok: false, error: { code: 'parse_error', message: body }, _elapsedMs: elapsed });
        }
      });
    });
    req.on('error', (err) => {
      reject(new Error(`${action} failed: ${err.message} (${Date.now() - startTime}ms)`));
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`${action} timed out after 30s`));
    });
    req.write(data);
    req.end();
  });
}

function checkStatus() {
  return request('evaluate', { code: 'document.readyState' }, 'fip-stability');
}

async function runTest(name, fn, iterations) {
  console.log(`\n=== ${name} (${iterations}次) ===`);
  const results = { passed: 0, failed: 0, errors: [], latencies: [] };
  for (let i = 0; i < iterations; i++) {
    try {
      const result = await fn(i);
      results.passed++;
      results.latencies.push(result._elapsedMs || 0);
      process.stdout.write(result.ok !== false ? '.' : 'F');
    } catch (e) {
      results.failed++;
      results.errors.push(`#${i + 1}: ${e.message}`);
      process.stdout.write('E');
    }
  }
  console.log('');
  const avg = results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length;
  const max = Math.max(...results.latencies);
  console.log(`  通过: ${results.passed}/${iterations}, 失败: ${results.failed}, 平均延迟: ${avg.toFixed(0)}ms, 最大延迟: ${max}ms`);
  if (results.errors.length > 0) {
    console.log('  错误样例:', results.errors.slice(0, 3).join('; '));
  }
  return results;
}

async function main() {
  console.log('kimi-webbridge 稳定性测试开始');
  console.log('================================');

  // 0. 先导航到页面
  console.log('\n=== 初始化: 导航到 FIP 页面 ===');
  const navResult = await request('navigate', { url: 'https://fip.cscec.com', newTab: true, group_title: 'fip-stability' }, 'fip-stability');
  console.log('导航结果:', navResult.ok ? `ok, url=${navResult.data?.url}` : `失败: ${JSON.stringify(navResult)}`);
  if (!navResult.ok) {
    console.log('导航失败，退出测试');
    process.exit(1);
  }

  // 等待页面加载
  await new Promise(r => setTimeout(r, 2000));

  // 确认连接状态
  const status = await request('evaluate', { code: 'document.readyState' }, 'fip-stability');
  console.log('初始状态检查:', status.ok ? `ok, readyState=${status.data?.value}` : `失败: ${JSON.stringify(status)}`);
  if (!status.ok) {
    console.log('初始连接失败，退出测试');
    process.exit(1);
  }

  // 1. 高频快照测试 — 最容易暴露消息队列问题
  const snapshotResults = await runTest('高频 snapshot 测试', async () => {
    return request('snapshot', {}, 'fip-stability');
  }, 30);

  // 2. 高频 evaluate 测试 — JS 执行稳定性
  const evalResults = await runTest('高频 evaluate 测试', async (i) => {
    return request('evaluate', { code: `(() => ({ url: location.href, title: document.title, count: ${i} }))()` }, 'fip-stability');
  }, 30);

  // 3. 大页面内容 evaluate — 测试数据传输极限
  const heavyEvalResults = await runTest('大内容 evaluate 测试', async () => {
    return request('evaluate', { code: 'JSON.stringify(document.body.innerText.length)' }, 'fip-stability');
  }, 10);

  // 4. 导航来回切换 — 测试 tab 生命周期
  const navResults = await runTest('导航切换测试', async (i) => {
    const url = i % 2 === 0
      ? 'https://fip.cscec.com/OSPPortal/CSCPortal.jsp'
      : 'https://fip.cscec.com/OSPPortal/CSCPortal.jsp#/dashboard';
    return request('navigate', { url, newTab: false }, 'fip-stability');
  }, 10);

  // 5. 并发请求测试 — 模拟 agent 多工具并行调用
  console.log('\n=== 并发请求测试 (5个并行snapshot) ===');
  const concurrentStart = Date.now();
  let concurrentOk = 0;
  try {
    const concurrent = await Promise.all([
      request('snapshot', {}, 'fip-stability'),
      request('snapshot', {}, 'fip-stability'),
      request('snapshot', {}, 'fip-stability'),
      request('snapshot', {}, 'fip-stability'),
      request('snapshot', {}, 'fip-stability'),
    ]);
    concurrentOk = concurrent.filter(r => r.ok !== false).length;
    console.log(`  结果: ${concurrentOk}/5 成功, 耗时: ${Date.now() - concurrentStart}ms`);
  } catch (e) {
    console.log(`  并发测试异常: ${e.message}`);
  }

  // 6. 多 session 切换测试
  console.log('\n=== 多 session 切换测试 ===');
  const sessions = ['fip-s1', 'fip-s2', 'fip-s3'];
  for (const s of sessions) {
    const r = await request('navigate', { url: 'https://fip.cscec.com', newTab: true, group_title: s }, s);
    console.log(`  session ${s}: ${r.ok ? 'ok' : 'fail'}`);
  }

  // 7. 检查 daemon 状态
  console.log('\n=== 最终状态检查 ===');
  const finalStatus = await request('evaluate', { code: 'document.readyState' }, 'fip-stability');
  console.log('evaluate readyState:', finalStatus.ok ? finalStatus.data?.value : `失败: ${JSON.stringify(finalStatus)}`);

  // 汇总
  console.log('\n================================');
  console.log('测试汇总');
  console.log('================================');
  const totalPassed = snapshotResults.passed + evalResults.passed + heavyEvalResults.passed + navResults.passed;
  const totalFailed = snapshotResults.failed + evalResults.failed + heavyEvalResults.failed + navResults.failed;
  const total = totalPassed + totalFailed;
  console.log(`总请求: ${total}, 通过: ${totalPassed}, 失败: ${totalFailed}, 成功率: ${((totalPassed / total) * 100).toFixed(1)}%`);
  console.log(`并发测试: ${concurrentOk}/5 成功`);
  console.log(`最终连接状态: ${finalStatus.ok ? '正常' : '断联'}`);

  // 清理多 session tab
  for (const s of sessions) {
    await request('close_tab', {}, s);
  }
}

main().catch(e => {
  console.error('测试异常:', e.message);
  process.exit(1);
});
