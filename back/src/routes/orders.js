const express = require("express");
const {
  getConfig,
  saveConfig,
  getHistory,
  saveHistory,
} = require("../services/store");
const {
  dispatchOrderImmediate,
  getQueueSnapshot,
} = require("../services/queue");

const { cancelTask } = require("../services/rcs");

const router = express.Router();
const queuedRetryTimers = new Map();
const MAX_QUEUED_RETRIES = 5;
const QUEUED_RETRY_DELAY_MS = 5000;

function getGroups(zone) {
  return zone.groups || zone.group || [];
}

function getRobotZones(config, key, robotId) {
  if (!robotId) return config[key] || [];

  const robotZones = config[`${key}ByRobot`]?.[robotId];
  if (Array.isArray(robotZones)) return robotZones;

  return config[key] || [];
}

function getAllZones(config, key) {
  const zones = [...(config[key] || [])];
  const byRobot = config[`${key}ByRobot`] || {};

  for (const robotZones of Object.values(byRobot)) {
    if (Array.isArray(robotZones)) zones.push(...robotZones);
  }

  return zones;
}

function findSpotInZones(zones, spotId, spotName) {
  for (const zone of zones || []) {
    for (const group of getGroups(zone)) {
      for (const spot of group.spots || []) {
        if (
          (spotId && spot.id === spotId) ||
          (spotName && spot.name === spotName)
        ) {
          return {
            ...spot,
            zoneId: zone.id,
            zoneName: zone.name,
            groupId: group.id,
            groupName: group.name,
          };
        }
      }
    }
  }
  return null;
}

function findSpotRefById(zones, spotId) {
  for (const zone of zones || []) {
    for (const group of getGroups(zone)) {
      for (const spot of group.spots || []) {
        if (spot.id === spotId) return spot;
      }
    }
  }
  return null;
}

function findSpotRefByOrderId(zones, orderId) {
  for (const zone of zones || []) {
    for (const group of getGroups(zone)) {
      for (const spot of group.spots || []) {
        if (spot.orderId === orderId) return spot;
      }
    }
  }
  return null;
}

function findRobot(config, robotId) {
  return (config.robots || []).find((robot) => robot.id === robotId);
}

function getRobotCarts(config, robotId) {
  return Array.isArray(config.cartsByRobot?.[robotId])
    ? config.cartsByRobot[robotId]
    : [];
}

function findRcsBaseUrl(config, robot) {
  const rcs = (config.rcs || []).find((item) => item.id === robot.rcsId);
  return rcs?.baseUrl || "";
}

function findNextQueuedTask(config, robotId) {
  for (const zone of getAllZones(config, "dropZones")) {
    for (const group of getGroups(zone)) {
      for (const spot of group.spots || []) {
        if (spot.statusWork !== "free") continue;
        if (spot.statusCart === "full") continue;

        const queue = Array.isArray(spot.taskQueue) ? spot.taskQueue : [];

        const index = queue.findIndex(
          (task) => String(task.robotId) === String(robotId),
        );

        if (index >= 0) {
          return {
            spot,
            queue,
            index,
            task: queue[index],
          };
        }
      }
    }
  }

  return null;
}

