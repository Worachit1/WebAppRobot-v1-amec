import React, { useEffect, useState } from "react";
import {
  Box,
  CircularProgress,
  FormControl,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import ScreenLayout from "../components/ScreenLayout.jsx";
import { fetchConfig, fetchRobotStatus } from "../api/client.js";

import { formatDateTime } from "../config/formatDatetime.js";

function Status() {
  const navigate = useNavigate();

  const [config, setConfig] = useState(null);
  const [robotId, setRobotId] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfig().then((data) => {
      setConfig(data);

      const firstRobot = data.robots?.find((item) => item.id);
      if (firstRobot) {
        setRobotId(firstRobot.id);
      }
    });
  }, []);

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

  const latestOrderId = status?.latestOrder?.orderId;
  const device = status?.deviceStatus;
  const latestOrder = status?.latestOrder;

  const statusCart = status?.taskStatus?.statusCart;
  const statusWork = status?.taskStatus?.statusWork;

  const displayTaskStatus =
    statusWork === "delivering"
      ? "delivering"
      : statusWork === "queue"
        ? "queue"
        : statusCart === "full" && statusWork === "free"
          ? "pending"
          : null;

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
                  {config.robots
                    ?.filter((item) => item.id)
                    .map((item, index) => (
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
                        fontSize: 18,
                        fontWeight: 900,
                        mb: 0.5,
                        color: "#0066c0",
                        textDecoration: "underline",
                        textUnderlineOffset: "2px",
                      }}
                    >
                      AMR STATUS
                    </Typography>

                    <Typography variant="body2">
                      ชื่อหุ่นยนต์ : {status?.robot?.name || "-"}
                    </Typography>

                    <Typography variant="body2">
                      Device No : {status?.robot?.deviceNum || "-"}
                    </Typography>

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
                          สถานะ AMR :{" "}
                          {device?.agvStatus || device?.state || "-"}
                        </Typography>

                        <Typography variant="body2">
                          ชั้นที่พบ : {floorText}
                        </Typography>

                        <Typography variant="body2">
                          ตำแหน่ง : {device?.devicePosition || "-"}
                        </Typography>

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
                        fontSize: 18,
                        fontWeight: 900,
                        mb: 0.5,
                        color: "#0066c0",
                        textDecoration: "underline",
                        textUnderlineOffset: "2px",
                      }}
                    >
                      TASK DETAIL
                    </Typography>
                    
                    <Typography variant="body2">
                      หมายเลขคำสั่ง : {latestOrderId || "-"}
                    </Typography>

                    <Typography variant="body2">
                      Pickup : {latestOrder?.pickup?.name || "-"}
                    </Typography>

                    <Typography variant="body2">
                      Drop Off : {latestOrder?.drop?.name || "-"}
                    </Typography>

                    <Typography variant="body2">
                      Cart :{" "}
                      {latestOrder?.cartName || latestOrder?.cartId || "-"}
                    </Typography>

                    <Typography variant="body2">
                      เวลาดำเนินการ :{" "}
                      {formatDateTime(latestOrder?.startedAt) || "-"}
                    </Typography>

                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      <Typography variant="body2">สถานะงาน :</Typography>

                      {displayTaskStatus ? (
                        <Box
                          sx={{
                            px: 1.5,
                            py: 0.5,
                            borderRadius: "6px",
                            bgcolor: taskStatusColor[displayTaskStatus],
                            color: "#fff",
                            fontWeight: 800,
                            fontSize: "12px",
                            textTransform: "uppercase",
                          }}
                        >
                          {displayTaskStatus}
                        </Box>
                      ) : (
                        <Typography variant="body2">-</Typography>
                      )}
                    </Box>

                    <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                      {/* <Button
                        variant="contained"
                        color="error"
                        size="small"
                        disabled={!latestOrderId || actionLoading}
                        onClick={() => handleCancel(latestOrderId)}
                      >
                        Cancel
                      </Button> */}
                    </Box>
                  </Box>
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
