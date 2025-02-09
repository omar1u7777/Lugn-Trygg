export default {
  server: {
    proxy: {
      '/register': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        secure: false
      }
    }
  }
};
