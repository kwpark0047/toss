module.exports = async () => {
  if (global.__SERVER__ && typeof global.__SERVER__.close === 'function') {
    await new Promise((resolve) => global.__SERVER__.close(resolve));
  }
  try {
    const { io, httpServer } = require('../app');
    if (io) io.close();
    if (httpServer) httpServer.close();
  } catch (_e) {}
  try {
    const prisma = require('../config/prisma');
    if (prisma?.$disconnect) await prisma.$disconnect();
  } catch (_e) {}
  try {
    await require('../utils/firebaseAdmin').shutdownFirebase();
  } catch (_e) {}
};
