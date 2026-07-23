const express = require("express");
const { getConfig } = require("../services/store");

const router = express.Router();

function normalizeZones(zones = []) {
  return zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    groups: (zone.groups || zone.group || []).map((group) => ({
      id: group.id,
      name: group.name,
      spots: (group.spots || []).map((spot) => ({
        id: spot.id,
        name: spot.name,
        statusCart: spot.statusCart || "empty",
        statusWork: spot.statusWork || "free",
        rcsPosition: spot.rcsPosition,
      })),
    })),
  }));
}

function getRobotZones(config, key, robotId) {
  if (!robotId) return config[key] || [];

  const byRobotKey = `${key}ByRobot`;
  const robotZones = config[byRobotKey]?.[robotId];
  if (Array.isArray(robotZones)) return robotZones;

  return config[key] || [];
}

// GET /zones/get/groups
router.get("/get/groups", async (req, res) => {
  const config = await getConfig();
  const { robotId } = req.query;

  const zones = normalizeZones(getRobotZones(config, "pickupZones", robotId));

  res.json({
    ok: true,
    data: zones,
  });
});

// GET /zones/get/drop
router.get("/get/drops", async (req, res) => {
  const config = await getConfig();
  const { robotId } = req.query;

  const zones = normalizeZones(getRobotZones(config, "dropZones", robotId));

  res.json({
    ok: true,
    data: zones,
  });
});

// GET /zones
router.get("/", async (req, res) => {
  const config = await getConfig();
  const { robotId } = req.query;

  res.json({
    ok: true,
    data: {
      pickupZones: normalizeZones(getRobotZones(config, "pickupZones", robotId)),
      dropZones: normalizeZones(getRobotZones(config, "dropZones", robotId)),
    },
  });
});

module.exports = router;
