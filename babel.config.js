const browserOpts = {
  modules: 'umd',
  targets: {
    ie: '11',
    edge: '16',
    firefox: '68',
    safari: '12',
    chrome: '70',
    opera: '60',
  },
};

const nodeOpts = {
  modules: 'cjs',
  targets: {
    node: '8',
  },
};

const enhancedOpts = process.env.BABEL_ENV === 'umd' ? browserOpts : nodeOpts;

const config = {
  presets: [
    [
      '@babel/preset-env',
      {
        ...enhancedOpts,
        corejs: 3,
        useBuiltIns: 'usage',
      },
    ],
  ],
  plugins: ['@babel/plugin-transform-runtime'],
  ignore: ['node_modules'],
};

if (process.env.BABEL_ENV !== 'development') config.ignore.push('src/__tests__');

module.exports = config;
