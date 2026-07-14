const express = require('express');
const router = express.Router();
const weatherController = require('../controllers/weatherController');

// GET /api/weather/current
router.get('/current', weatherController.getCurrentWeather);

module.exports = router;
