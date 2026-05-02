const express = require("express");
const router = express.Router();

const { getDisplayBoard } = require("../controllers/queueController");

router.get("/board", getDisplayBoard);

module.exports = router;
