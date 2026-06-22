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

const router = express.Router();

function getGroups(zone) {
  return zone.groups || zone.group || [];
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

function findRcsBaseUrl(config, robot) {
  const rcs = (config.rcs || []).find((item) => item.id === robot.rcsId);
  return rcs?.baseUrl || "";
}

function startNextQueuedTask(spot) {
  const queue = Array.isArray(spot.taskQueue) ? spot.taskQueue : [];
  const next = queue.shift();

  if (!next) {
    delete spot.taskQueue;
    return null;
  }

  spot.statusWork = "delivering";
  spot.robotId = next.robotId;
  spot.cartId = next.cartId;
  spot.cartName = next.cartName;
  spot.orderId = next.orderId;

  if (queue.length > 0) spot.taskQueue = queue;
  else delete spot.taskQueue;

  return next;
}

async function saveMockHistory(order, status, note, rcsResponse) {
  const history = await getHistory();
  history.unshift({
    ...order,
    status,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    finishedAt: status === "SEND_SUCCESS" ? new Date().toISOString() : null,
    rcsResponse,
    note,
  });
  await saveHistory(history);
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

    const cart = (config.carts || []).find((item) => item.id === cartId);
    if (!cart) return res.status(404).json({ error: "Cart not found" });

    const robot = findRobot(config, robotId);
    if (!robot) return res.status(404).json({ error: "Robot not found" });

    const pickup = findSpotInZones(
      config.pickupZones || [],
      pickupSpotId,
      pickupSpotName,
    );
    const drop = findSpotInZones(
      config.dropZones || [],
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

    const dropRef = findSpotRefById(config.dropZones || [], drop.id);
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
    if (isPending) {
      return res.status(409).json({
        error: "Drop spot is pending. Please change statusCart to empty first.",
        drop: {
          id: dropRef.id,
          name: dropRef.name,
          statusCart: dropRef.statusCart,
          statusWork: dropRef.statusWork,
          orderId: dropRef.orderId || null,
        },
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

router.post("/:orderId/work-done", async (req, res) => {
  const { orderId } = req.params;
  const config = await getConfig();

  const spot = findSpotRefByOrderId(config.dropZones || [], orderId);
  if (!spot) {
    return res.status(404).json({ error: "Task not found by orderId" });
  }

  spot.statusWork = "free";

  delete spot.robotId;
  delete spot.cartId;
  delete spot.cartName;
  delete spot.orderId;

  const nextTask = startNextQueuedTask(spot);

  await saveConfig(config);

  res.json({
    ok: true,
    message: nextTask ? "Work done and next queue started" : "Work done",
    orderId,
    nextTask,
    data: spot,
  });
});

router.post("/:orderId/clear-task", async (req, res) => {
  const { orderId } = req.params;
  const config = await getConfig();

  const spot = findSpotRefByOrderId(config.dropZones || [], orderId);
  if (!spot)
    return res.status(404).json({ error: "Task not found by orderId" });

  spot.statusCart = "empty";
  spot.statusWork = "free";

  delete spot.robotId;
  delete spot.cartId;
  delete spot.cartName;
  delete spot.orderId;

  const nextTask = startNextQueuedTask(spot);

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
  const spot = findSpotRefById(config.dropZones || [], spotId);

  if (!spot) return res.status(404).json({ error: "Spot not found" });

  if (statusCart === "empty" && spot.statusWork === "delivering") {
    return res.status(409).json({
      error: "Cannot set statusCart to empty while statusWork is delivering",
    });
  }

  spot.statusCart = statusCart;

  if (statusCart === "empty") {
    spot.statusWork = "free";

    delete spot.robotId;
    delete spot.cartId;
    delete spot.cartName;
    delete spot.orderId;

    startNextQueuedTask(spot);
  }

  await saveConfig(config);

  res.json({
    ok: true,
    data: spot,
  });
});

router.get("/history", async (req, res) => {
  const { status, q, fields } = req.query;
  let history = await getHistory();

  if (status && status !== "ALL") {
    history = history.filter((item) => item.status === status);
  }

  const searchFields = fields
    ? fields.split(",")
    : ["orderId", "robotName", "pickup", "drop"];

  if (q && searchFields.length > 0) {
    const query = q.toLowerCase();

    history = history.filter((item) => {
      return searchFields.some((field) => {
        if (field === "orderId") {
          return item.orderId?.toLowerCase().includes(query);
        }

        if (field === "robotName") {
          return item.robotName?.toLowerCase().includes(query);
        }

        if (field === "pickup") {
          return item.pickup?.name?.toLowerCase().includes(query);
        }

        if (field === "drop") {
          return item.drop?.name?.toLowerCase().includes(query);
        }

        return false;
      });
    });
  }

  res.json(history);
});

router.post("/:orderId/cancel", async (req, res) => {
  const { orderId } = req.params;
  const history = await getHistory();
  const index = history.findIndex((item) => item.orderId === orderId);

  if (index === -1) return res.status(404).json({ error: "Order not found" });

  history[index] = {
    ...history[index],
    status: "CANCELLED",
    finishedAt: new Date().toISOString(),
    note: "Cancelled (stub)",
  };

  await saveHistory(history);
  res.json({ ok: true });
});

module.exports = router;
