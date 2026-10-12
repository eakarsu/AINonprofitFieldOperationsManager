'use strict';

/** Native routes keep their schema and policy; cancellation owns provider I/O and uncommitted writes. */
function createNativeAIRequest(req, res, pool, { timeoutMs = 90000 } = {}) {
  const controller = new AbortController();
  let disconnected = false, timedOut = false, client = null, transactionOpen = false, savepoint = 0, brokenClient = null;
  const abort = () => { disconnected = true; controller.abort(); };
  const responseClosed = () => { if (!res.writableEnded) abort(); };
  req.once('aborted', abort); res.once('close', responseClosed);
  if (req.aborted || res.destroyed) abort();
  const deadline = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  deadline.unref?.();
  function assertActive() {
    if (controller.signal.aborted) throw Object.assign(new Error(timedOut ? 'AI request timed out. Please try again.' : 'AI request cancelled'), { name: timedOut ? 'TimeoutError' : 'AbortError' });
  }
  async function rollback() {
    if (transactionOpen && client) {
      try { await client.query('ROLLBACK'); } catch (error) { brokenClient = error; }
      finally { transactionOpen = false; }
    }
  }
  async function query(sql, values) {
    assertActive();
    if (!/^\s*(?:INSERT|UPDATE|DELETE|MERGE)\b/i.test(sql)) {
      const result = await pool.query(sql, values); assertActive(); return result;
    }
    if (!client) {
      client = await pool.connect(); assertActive(); await client.query('BEGIN'); transactionOpen = true; assertActive();
    }
    const name = `native_ai_write_${++savepoint}`;
    await client.query(`SAVEPOINT ${name}`);
    try {
      assertActive(); const result = await client.query(sql, values); assertActive();
      await client.query(`RELEASE SAVEPOINT ${name}`); return result;
    } catch (error) {
      // Existing optional history/annotation failures remain nonfatal, while their failed SQL stays isolated.
      await client.query(`ROLLBACK TO SAVEPOINT ${name}`).catch(() => {});
      await client.query(`RELEASE SAVEPOINT ${name}`).catch(() => {});
      throw error;
    }
  }
  return {
    signal: controller.signal, assertActive, query, rollback,
    get disconnected() { return disconnected; },
    get timedOut() { return timedOut; },
    async commit() { assertActive(); if (transactionOpen) { await client.query('COMMIT'); transactionOpen = false; } },
    async dispose() {
      clearTimeout(deadline); req.removeListener('aborted', abort); res.removeListener('close', responseClosed);
      try { await rollback(); } finally { client?.release(brokenClient || undefined); }
    },
  };
}

module.exports = { createNativeAIRequest };
