const express = require("express");
const { getAttractionTrend, getAttractionDetail } = require("../controllers/attractionController");

const router = express.Router();

router.get("/:id/trend", getAttractionTrend);
router.get("/:id/detail", getAttractionDetail);

module.exports = router;
