const express = require("express");
const {
  getConfig,
  getHistory,
  saveConfig,
  saveHistory,
} = require("../services/store");
const {
  getDeviceStatusFromAllAreas,
  getTaskOrderStatus,
  getOrderList,
} = require("../services/rcs");
const ordersRoutes = require("./orders");

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

function getAllZones(config, key) {
  const zones = [...(config[key] || [])];
  const byRobot = config[`${key}ByRobot`] || {};

  for (const robotZones of Object.values(byRobot)) {
    if (Array.isArray(robotZones)) zones.push(...robotZones);
  }

  return zones;
}

// แก้ไข Area
function getRcsAreaIds(rcs) {
  const configured = Array.isArray(rcs.areaIds) ? rcs.areaIds : [];
  return [...new Set([...configured, 1, 2, 24].map(String))];
}

function getTaskOrderId(task) {
  return String(
    task?.OrderId ||
      task?.orderId ||
      task?.orderID ||
      task?.thirdOrderId ||
      task?.thirdOrderID ||
      task?.thirdOrderNo ||
      task?.outOrderId ||
      task?.outOrderID ||
      task?.OrderNumber ||
      task?.orderNumber ||
      task?.orderNo ||
      "",
  );
}

function getTaskOrderStatusValue(task) {
  return (
    task?.OrderStatus ??
    task?.orderStatus ??
    task?.TaskStatus ??
    task?.taskStatus ??
    task?.status ??
    task?.Status ??
    task?.state ??
    task?.State ??
    null
  );
}

function isCompletedTaskStatus(statusValue) {
  if (Number(statusValue) === 8) return true;

  const text = String(statusValue || "").trim().toLowerCase();
  return [
    "8",
    "completed",
    "complete",
    "finished",
    "finish",
    "mission accomplished",
    "accomplished",
    "done",
  ].includes(text);
}

function normalizeTaskStatusResult(source, result, areaId = null) {
  const data = result?.data;
  const tasks = Array.isArray(data?.Tasks)
    ? data.Tasks
    : Array.isArray(data?.tasks)
      ? data.tasks
      : Array.isArray(data)
        ? data
        : data && typeof data === "object"
          ? [data]
          : [];

  return {
    source,
    areaId,
    code: result?.code,
    desc: result?.desc,
    tasks,
  };
}

function findQueuedTaskByRobot(config, robotId) {
  for (const zone of getAllZones(config, "dropZones")) {
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

function findDeliveringSpotByRobot(config, robotId) {
  for (const zone of getAllZones(config, "dropZones")) {
    for (const group of getGroups(zone)) {
      for (const spot of group.spots || []) {
        if (
          String(spot.robotId) === String(robotId) &&
          spot.orderId &&
          spot.statusWork === "delivering"
        ) {
          return spot;
        }
      }
    }
  }

  return null;
}

async function findRcsOrderStatus(rcs, orderId) {
  const areaIds = getRcsAreaIds(rcs);

  for (const areaId of areaIds) {
    try {
      const result = await getOrderList(rcs.baseUrl, areaId, [orderId]);
      const statusResult = normalizeTaskStatusResult(
        "getOrderList",
        result,
        areaId,
      );
      const tasks = statusResult.tasks;
      const task = tasks.find(
        (item) => getTaskOrderId(item) === String(orderId),
      );

      if (task) {
        return {
          ...statusResult,
          task,
          orderStatus: getTaskOrderStatusValue(task),
        };
      }
    } catch (err) {
      console.warn("[Status] getOrderList failed:", {
        areaId,
        orderId,
        message: err.message,
        status: err.response?.status,
      });
    }
  }

  try {
    const result = await getTaskOrderStatus(rcs.baseUrl, orderId);
    const statusResult = normalizeTaskStatusResult(
      "getTaskOrderStatus",
      result,
    );
    const task = statusResult.tasks.find(
      (item) => getTaskOrderId(item) === String(orderId),
    ) || statusResult.tasks[0] || null;

    if (task || Number(result?.code) === 1000) {
      return {
        ...statusResult,
        task: task || result,
        orderStatus: task
          ? getTaskOrderStatusValue(task)
          : getTaskOrderStatusValue(result),
      };
    }
  } catch (err) {
    console.warn("[Status] getTaskOrderStatus failed:", {
      orderId,
      message: err.message,
      status: err.response?.status,
    });
  }

  return null;
}

async function releaseCompletedDeliveringTask(config, rcs, robotId, history) {
  const spot = findDeliveringSpotByRobot(config, robotId);
  if (!spot?.orderId) return null;

  const taskStatus = await findRcsOrderStatus(rcs, spot.orderId);
  if (!taskStatus || !isCompletedTaskStatus(taskStatus.orderStatus)) {
    return null;
  }

  const orderId = spot.orderId;
  const finishedRobotId = spot.robotId;

  spot.statusCart = "full";
  spot.statusWork = "pending";

  delete spot.robotId;
  delete spot.cartId;
  delete spot.cartName;
  delete spot.orderId;

  const historyIndex = history.findIndex(
    (item) => String(item.orderId) === String(orderId),
  );

  if (historyIndex >= 0) {
    history[historyIndex] = {
      ...history[historyIndex],
      status: "COMPLETED",
      finishedAt: new Date().toISOString(),
      note: "RCS mission accomplished, drop spot is full and pending",
      rcsTaskStatus: taskStatus.task,
    };
  }

  await saveConfig(config);
  await saveHistory(history);

  let queueResult = null;
  if (typeof ordersRoutes.processQueuedOrders === "function") {
    queueResult = await ordersRoutes.processQueuedOrders(config);
  }

  return {
    orderId,
    robotId: finishedRobotId,
    rcsOrderStatus: taskStatus.orderStatus,
    rcsStatusSource: taskStatus.source,
    rcsAreaId: taskStatus.areaId,
    queueResult,
  };
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
  const areaIds = getRcsAreaIds(rcs);
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
  let releasedTask = null;

  try {
    releasedTask = await releaseCompletedDeliveringTask(
      config,
      rcs,
      robotId,
      history,
    );
  } catch (err) {
    console.warn("[Status] release completed delivering failed:", err.message);
  }

  const tasks = [];

  for (const zone of getAllZones(config, "dropZones")) {
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
    releasedTask,
  });
});

module.exports = router;
