const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  const backendPort = process.env.BACKEND_PORT || process.env.SERVER_PORT || '3001';
  app.use('/api', createProxyMiddleware({
    target: `http://127.0.0.1:${backendPort}`,
    changeOrigin: true,
    onProxyReq(upstream, req, res) {
      const abort = () => { if (!res.writableEnded) upstream.destroy(); };
      req.once('aborted', abort); res.once('close', abort);
      upstream.once('close', () => { req.off('aborted', abort); res.off('close', abort); });
      if (req.aborted || res.destroyed) abort();
    },
  }));
};
