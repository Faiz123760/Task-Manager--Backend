const express = require("express");
const { protect, adminOnly } = require("../middlewares/authMiddleware");
const { exportsTasksReport, exportsUsersReport } = require("../controllers/reportController");

const router = express.Router()

router.get("/exports/tasks", protect, adminOnly,exportsTasksReport); //export all tasks as excel/pdf
router.get("/exports/users", protect, adminOnly, exportsUsersReport) //export user-task report

module.exports = router