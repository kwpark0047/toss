const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsController');

router.get('/', newsController.getNews);
router.post('/crawl', newsController.triggerCrawl);

module.exports = router;
