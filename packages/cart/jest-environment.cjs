const Module = require('node:module');
const { TestEnvironment } = require('jest-environment-jsdom');

// Workspace policy disables canvas native builds. Cart/DOM regressions do not
// exercise canvas; model its optional integration as absent, rather than loading
// an installed package whose native binary cannot exist under that policy.
module.exports = class CartEnvironment extends TestEnvironment {
  constructor(...args) {
    const resolve = Module._resolveFilename;
    Module._resolveFilename = function (name, parent, ...rest) {
      if (name === 'canvas' && parent?.filename?.endsWith('/jsdom/lib/jsdom/utils.js')) {
        const error = new Error('Optional canvas is unavailable in cart tests');
        error.code = 'MODULE_NOT_FOUND';
        throw error;
      }
      return resolve.call(this, name, parent, ...rest);
    };
    try {
      super(...args);
    } finally {
      Module._resolveFilename = resolve;
    }
  }
};
