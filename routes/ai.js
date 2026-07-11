const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const { validateBody, validateId } = require("../middleware/validator");

router.post("/describe-menu", validateBody(["name"]), aiController.describeMenu);
router.post("/instagram", validateBody(["name"]), aiController.generateInstagramCopy);
router.post("/recommend", validateId(["store_id"]), aiController.recommendMenus);
router.post("/recommend-dessert", validateId(["store_id"]), aiController.recommendDessert);
router.post("/translate-menu", validateBody(["store_id", "targetLang"]), aiController.translateMenu);
router.post("/translate", validateBody(["text", "targetLang"]), aiController.translate);
router.post("/storytelling", validateBody(["name"]), aiController.storytelling);
router.post("/analyze-menu-list", aiController.analyzeMenuList);
router.post("/propose-menu-full", validateBody(["name"]), aiController.proposeMenuFull);
router.post("/recommend-pairing", validateId(["store_id"]), aiController.recommendPairing);
router.post("/generate-menu-image", validateBody(["store_id", "name"]), aiController.generateMenuImage);

module.exports = router;
