// src/setupProxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    ['/scan', '/metrics', '/cache'], // add any backend paths you call
    createProxyMiddleware({
      target: 'http://127.0.0.1:7072',
      changeOrigin: true,
      ws: false,
      logLevel: 'silent',
    })
  );
};
