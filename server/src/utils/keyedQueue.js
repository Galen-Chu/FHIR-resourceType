// per-key 序列化佇列：同一個 key 的操作依序執行，不同 key 完全平行、互不阻塞。
// 用於 Upsert 端點防止「同一個 identifier 併發寫入」造成的 Race Condition——
// 即使上游 FHIR Server 的 conditional update 本身是原子操作，Gateway 仍可能
// 在極短時間內對同一個 identifier 送出兩個並發請求（例如使用者連點兩次）。
const queues = new Map();

function withKeyLock(key, fn) {
  const prev = queues.get(key) || Promise.resolve();
  const next = prev.then(fn, fn).finally(() => {
    // 只有在自己仍是佇列尾端時才清理，避免刪掉後面排隊中的紀錄
    if (queues.get(key) === next) queues.delete(key);
  });
  queues.set(key, next);
  return next;
}

module.exports = { withKeyLock };
