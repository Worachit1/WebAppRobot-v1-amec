const express = require("express");
const { getConfig } = require("../services/store");

const router = express.Router();

//get Robot
router.get("/get", async (req, res) => {
  const config = await getConfig();

  res.json({
    ok: true,
    data: config.robots || [],
  });
});

//get Carts
router.get("/get/carts", async (req, res) => {
  const config = await getConfig();
  const { robotId } = req.query;
  const carts =
    robotId && Array.isArray(config.cartsByRobot?.[robotId])
      ? config.cartsByRobot[robotId]
      : [];

  res.json({
    ok: true,
    data: carts,
  });
});


module.exports = router;
