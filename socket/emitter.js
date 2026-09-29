let ioInstance = null;

function setSocketServer(io) {
  ioInstance = io;
}

function emitToStore(storeId, event, payload) {
  if (!ioInstance) return false;
  ioInstance.to(`store - ${storeId}`).emit(event, payload);
  return true;
}

module.exports = {
  setSocketServer,
  emitToStore,
};
