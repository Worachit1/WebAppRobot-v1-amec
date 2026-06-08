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
import { useNavigate } from "react-router-dom";

import ScreenLayout from "../components/ScreenLayout.jsx";
import {
  fetchConfig,
  fetchRobotStatus,
  cancelOrder,
  clearTask,
} from "../api/client.js";

function Status() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [robotId, setRobotId] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchConfig().then((data) => {
      setConfig(data);
      if (data.robots?.length) {
        setRobotId(data.robots[0].id);
      }
    });
  }, []);

  const reloadStatus = async () => {
    if (!robotId) return;
    const data = await fetchRobotStatus(robotId);
    setStatus(data);
  };

  useEffect(() => {
    if (!robotId) return;

    setLoading(true);

    fetchRobotStatus(robotId)
      .then((data) => {
        setStatus(data);
      })
      .catch((err) => {
        console.error("fetchRobotStatus error:", err);
        setStatus(null);
      })
      .finally(() => {
        setLoading(false);
      });
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

  const handleCancel = async (orderId) => {
    if (!orderId || actionLoading) return;

    try {
      setActionLoading(true);
      await cancelOrder(orderId);
      await reloadStatus();
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearTask = async (orderId) => {
    if (!orderId || actionLoading) return;

    try {
      setActionLoading(true);
      await clearTask(orderId);
      await reloadStatus();
    } finally {
      setActionLoading(false);
    }
  };

  const latestOrderId = status?.latestOrder?.orderId;

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
            backgroundColor: "#fff",
            p: 2,
            marginTop: "5px",
            padding: "12px",
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
            <FormControl fullWidth>
              <Select
                value={robotId}
                onChange={(e) => setRobotId(e.target.value)}
                 sx={{
                  mb:3
                 }}
              >
                {config.robots?.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

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
              <Box sx={{ border: "2px solid #111", borderRadius: 2, p: 2 }}>
                <Typography variant="body2">
                  ชื่อหุ่นยนต์ : {status?.robot?.name}
                </Typography>

                {status?.deviceStatus?.error ? (
                  <Box>
                    <Typography variant="body2" color="error">
                      RCS: {status.deviceStatus.error}
                    </Typography>

                    {status?.deviceStatus?.url && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mt: 1, wordBreak: "break-all" }}
                      >
                        URL: {status.deviceStatus.url}
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <>
                    {status?.deviceStatus?.areaId != null && (
                      <Typography variant="body2">
                        ชั้นที่พบ :{" "}
                        {status.deviceStatus.areaId === 3
                          ? "ชั้น 1"
                          : status.deviceStatus.areaId === 4
                            ? "ชั้น 2"
                            : status.deviceStatus.areaId === 5
                              ? "ชั้น 3"
                              : `Area ${status.deviceStatus.areaId}`}
                      </Typography>
                    )}

                    <Typography variant="body2">
                      สถานะปัจจุบัน :{" "}
                      {status?.deviceStatus?.agvStatus ||
                        status?.deviceStatus?.state ||
                        "-"}
                    </Typography>

                    {status?.deviceStatus?.devicePosition && (
                      <Typography variant="body2">
                        ตำแหน่ง : {status.deviceStatus.devicePosition}
                      </Typography>
                    )}

                    <Typography variant="body2">
                      สถานะแบตเตอรี่ : {status?.deviceStatus?.battery ?? "-"}%
                    </Typography>

                    <Typography variant="body2">
                      สถานะหุ่นยนต์ :{" "}
                      {status?.deviceStatus?.charging
                        ? "CHARGING"
                        : "NOT CHARGING"}
                    </Typography>
                  </>
                )}
              </Box>

              <Box sx={{ border: "2px solid #111", borderRadius: "8px", p: 2 }}>
                <Typography variant="body2">
                  หมายเลขคำสั่ง : {latestOrderId || "-"}
                </Typography>

                <Typography variant="body2">
                  รายละเอียด : {status?.latestOrder?.pickup?.name || "-"} →{" "}
                  {status?.latestOrder?.drop?.name || "-"}
                </Typography>

                <Typography variant="body2">
                  เวลาดำเนินการ : {status?.latestOrder?.startedAt || "-"}
                </Typography>

                <Typography variant="body2">
                  สถานะหุ่นยนต์ : {status?.latestOrder?.status || "-"}
                </Typography>

                <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                  <Button
                    variant="contained"
                    color="error"
                    size="small"
                    disabled={!latestOrderId || actionLoading}
                    onClick={() => handleCancel(latestOrderId)}
                  >
                    Cancel
                  </Button>

                  <Button
                    variant="contained"
                    color="warning"
                    size="small"
                    disabled={!latestOrderId || actionLoading}
                    onClick={() => handleClearTask(latestOrderId)}
                  >
                    Clear Task
                  </Button>
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </ScreenLayout>
  );
}

export default Status;