async function startNextQueuedTask(config, robotId) {
  if (!robotId) return null;
  if (isRobotBusy(config, robotId)) return null;

  const found = findNextQueuedTask(config, robotId);
  if (!found) return null;

  const { spot, queue, index, task: next } = found;

  const robot = findRobot(config, next.robotId);
  if (!robot) return null;

  const rcsBaseUrl = findRcsBaseUrl(config, robot);

  const result = await dispatchOrderImmediate(
    {
      orderId: next.orderId,
      robotId: next.robotId,
      robotName: next.robotName,
      cartId: next.cartId,
      cartName: next.cartName,
      pickup: next.pickup,
      drop: next.drop,
      createdAt: next.createdAt,
    },
    {
      robot,
      startSpot: next.pickup,
      endSpot: next.drop,
      rcsBaseUrl,
    },
  );

  if (!result.ok) {
    if (result.retryable) {
      const retryCount = Number(next.retryCount || 0) + 1;

      queue[index] = {
        ...next,
        retryCount,
      };
      spot.taskQueue = queue;

      await saveMockHistory(
        next,
        "QUEUED",
        `RCS busy, retrying (${retryCount}/${MAX_QUEUED_RETRIES})`,
        result.rcsResponse,
      );

      if (retryCount < MAX_QUEUED_RETRIES) {
        const existingTimer = queuedRetryTimers.get(next.orderId);
        if (existingTimer) clearTimeout(existingTimer);

        const retryTimer = setTimeout(async () => {
          queuedRetryTimers.delete(next.orderId);
          try {
            await startNextQueuedTask(config, next.robotId);
            await saveConfig(config);
          } catch (err) {
            console.error("[Orders] queued retry failed:", err);
          }
        }, QUEUED_RETRY_DELAY_MS);

        queuedRetryTimers.set(next.orderId, retryTimer);
      } else {
        const existingTimer = queuedRetryTimers.get(next.orderId);
        if (existingTimer) {
          clearTimeout(existingTimer);
          queuedRetryTimers.delete(next.orderId);
        }

        await saveMockHistory(
          next,
          "SEND_FAILED",
          `RCS busy after ${MAX_QUEUED_RETRIES} retries`,
          result.rcsResponse,
        );

        return {
          ...next,
          status: "SEND_FAILED",
          retryable: false,
          retryCount,
          rcsResponse: result.rcsResponse,
          error: result.rcsResponse?.desc || "RCS busy",
        };
      }

      return {
        ...next,
        status: "QUEUED",
        retryable: true,
        retryCount,
        rcsResponse: result.rcsResponse,
      };
    }

    return {
      ...next,
      status: "SEND_FAILED",
      rcsResponse: result.rcsResponse,
      error: result.error,
    };
  }

  const existingTimer = queuedRetryTimers.get(next.orderId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    queuedRetryTimers.delete(next.orderId);
  }

  queue.splice(index, 1);

  if (queue.length > 0) spot.taskQueue = queue;
  else delete spot.taskQueue;

  spot.statusCart = "empty";
  spot.statusWork = "delivering";
  spot.robotId = next.robotId;
  spot.cartId = next.cartId;
  spot.cartName = next.cartName;
  spot.orderId = next.orderId;

  return {
    ...next,
    status: "SEND_SUCCESS",
    rcsResponse: result.rcsResponse,
  };
}

async function processQueuedOrders(configOverride = null) {
  const config = configOverride || (await getConfig());
  const queuedCandidates = [];

  for (const zone of getAllZones(config, "dropZones")) {
    for (const group of getGroups(zone)) {
      for (const spot of group.spots || []) {
        if (spot.statusWork !== "free") continue;
        if (!Array.isArray(spot.taskQueue) || spot.taskQueue.length === 0) continue;

        const robotId = spot.taskQueue[0]?.robotId;
        if (robotId && !isRobotBusy(config, robotId)) {
          queuedCandidates.push(robotId);
        }
      }
    }
  }

  let changed = false;
  for (const robotId of [...new Set(queuedCandidates.map(String))]) {
    const result = await startNextQueuedTask(config, robotId);
    if (result) changed = true;
  }

  if (changed) {
    await saveConfig(config);
  }

  return { changed };
}

async function saveMockHistory(order, status, note, rcsResponse) {
  const history = await getHistory();
  const now = new Date().toISOString();
  const entry = {
    ...order,
    status,
    createdAt: order.createdAt || now,
    startedAt: order.startedAt || order.createdAt || now,
    finishedAt: status === "SEND_SUCCESS" ? now : null,
    rcsResponse,
    note,
  };

  const index = history.findIndex((item) => item.orderId === order.orderId);

  if (index >= 0) {
    history[index] = {
      ...history[index],
      ...entry,
      createdAt: history[index].createdAt || entry.createdAt,
      startedAt: history[index].startedAt || entry.startedAt,
    };

    for (let i = history.length - 1; i > index; i -= 1) {
      if (history[i].orderId === order.orderId) {
        history.splice(i, 1);
      }
    }
  } else {
    history.unshift(entry);
  }

  await saveHistory(history);
}

