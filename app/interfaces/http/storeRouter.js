const express = require('express');
const router = express.Router();
const storeController = require('./StoreController');

router.get('/search', storeController.searchStores);
router.get('/popular', storeController.getPopular);
router.get('/highlights', storeController.getHighlights);
router.get('/:id', storeController.getStore);
router.post('/', storeController.createStore);

module.exports = router;
