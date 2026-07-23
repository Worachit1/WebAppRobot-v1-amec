import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";

import ScreenLayout from "../components/ScreenLayout.jsx";
import Swal from "sweetalert2";
import {
  fetchConfig,
  fetchRobotStatus,
  cancelOrder,
  cancelRunningOrder,
} from "../api/client.js";

import { formatDateTime } from "../config/formatDatetime.js";

const DEFAULT_ROBOT_ID = "C100";

function Status() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [config, setConfig] = useState(null);
  const [robotId, setRobotId] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const [actionLoading, setActionLoading] = useState(false);
  const queryRobotId = searchParams.get("robotId");

  useEffect(() => {
    fetchConfig().then((data) => {
      setConfig(data);

      const queryRobot = data.robots?.find(
        (item) => String(item.id) === String(queryRobotId),
      );
      const defaultRobot = data.robots?.find(
        (item) => String(item.id) === DEFAULT_ROBOT_ID,
      );
      const firstRobot = data.robots?.find((item) => item.id);

      if (queryRobot?.id) {
        setRobotId(queryRobot.id);
      } else if (defaultRobot?.id) {
        setRobotId(defaultRobot.id);
      } else if (firstRobot?.id) {
        setRobotId(firstRobot.id);
      }
    });
  }, [queryRobotId]);

  useEffect(() => {
    if (!robotId) return;

    setLoading(true);

    fetchRobotStatus(robotId)
      .then((data) => setStatus(data))
      .catch((err) => {
        console.error("fetchRobotStatus error:", err);
        setStatus(null);
      })
      .finally(() => setLoading(false));
  }, [robotId]);

  useEffect(() => {
    if (!robotId || !config) return;

    const intervalMs = config.statusRefreshIntervalMs ?? 5000;

    const timer = setInterval(() => {
      fetchRobotStatus(robotId)
        .then((data) => setStatus(data))
        .catch(() => {});
    }, intervalMs);

    return () => clearInterval(timer);
  }, [robotId, config]);

  const device = status?.deviceStatus;
  const tasks = status?.tasks || [];
  const selectedRobot = config?.robots?.find(
    (item) => String(item.id) === String(robotId),
  );
  const assignUrl = `/zone-list?robotId=${encodeURIComponent(
    robotId || "",
  )}&robotName=${encodeURIComponent(selectedRobot?.name || status?.robot?.name || "")}`;

  const taskStatusColor = {
    delivering: "#1976d2",
    queue: "#ed6c02",
    pending: "#7b1fa2",
  };

  const floorText =
    device?.areaId === 3
      ? "ชั้น 1"
      : device?.areaId === 4
        ? "ชั้น 2"
        : device?.areaId === 5
          ? "ชั้น 3"
          : device?.areaId != null
            ? `Area ${device.areaId}`
            : "-";

  const reloadStatus = async () => {
    if (!robotId) return;

    const data = await fetchRobotStatus(robotId);
    setStatus(data);
  };

  const handleCancel = async (orderId) => {
    const result = await Swal.fire({
      title: "Cancel Order?",
      text: `Cancel order ${orderId}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Cancel Order",
      cancelButtonText: "Back",
      confirmButtonColor: "#d32f2f",
      cancelButtonColor: "#777",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      setActionLoading(true);

      await cancelOrder(orderId);

      await Swal.fire({
        icon: "success",
        title: "Cancelled",
        text: "Order cancelled before sending to RCS.",
        timer: 1200,
        showConfirmButton: false,
      });

      await reloadStatus();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Cancel failed",
        text:
          err?.response?.data?.error || err.message || "Cancel order failed",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRunning = async (orderId) => {
    const result = await Swal.fire({
      title: "Cancel Delivering?",
      text: `Cancel running order ${orderId} in RCS?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Cancel in RCS",
      cancelButtonText: "Back",
      confirmButtonColor: "#d32f2f",
      cancelButtonColor: "#777",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      setActionLoading(true);

      await cancelRunningOrder(orderId, false);

      await Swal.fire({
        icon: "success",
        title: "Cancelled",
        text: "Order cancelled in RCS and WebApp.",
        timer: 1200,
        showConfirmButton: false,
      });

      await reloadStatus();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Cancel failed",
        text:
          err?.response?.data?.error || err.message || "Cancel running failed",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleaseRunning = async (orderId) => {
    const result = await Swal.fire({
      title: "Release WebApp Status?",
      text: `Release WebApp status for running order ${orderId}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Release",
      cancelButtonText: "Back",
      confirmButtonColor: "#ed6c02",
      cancelButtonColor: "#777",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      setActionLoading(true);

      await cancelRunningOrder(orderId, true);

      await Swal.fire({
        icon: "success",
        title: "Released",
        text: "WebApp status released.",
        timer: 1200,
        showConfirmButton: false,
      });

      await reloadStatus();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Release failed",
        text: err?.response?.data?.error || err.message || "Release failed",
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <ScreenLayout
      title="สถานะหุ่นยนต์"
      onBack={() => navigate("/")}
      onHome={() => navigate("/")}
    >
      <Box
        sx={{
          width: "100%",
          minHeight: "80vh",
          p: 2,
        }}
      >
        <Box
          sx={{
            maxWidth: "420px",
            mx: "auto",
            bgcolor: "#fff",
            p: 2,
            mt: "5px",
          }}
        >
          <Typography
            sx={{
              textAlign: "center",
              color: "#0066c0",
              fontSize: "20px",
              fontWeight: 900,
              border: "2px solid #000",
              mb: 3,
            }}
          >
            TASK STATUS
          </Typography>

          {!config ? (
            <CircularProgress />
          ) : (
            <>
              <FormControl fullWidth>
                <Select
                  value={robotId}
                  onChange={(e) => setRobotId(e.target.value)}
                  sx={{
                    mb: 2,
                    height: 52,
                    fontWeight: 800,
                    bgcolor: "#fff",
                  }}
                >
                  {config.robots.map((item, index) => (
                    <MenuItem key={`${item.id}-${index}`} value={item.id}>
                      {item.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {loading ? (
                <CircularProgress />
              ) : (
                <Box
                  sx={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <Box
                    sx={{
                      border: "2px solid #111",
                      borderRadius: "4px",
                      p: "4px",
                      padding: "8px",
                    }}
                  >
                    <Typography
                      sx={{
                        display: "inline-block",
                        bgcolor: "#e3f2fd",
                        px: 1,
                        py: 0.5,
                        fontSize: 16,
                        fontWeight: 900,
                        mb: 1,
                      }}
                    >
                      AMR STATUS
                    </Typography>

                    <Typography variant="body2">
                      Robot : {status?.robot?.name || "-"}
                    </Typography>

                    {/* <Typography variant="body2">
                      Device No : {status?.robot?.deviceNum || "-"}
                    </Typography> */}

                    {device?.error ? (
                      <Box>
                        <Typography variant="body2" color="error">
                          RCS : {device.error}
                        </Typography>

                        {device?.url && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: "block",
                              mt: 1,
                              wordBreak: "break-all",
                            }}
                          >
                            URL : {device.url}
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      <>
                        <Typography variant="body2">
                          Status : {device?.agvStatus || device?.state || "-"}
                        </Typography>
                        {/* 
                        <Typography variant="body2">
                          Position : {device?.devicePosition || "-"}
                        </Typography> */}

                        <Typography variant="body2">
                          Battery : {device?.battery ?? "-"}%
                        </Typography>

                        <Typography variant="body2">
                          Charging :{" "}
                          {device?.charging ? "CHARGING" : "NOT CHARGING"}
                        </Typography>
                      </>
                    )}
                  </Box>

                  {tasks.length === 0 ? (
                    <Typography variant="body2">Not works.</Typography>
                  ) : (
                    <Box sx={{ width: "100%", overflowX: "auto" }}>
                      <Typography
                        sx={{
                          display: "inline-block",
                          bgcolor: "#e3f2fd",
                          px: 1,
                          py: 0.5,
                          fontSize: 16,
                          fontWeight: 900,
                          mb: 1,
                        }}
                      >
                        TASK STATUS
                      </Typography>

                      <Box
                        component="table"
                        sx={{
                          width: "100%",
                          borderCollapse: "separate",
                          borderSpacing: "5px 3px",
                          fontSize: 10,
                          "& th": {
                            textAlign: "left",
                            fontWeight: 900,
                            textDecoration: "underline",
                            py: 1.5,
                            whiteSpace: "nowrap",
                          },
                          "& td": {
                            py: 1.5,
                            pr: 1,
                            verticalAlign: "middle",
                            whiteSpace: "nowrap",
                          },
                        }}
                      >
                        <Box component="thead">
                          <Box component="tr" sx={{ gap: 6 }}>
                            <Box component="th">Task No</Box>
                            <Box component="th">Pick Up</Box>
                            <Box component="th">Drop Off</Box>
                            <Box component="th">Cart</Box>
                            <Box component="th">Status</Box>
                            <Box component="th"></Box>
                          </Box>
                        </Box>

                        <Box component="tbody">
                          {tasks.map((task, index) => (
                            <Box component="tr" key={task.orderId}>
                              <Box component="td" sx={{ textAlign: "center" }}>
                                {index + 1}
                              </Box>

                              <Box component="td">
                                {task.pickup?.name || "-"}
                              </Box>
                              <Box component="td">{task.drop?.name || "-"}</Box>
                              <Box component="td">
                                {task.cartName || task.cartId || "-"}
                              </Box>

                              <Box
                                component="td"
                                sx={{
                                  fontWeight: 900,
                                  color:
                                    taskStatusColor[task.statusWork] || "#000",
                                  textTransform: "capitalize",
                                }}
                              >
                                {task.statusWork === "queue"
                                  ? "Queued"
                                  : task.statusWork}
                              </Box>

                              <Box component="td" sx={{ textAlign: "center" }}>
                                {task.canCancel ? (
                                  <Button
                                    disabled={actionLoading}
                                    onClick={() => handleCancel(task.orderId)}
                                    sx={{
                                      minWidth: 28,
                                      width: 28,
                                      height: 28,
                                      p: 0,
                                      border: "2px solid #000",
                                      borderRadius: 0,
                                      bgcolor: "#fff",
                                      color: "#d32f2f",
                                      fontSize: 20,
                                      fontWeight: 900,
                                      lineHeight: 1,
                                      "&:hover": {
                                        bgcolor: "#ffecec",
                                      },
                                    }}
                                  >
                                    ✖
                                  </Button>
                                ) : task.statusWork === "delivering" ? (
                                  <Box sx={{ display: "flex", gap: 0.5 }}>
                                    <Button
                                      disabled={actionLoading}
                                      onClick={() =>
                                        handleCancelRunning(task.orderId)
                                      }
                                      sx={{
                                        minWidth: 28,
                                        width: 28,
                                        height: 28,
                                        p: 0,
                                        border: "2px solid #000",
                                        borderRadius: 0,
                                        bgcolor: "#fff",
                                        color: "#d32f2f",
                                        fontSize: 18,
                                        fontWeight: 900,
                                        lineHeight: 1,
                                        "&:hover": {
                                          bgcolor: "#ffecec",
                                        },
                                      }}
                                    >
                                      ✖
                                    </Button>

                                    <Button
                                      disabled={actionLoading}
                                      onClick={() =>
                                        handleReleaseRunning(task.orderId)
                                      }
                                      sx={{
                                        minWidth: 28,
                                        width: 28,
                                        height: 28,
                                        p: 0,
                                        border: "2px solid #000",
                                        borderRadius: 0,
                                        bgcolor: "#fff",
                                        color: "#ed6c02",
                                        fontSize: 14,
                                        fontWeight: 900,
                                        lineHeight: 1,
                                        "&:hover": {
                                          bgcolor: "#fff4e5",
                                        },
                                      }}
                                    >
                                      R
                                    </Button>
                                  </Box>
                                ) : null}
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    </Box>
                  )}

                  <Button
                    variant="contained"
                    disabled={!robotId}
                    onClick={() => navigate(assignUrl)}
                    sx={{
                      mt: 4,
                      height: 35,
                      bgcolor: "#0066c0",
                      color: "#fff",
                      fontSize: 16,
                      fontWeight: 900,
                      borderRadius: "4px",
                      "&:hover": {
                        bgcolor: "#0054a0",
                      },
                    }}
                  >
                    ASSIGN
                  </Button>
                </Box>
              )}
            </>
          )}
        </Box>
      </Box>
    </ScreenLayout>
  );
}

export default Status;
