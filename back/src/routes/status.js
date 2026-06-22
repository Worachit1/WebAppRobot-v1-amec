const express = require("express");
const { getConfig, getHistory } = require("../services/store");
const { getDeviceStatusFromAllAreas } = require("../services/rcs");

const router = express.Router();

// IRAYPLE API 4.1.2.1: 0 Offline, 1 Idle, 2 Fault, 3 Initializing, 4 On mission, 5 Charging, 7 Upgrading
const AGV_STATUS_MAP = {
  0: "OFFLINE",
  1: "FREE",
  2: "ALARM",
  3: "INITIALIZING",
  4: "RUNNING",
  5: "CHARGING",
  7: "UPGRADING",
};

function getGroups(zone) {
  return zone.groups || zone.group || [];
}

function findQueuedTaskByRobot(config, robotId) {
  for (const zone of config.dropZones || []) {
    for (const group of getGroups(zone)) {
      for (const spot of group.spots || []) {
        const task = (spot.taskQueue || []).find(
          (item) => item.robotId === robotId,
        );

        if (task) {
          return {
            task,
            spot,
          };
        }
      }
    }
  }

  return null;
}

router.get("/:robotId", async (req, res) => {
  const { robotId } = req.params;
  const config = await getConfig();
  const robot = (config.robots || []).find((item) => item.id === robotId);
  if (!robot) {
    return res.status(404).json({ error: "Robot not found" });
  }
  const rcs = (config.rcs || []).find((item) => item.id === robot.rcsId);
  if (!rcs) {
    return res.status(404).json({ error: "RCS not found" });
  }

  let deviceStatus = null;
  const areaIds = rcs.areaIds && rcs.areaIds.length ? rcs.areaIds : [0, 1, 2];
  try {
    const deviceKeys = [robot.deviceNum, robot.name, robot.id];
    const deviceRes = await getDeviceStatusFromAllAreas(
      rcs.baseUrl,
      deviceKeys,
      areaIds,
    );
    if (deviceRes.code === 1000 && deviceRes.data) {
      const device = deviceRes.data;
      deviceStatus = {
        deviceNum: device.deviceCode || device.deviceName,
        agvStatus:
          AGV_STATUS_MAP[device.deviceStatus] || device.state || "UNKNOWN",
        battery: device.battery != null ? Number(device.battery) : null,
        charging:
          device.deviceStatus === 5 ||
          (device.state && device.state.includes("Charging")),
        areaId: deviceRes.areaId,
        devicePosition: device.devicePosition || null,
        state: device.state || null,
        statusCarts: device.statusCarts || null,
        statusWork: device.statusWork || null,
      };
    } else if (deviceRes.code !== 1000) {
      deviceStatus = {
        error: deviceRes.desc || "Device not found in any area",
      };
    }
  } catch (err) {
    const url = `${rcs.baseUrl}/ics/out/device/list/deviceInfo`;
    const statusCode = err.response?.status;
    let message = err.message;
    if (statusCode === 404) {
      message = `RCS ไม่มี path นี้ (404). ตรวจสอบ baseUrl และ path API: ${url}`;
    } else if (statusCode) {
      message = `${err.message} (HTTP ${statusCode})`;
    }
    deviceStatus = { error: message, url };
  }

  const history = await getHistory();

  const tasks = [];

  for (const zone of config.dropZones || []) {
    for (const group of getGroups(zone)) {
      for (const spot of group.spots || []) {
        if (
          String(spot.robotId) === String(robotId) &&
          spot.orderId &&
          spot.statusWork === "delivering"
        ) {
          const historyItem = history.find(
            (item) => String(item.orderId) === String(spot.orderId),
          );

          tasks.push({
            ...(historyItem || {}),
            orderId: spot.orderId,
            robotId: spot.robotId,
            cartId: spot.cartId,
            cartName: spot.cartName,
            statusWork: "delivering",
            canCancel: false,
          });
        }

        for (const task of spot.taskQueue || []) {
          if (String(task.robotId) === String(robotId)) {
            tasks.push({
              ...task,
              statusWork: spot.statusWork === "pending" ? "pending" : "queue",
              canCancel: true,
            });
          }
        }
      }
    }
  }

  const latest =
    tasks[0] ||
    history.find((item) => String(item.robotId) === String(robotId)) ||
    null;

  res.json({
    robot: {
      id: robot.id,
      name: robot.name,
      deviceNum: robot.deviceNum,
    },
    deviceStatus,
    latestOrder: latest,
    tasks,
  });
});

module.exports = router;
