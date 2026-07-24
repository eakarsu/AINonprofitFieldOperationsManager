const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  const backendPort = process.env.BACKEND_PORT || process.env.PORT || '3001';
  app.use('/api', createProxyMiddleware({
    target: `http://127.0.0.1:${backendPort}`,
    changeOrigin: true,
  }));
};
