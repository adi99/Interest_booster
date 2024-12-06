const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (config) => {
      config.resolve.fallback = {
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        vm: require.resolve("vm-browserify"),
        os: require.resolve("os-browserify/browser"),
        path: require.resolve("path-browserify"),
        process: require.resolve('process/browser.js'), // Adding `.js` extension
        buffer: require.resolve('buffer/'), // Add polyfill for `Buffer`
      };

      config.plugins = (config.plugins || []).concat([
        new webpack.ProvidePlugin({
          process: 'process/browser.js', // Adding `.js` extension
          Buffer: ['buffer', 'Buffer'],
        }),
      ]);

      return config;
    },
  },
};
