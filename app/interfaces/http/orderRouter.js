const express = require('express');

function createOrderRouter(orderController) {
  const router = express.Router();

  router.post('/', (req, res) => orderController.create(req, res));
  router.get('/:id', (req, res) => orderController.getById(req, res));
  router.get('/number/:orderNumber', (req, res) => orderController.getByOrderNumber(req, res));
  router.get('/store/:storeId', (req, res) => orderController.listByStore(req, res));
  router.patch('/:id/status', (req, res) => orderController.updateStatus(req, res));

  return router;
}

module.exports = createOrderRouter;
