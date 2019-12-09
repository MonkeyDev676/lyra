module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          ie: '11',
          edge: '16',
          firefox: '68',
          safari: '12',
          chrome: '70',
          opera: '60',
          node: '8',
        },
        corejs: 3,
        useBuiltIns: 'usage',
      },
    ],
  ],
  plugins: ['@babel/plugin-transform-runtime'],
  ignore: ['node_modules'],
};
