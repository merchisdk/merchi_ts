const babel = require('@babel/core');

// Jest 28 loads tests as CommonJS. @merchi/error-catch publishes ESM only,
// so map that package onto its dist and convert the import syntax here.
module.exports = {
  process(src, filename) {
    const result = babel.transformSync(src, {
      filename,
      babelrc: false,
      configFile: false,
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    });
    return { code: result?.code ?? src };
  },
};
