const { server } = require('../index');

module.exports = async () => {
  global.__SERVER__ = server;
};
