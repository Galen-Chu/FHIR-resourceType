const { withKeyLock } = require('../src/utils/keyedQueue');

function delayedTask(order, label, ms) {
  return async () => {
    order.push(`start:${label}`);
    await new Promise((resolve) => setTimeout(resolve, ms));
    order.push(`end:${label}`);
    return label;
  };
}

describe('withKeyLock', () => {
  test('同一個 key 的任務依序執行（不會交錯）', async () => {
    const order = [];
    await Promise.all([
      withKeyLock('same-key', delayedTask(order, 'a', 30)),
      withKeyLock('same-key', delayedTask(order, 'b', 10))
    ]);
    expect(order).toEqual(['start:a', 'end:a', 'start:b', 'end:b']);
  });

  test('不同 key 的任務平行執行（互不阻塞）', async () => {
    const order = [];
    await Promise.all([
      withKeyLock('key-a', delayedTask(order, 'a', 30)),
      withKeyLock('key-b', delayedTask(order, 'b', 10))
    ]);
    // b（10ms）比 a（30ms）先結束，代表兩者是平行跑、b 沒有排在 a 後面等待
    expect(order).toEqual(['start:a', 'start:b', 'end:b', 'end:a']);
  });

  test('回傳值會正確傳遞', async () => {
    const result = await withKeyLock('key-c', async () => 'hello');
    expect(result).toBe('hello');
  });

  test('前一個任務失敗不會卡住佇列，後續同 key 任務仍會執行', async () => {
    const results = [];
    await withKeyLock('key-d', async () => {
      throw new Error('boom');
    }).catch((e) => results.push(`caught:${e.message}`));

    const v = await withKeyLock('key-d', async () => 'ok-after-error');
    results.push(v);

    expect(results).toEqual(['caught:boom', 'ok-after-error']);
  });
});