function isRobotBusy(config, robotId) {
  for (const zone of getAllZones(config, "dropZones")) {
    for (const group of getGroups(zone)) {
      for (const spot of group.spots || []) {
        if (
          String(spot.robotId) === String(robotId) &&
          spot.statusWork === "delivering"
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

router.post("/", async (req, res) => {
  try {
    const {
      robotId,
      cartId,
      pickupSpotId,
      dropSpotId,
      pickupSpotName,
      dropSpotName,
    } = req.body || {};

    if (!robotId) return res.status(400).json({ error: "Missing robotId" });
    if (!cartId) return res.status(400).json({ error: "Missing cartId" });

    if (!pickupSpotId && !pickupSpotName) {
      return res
        .status(400)
        .json({ error: "Missing pickupSpotId or pickupSpotName" });
    }

    if (!dropSpotId && !dropSpotName) {
      return res
        .status(400)
        .json({ error: "Missing dropSpotId or dropSpotName" });
    }

    const config = await getConfig();

    const cart = getRobotCarts(config, robotId).find(
      (item) => item.id === cartId,
    );
    if (!cart) return res.status(404).json({ error: "Cart not found" });

    const robot = findRobot(config, robotId);
    if (!robot) return res.status(404).json({ error: "Robot not found" });

    const pickup = findSpotInZones(
      getRobotZones(config, "pickupZones", robot.id),
      pickupSpotId,
      pickupSpotName,
    );
    const drop = findSpotInZones(
      getRobotZones(config, "dropZones", robot.id),
      dropSpotId,
      dropSpotName,
    );

    if (!pickup || !drop) {
      return res.status(404).json({ error: "Pickup or drop spot not found" });
    }

    if (!pickup.rcsPosition || !drop.rcsPosition) {
      return res
        .status(400)
        .json({ error: "Pickup or drop rcsPosition is missing" });
    }

    const dropRef = findSpotRefById(
      getRobotZones(config, "dropZones", robot.id),
      drop.id,
    );
    if (!dropRef)
      return res.status(404).json({ error: "Drop spot ref not found" });

    const orderId = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const rcsBaseUrl = findRcsBaseUrl(config, robot);
    const taskPath = `${pickup.rcsPosition},${drop.rcsPosition}`;

    const order = {
      orderId,
      robotId: robot.id,
      robotName: robot.name,
      cartId: cart.id,
      cartName: cart.name,
      pickup: {
        id: pickup.id,
        name: pickup.name,
        zoneId: pickup.zoneId,
        zoneName: pickup.zoneName,
        groupId: pickup.groupId,
        groupName: pickup.groupName,
        rcsPosition: pickup.rcsPosition,
      },
      drop: {
        id: drop.id,
        name: drop.name,
        zoneId: drop.zoneId,
        zoneName: drop.zoneName,
        groupId: drop.groupId,
        groupName: drop.groupName,
        rcsPosition: drop.rcsPosition,
      },
      createdAt: new Date().toISOString(),
    };

    const isFree = dropRef.statusWork === "free";
    const isDelivering = dropRef.statusWork === "delivering";
    const isPending = dropRef.statusWork === "pending";

    console.log("[Orders] dropRef status:", {
      id: dropRef.id,
      name: dropRef.name,
      statusCart: dropRef.statusCart,
      statusWork: dropRef.statusWork,
      orderId: dropRef.orderId || null,
    });
    const shouldPending =
      dropRef.statusCart === "full" || dropRef.statusWork === "pending";

    if (shouldPending) {
      dropRef.statusWork = "pending";

      dropRef.taskQueue = Array.isArray(dropRef.taskQueue)
        ? dropRef.taskQueue
        : [];

      dropRef.taskQueue.push({
        orderId,
        robotId: robot.id,
        robotName: robot.name,
        cartId: cart.id,
        cartName: cart.name,
        statusWork: "queue",
        pickup: order.pickup,
        drop: order.drop,
        createdAt: new Date().toISOString(),
      });

      await saveMockHistory(
        order,
        "PENDING",
        "Drop spot is full, waiting for empty",
        {
          code: 1000,
          desc: "PENDING",
          data: { orderId },
        },
      );

      await saveConfig(config);

      return res.json({
        ok: true,
        orderId,
        status: "PENDING",
        message: "Drop spot is full/pending. Order queued until cart is empty.",
        queue: getQueueSnapshot(),
      });
    }

    const robotBusy = isRobotBusy(config, robot.id);

    if (robotBusy) {
      const queueResponse = {
        code: 1000,
        desc: "QUEUED",
        data: { orderId },
      };

      dropRef.taskQueue = Array.isArray(dropRef.taskQueue)
        ? dropRef.taskQueue
        : [];

      dropRef.taskQueue.push({
        orderId,
        robotId: robot.id,
        robotName: robot.name,
        cartId: cart.id,
        cartName: cart.name,
        statusWork: "queue",
        pickup: order.pickup,
        drop: order.drop,
        createdAt: new Date().toISOString(),
      });

      await saveMockHistory(
        order,
        "QUEUED",
        "Robot is busy. Order added to queue",
        queueResponse,
      );
      await saveConfig(config);

      return res.json({
        ok: true,
        orderId,
        status: "QUEUED",
        message: "Robot is busy. Order added to queue.",
        rcsResponse: queueResponse,
        queue: getQueueSnapshot(),
      });
    }

    if (isDelivering) {
      const queueResponse = {
        code: 1000,
        desc: "QUEUED",
        data: { orderId },
      };

      dropRef.taskQueue = Array.isArray(dropRef.taskQueue)
        ? dropRef.taskQueue
        : [];

      dropRef.taskQueue.push({
        orderId,
        robotId: robot.id,
        robotName: robot.name,
        cartId: cart.id,
        cartName: cart.name,
        statusWork: "queue",
        pickup: order.pickup,
        drop: order.drop,
        createdAt: new Date().toISOString(),
      });

      await saveMockHistory(
        order,
        "QUEUED",
        "Order added to queue",
        queueResponse,
      );
      await saveConfig(config);

      return res.json({
        ok: true,
        orderId,
        status: "QUEUED",
        message: "Current drop is delivering. Order added to queue.",
        rcsResponse: queueResponse,
        queue: getQueueSnapshot(),
      });
    }

    const isFull = dropRef.statusCart === "full";

    if (isFull) {
      dropRef.statusWork = "pending";

      dropRef.taskQueue = Array.isArray(dropRef.taskQueue)
        ? dropRef.taskQueue
        : [];

      dropRef.taskQueue.push({
        orderId,
        robotId: robot.id,
        robotName: robot.name,
        cartId: cart.id,
        cartName: cart.name,
        statusWork: "queue",
        pickup: order.pickup,
        drop: order.drop,
        createdAt: new Date().toISOString(),
      });

      await saveMockHistory(
        order,
        "PENDING",
        "Drop spot is full, waiting for empty",
        {
          code: 1000,
          desc: "PENDING",
          data: { orderId },
        },
      );

      await saveConfig(config);

      return res.json({
        ok: true,
        orderId,
        status: "PENDING",
        message: "Drop spot is full. Order pending until cart is empty.",
        queue: getQueueSnapshot(),
      });
    }

    if (!isFree) {
      return res.status(409).json({
        error: "Drop spot is not available",
        drop: {
          id: dropRef.id,
          name: dropRef.name,
          statusCart: dropRef.statusCart,
          statusWork: dropRef.statusWork,
          orderId: dropRef.orderId || null,
        },
      });
    }

    console.log(
      `[Orders] dispatch robot=${robot.id} orderId=${orderId} taskPath=${taskPath} deviceNum=${robot.deviceNum} rcsBaseUrl=${rcsBaseUrl || "(empty)"}`,
    );

    const result = await dispatchOrderImmediate(order, {
      robot,
      startSpot: pickup,
      endSpot: drop,
      rcsBaseUrl,
    });

    if (!result.ok) {
      return res.status(502).json({
        error: result.error || result.rcsResponse?.desc || "RCS send failed",
        orderId,
        status: "SEND_FAILED",
        rcsResponse: result.rcsResponse,
      });
    }

    await saveMockHistory(
      order,
      "SEND_SUCCESS",
      "RCS order sent",
      result.rcsResponse,
    );

    dropRef.statusCart = "empty";
    dropRef.statusWork = "delivering";
    dropRef.robotId = robot.id;
    dropRef.cartId = cart.id;
    dropRef.cartName = cart.name;
    dropRef.orderId = orderId;

    await saveConfig(config);

    return res.json({
      ok: true,
      orderId,
      status: "SEND_SUCCESS",
      rcsResponse: result.rcsResponse,
      data: {
        ...order,
        status: "SEND_SUCCESS",
        rcsResponse: result.rcsResponse,
      },
      queue: getQueueSnapshot(),
    });
  } catch (err) {
    console.error("[Orders] create cart order error:", err);

    return res.status(500).json({
      error: err.message || "Create cart order failed",
    });
  }
});

router.post("/home", async (req, res) => {
  try {
    const { robotId, dropSpotId, dropSpotName } = req.body || {};

    if (!robotId) return res.status(400).json({ error: "Missing robotId" });

    if (!dropSpotId && !dropSpotName) {
      return res
        .status(400)
        .json({ error: "Missing dropSpotId or dropSpotName" });
    }

    const config = await getConfig();

    const robot = findRobot(config, robotId);
    if (!robot) return res.status(404).json({ error: "Robot not found" });

    const drop = findSpotInZones(
      getRobotZones(config, "dropZones", robot.id),
      dropSpotId,
      dropSpotName,
    );

    if (!drop) {
      return res.status(404).json({ error: "Home point not found" });
    }

    if (!drop.rcsPosition) {
      return res
        .status(400)
        .json({ error: "Home point rcsPosition is missing" });
    }

    const orderId = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const rcsBaseUrl = findRcsBaseUrl(config, robot);

    const order = {
      orderId,
      robotId: robot.id,
      robotName: robot.name,
      cartId: "HOME",
      cartName: "HOME",
      pickup: {
        id: "CURRENT",
        name: "Current Position",
        rcsPosition: null,
      },
      drop: {
        id: drop.id,
        name: drop.name,
        zoneId: drop.zoneId,
        zoneName: drop.zoneName,
        groupId: drop.groupId,
        groupName: drop.groupName,
        rcsPosition: drop.rcsPosition,
      },
      createdAt: new Date().toISOString(),
      type: "HOME",
    };

    const result = await dispatchOrderImmediate(order, {
      robot,
      startSpot: null,
      endSpot: drop,
      rcsBaseUrl,
    });

    if (!result.ok) {
      return res.status(502).json({
        error: result.error || result.rcsResponse?.desc || "RCS send failed",
        orderId,
        status: "SEND_FAILED",
        rcsResponse: result.rcsResponse,
      });
    }

    await saveMockHistory(
      order,
      "SEND_SUCCESS",
      "Robot sent to home point",
      result.rcsResponse,
    );

    return res.json({
      ok: true,
      orderId,
      status: "SEND_SUCCESS",
      rcsResponse: result.rcsResponse,
      data: {
        ...order,
        status: "SEND_SUCCESS",
        rcsResponse: result.rcsResponse,
      },
      queue: getQueueSnapshot(),
    });
  } catch (err) {
    console.error("[Orders] home order error:", err);

    return res.status(500).json({
      error: err.message || "Create home order failed",
    });
  }
});

router.get("/history", async (req, res) => {
  const { status, q, fields, page = 1, limit = 10 } = req.query;

  let history = await getHistory();

  if (status && status !== "ALL") {
    history = history.filter((item) => item.status === status);
  }

  const searchFields = fields
    ? fields.split(",")
    : ["orderId", "robotName", "pickup", "drop"];

  if (q && searchFields.length > 0) {
    const query = String(q).trim().toLowerCase();

    if (query) {
      history = history.filter((item) => {
        return searchFields.some((field) => {
          if (field === "orderId") {
            return String(item.orderId || "")
              .toLowerCase()
              .includes(query);
          }

          if (field === "robotName") {
            return String(item.robotName || "")
              .toLowerCase()
              .includes(query);
          }

          if (field === "pickup") {
            return String(item.pickup?.name || "")
              .toLowerCase()
              .includes(query);
          }

          if (field === "drop") {
            return String(item.drop?.name || "")
              .toLowerCase()
              .includes(query);
          }

          if (field === "cart") {
            return String(item.cartName || item.cartId || "")
              .toLowerCase()
              .includes(query);
          }

          if (field === "status") {
            return String(item.status || "")
              .toLowerCase()
              .includes(query);
          }

          return false;
        });
      });
    }
  }

  const pageNumber = Math.max(1, Number(page) || 1);
  const limitNumber = Math.max(1, Number(limit) || 10);

  const totalItems = history.length;
  const totalPages = Math.ceil(totalItems / limitNumber);

  const startIndex = (pageNumber - 1) * limitNumber;
  const items = history.slice(startIndex, startIndex + limitNumber);

  res.json({
    items,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      totalItems,
      totalPages,
    },
  });
});

router.post("/:orderId/work-done", async (req, res) => {
  const { orderId } = req.params;
  const config = await getConfig();

  const spot = findSpotRefByOrderId(
    getAllZones(config, "dropZones"),
    orderId,
  );
  if (!spot) {
    return res.status(404).json({ error: "Task not found by orderId" });
  }

  spot.statusCart = "full";
  spot.statusWork = "pending";

  delete spot.robotId;
  delete spot.cartId;
  delete spot.cartName;
  delete spot.orderId;

  await saveConfig(config);

  res.json({
    ok: true,
    message: "Work done, drop spot is full and pending",
    orderId,
    data: spot,
  });
});

router.post("/:orderId/clear-task", async (req, res) => {
  const { orderId } = req.params;
  const config = await getConfig();

  const spot = findSpotRefByOrderId(
    getAllZones(config, "dropZones"),
    orderId,
  );
  if (!spot)
    return res.status(404).json({ error: "Task not found by orderId" });

  const finishedRobotId = spot.robotId;

  spot.statusWork = "free";

  delete spot.robotId;
  delete spot.cartId;
  delete spot.cartName;
  delete spot.orderId;

  nextTask = await startNextQueuedTask(config, finishedRobotId);

  await saveConfig(config);

  res.json({
    ok: true,
    message: nextTask ? "Task cleared and next queue started" : "Task cleared",
    orderId,
    nextTask,
    data: spot,
  });
});

router.patch("/:spotId/status-cart", async (req, res) => {
  const { spotId } = req.params;
  const { statusCart } = req.body || {};

  if (!["empty", "full"].includes(statusCart)) {
    return res.status(400).json({ error: "statusCart must be empty or full" });
  }

  const config = await getConfig();
  const spot = findSpotRefById(getAllZones(config, "dropZones"), spotId);

  if (!spot) return res.status(404).json({ error: "Spot not found" });

  if (statusCart === "empty" && spot.statusWork === "delivering") {
    return res.status(409).json({
      error: "Cannot set statusCart to empty while statusWork is delivering",
    });
  }

  let nextTask = null;
  const finishedRobotId = spot.robotId;
  const queuedRobotId = Array.isArray(spot.taskQueue)
    ? spot.taskQueue[0]?.robotId
    : null;

  spot.statusCart = statusCart;

  if (statusCart === "empty") {
    spot.statusWork = "free";

    delete spot.robotId;
    delete spot.cartId;
    delete spot.cartName;
    delete spot.orderId;

    nextTask = await startNextQueuedTask(
      config,
      finishedRobotId || queuedRobotId,
    );
  }

  if (statusCart === "full" && spot.statusWork === "free") {
    spot.statusWork = "pending";
  }

  await saveConfig(config);

  return res.json({
    ok: true,
    data: spot,
    nextTask,
  });
});

router.post("/:orderId/cancel", async (req, res) => {
  const { orderId } = req.params;

  const config = await getConfig();
  const history = await getHistory();

  let removedTask = null;

  for (const zone of getAllZones(config, "dropZones")) {
    for (const group of getGroups(zone)) {
      for (const spot of group.spots || []) {
        if (!Array.isArray(spot.taskQueue)) continue;

        const index = spot.taskQueue.findIndex(
          (task) => task.orderId === orderId,
        );

        if (index >= 0) {
          removedTask = spot.taskQueue[index];
          spot.taskQueue.splice(index, 1);

          if (spot.taskQueue.length === 0) {
            delete spot.taskQueue;
          }

          break;
        }
      }
    }
  }

  if (!removedTask) {
    return res.status(409).json({
      error: "Cannot cancel this order. It may already be sent to RCS.",
    });
  }

  const historyIndex = history.findIndex((item) => item.orderId === orderId);

  if (historyIndex >= 0) {
    history[historyIndex] = {
      ...history[historyIndex],
      status: "CANCELLED",
      finishedAt: new Date().toISOString(),
      note: "Cancelled before sending to RCS",
    };
  } else {
    history.unshift({
      ...removedTask,
      status: "CANCELLED",
      finishedAt: new Date().toISOString(),
      note: "Cancelled before sending to RCS",
    });
  }

  await saveConfig(config);
  await saveHistory(history);

  res.json({
    ok: true,
    orderId,
    status: "CANCELLED",
    removedTask,
  });
});

router.post("/:orderId/cancel-running", async (req, res) => {
  const { orderId } = req.params;
  const { releaseOnly = false } = req.body || {};

  const config = await getConfig();
  const history = await getHistory();

  const spot = findSpotRefByOrderId(
    getAllZones(config, "dropZones"),
    orderId,
  );

  if (!spot) {
    return res.status(404).json({ error: "Delivering task not found" });
  }

  if (spot.statusWork !== "delivering") {
    return res.status(409).json({
      error: "This task is not delivering",
      statusWork: spot.statusWork,
    });
  }

  const finishedRobotId = spot.robotId;
  const robot = findRobot(config, finishedRobotId);

  if (!robot) {
    return res.status(404).json({ error: "Robot not found" });
  }

  const rcsBaseUrl = findRcsBaseUrl(config, robot);

  let rcsResponse = null;

  if (!releaseOnly) {
    rcsResponse = await cancelTask(rcsBaseUrl, [
      {
        orderId,
        destPosition: spot.rcsPosition,
      },
    ]);

    if (Number(rcsResponse?.code) !== 1000) {
      return res.status(502).json({
        error: rcsResponse?.desc || "RCS cancelTask failed",
        rcsResponse,
      });
    }
  }

  spot.statusWork = "free";
  spot.statusCart = "empty";

  delete spot.robotId;
  delete spot.cartId;
  delete spot.cartName;
  delete spot.orderId;

  const nextTask = await startNextQueuedTask(config, finishedRobotId);

  const historyIndex = history.findIndex((item) => item.orderId === orderId);

  if (historyIndex >= 0) {
    history[historyIndex] = {
      ...history[historyIndex],
      status: "CANCELLED",
      finishedAt: new Date().toISOString(),
      note: releaseOnly
        ? "Released in WebApp after cancelled in RCS"
        : "Cancelled running task in RCS",
      rcsResponse: rcsResponse || history[historyIndex].rcsResponse,
    };
  }

  await saveConfig(config);
  await saveHistory(history);

  return res.json({
    ok: true,
    orderId,
    status: "CANCELLED",
    releaseOnly,
    rcsResponse,
    nextTask,
    data: spot,
  });
});
module.exports = router;
router.processQueuedOrders = processQueuedOrders;
