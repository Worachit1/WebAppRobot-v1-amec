import { useEffect, useMemo, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";

import ScreenLayout from "../components/ScreenLayout.jsx";
import { fetchZoneDrop } from "../api/client.js";
import { formatSpotName } from "../config/fotmatSpotName.js";

function CartSelectStatus() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const defaultGroupId = searchParams.get("groupId") || "";

  const robotId = searchParams.get("robotId");
  const robotName = searchParams.get("robotName");

  const [items, setItems] = useState([]);
  const [groupId, setGroupId] = useState(defaultGroupId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    fetchZoneDrop()
      .then((res) => {
        setItems(res.data || []);
      })
      .catch((err) => {
        console.error("fetchZoneDrop error:", err);
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => {
    return items.flatMap((zone) =>
      (zone.groups || []).map((group) => ({
        ...group,
        zoneId: zone.id,
        zoneName: zone.name,
      })),
    );
  }, [items]);

  useEffect(() => {
    if (!groupId && groups.length > 0) {
      setGroupId(groups[0].id);
    }
  }, [groupId, groups]);

  const selectedGroup = useMemo(() => {
    return groups.find((group) => String(group.id) === String(groupId));
  }, [groups, groupId]);

  const stations = selectedGroup?.spots || selectedGroup?.stations || [];

  const handleBack = () => {
    navigate(
      `/cart-select?groupId=${encodeURIComponent(groupId)}&groupName=${encodeURIComponent(selectedGroup?.name || "")}
      &robotId=${encodeURIComponent(robotId || "")}&robotName=${encodeURIComponent(robotName || "")}`,
    );
  };

  return (
    <ScreenLayout onBack={handleBack} onHome={() => navigate("/")}>
      <Box
        sx={{ width: "100%", maxWidth: 390, mx: "auto", p: 2, bgcolor: "#fff" }}
      >
        <Typography
          sx={{
            textAlign: "center",
            color: "#0066c0",
            fontSize: "20px",
            fontWeight: 900,
            border: "2px solid #000",
            mb: 2,
            py: 0.4,
          }}
        >
          CART STATUS
        </Typography>

        {loading ? (
          <CircularProgress />
        ) : (
          <>
            <Box
              sx={{
                display: "flex",
                gap: 2,
                overflowX: "auto",
                mb: 3,
                pb: 1,

                scrollbarWidth: "none", // Firefox
                "&::-webkit-scrollbar": {
                  display: "none", // Chrome/Safari
                },
              }}
            >
              {groups.map((group) => {
                const active = String(group.id) === String(groupId);

                return (
                  <Button
                    key={group.id}
                    onClick={() => {
                      navigate(
                        `/cart-select-status?groupId=${encodeURIComponent(
                          group.id,
                        )}&robotId=${encodeURIComponent(
                          robotId || "",
                        )}&robotName=${encodeURIComponent(robotName || "")}`,
                      );
                    }}
                    sx={{
                      minWidth: 55,
                      height: 45,
                      bgcolor: active ? "blue" : "#777",
                      color: "#fff",
                      border: "1px solid #000",
                      borderRadius: "2px",
                      fontWeight: 900,
                      "&:hover": {
                        bgcolor: active ? "blue" : "#666",
                      },
                    }}
                  >
                    {group.name}
                  </Button>
                );
              })}
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "72px 1fr 100px",
                mb: 1.5,
              }}
            >
              <Typography sx={{ fontWeight: 900, fontSize: 14 }}>
                GROUP
              </Typography>
              <Typography sx={{ fontWeight: 900, fontSize: 14 }}>
                STATION
              </Typography>
              <Typography sx={{ fontWeight: 900, fontSize: 14 }}>
                STATUS
              </Typography>
            </Box>

            {stations.map((station) => {
              const status = String(
                station.statusCart ||
                  station.cartStatus ||
                  station.status ||
                  "empty",
              ).toLowerCase();
              const isFull = status === "full";

              return (
                <Box
                  key={station.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "72px 1fr 100px",
                    alignItems: "center",
                    minHeight: 56,
                  }}
                >
                  <Typography sx={{ fontSize: 16 }}>
                    {selectedGroup?.name}
                  </Typography>
                  <Typography sx={{ fontSize: 16 }}>
                    {formatSpotName(station.name)}
                  </Typography>

                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Box
                      sx={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        border: "2px solid #000",
                        bgcolor: isFull ? "red" : "#fff",
                        mr: "8px",
                      }}
                    />
                    <Typography sx={{ fontSize: 16 }}>
                      {isFull ? "FULL" : "EMPTY"}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </>
        )}
        <Button
          onClick={handleBack}
          sx={{
            mt: 8,
            bgcolor: "#9fd0f0",
            color: "#000",
            borderRadius: "4px",
            fontWeight: 900,
            boxShadow: "2px 3px 5px rgba(0,0,0,0.5)",
            "&:hover": {
              bgcolor: "#8cc3e8",
            },
          }}
        >
          CART STATION
        </Button>
      </Box>
    </ScreenLayout>
  );
}

export default CartSelectStatus;
