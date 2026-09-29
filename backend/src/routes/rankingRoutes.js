const express = require("express");
const { getRanking } = require("../controllers/rankingController");

const router = express.Router();

router.get("/", getRanking);

module.exports = router;
