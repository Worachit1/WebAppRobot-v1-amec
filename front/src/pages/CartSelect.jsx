import { useEffect, useMemo, useState } from "react";
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
import { fetchZoneDrop, updateSpotStatusCart } from "../api/client.js";

import Swal from "sweetalert2";

function CartSelect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const defaultGroupId = searchParams.get("groupId") || "";
  const defaultGroupName = searchParams.get("groupName") || "";

  const [items, setItems] = useState([]);
  const [groupId, setGroupId] = useState(defaultGroupId);
  const [stationId, setStationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [clearingId, setClearingId] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchZoneDrop()
      .then((res) => {
        setItems(res.data || []);
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

  const selectedGroup = useMemo(() => {
    return groups.find((g) => String(g.id) === String(groupId));
  }, [groups, groupId]);

  const stations = selectedGroup?.spots || selectedGroup?.stations || [];

  const selectedStation = useMemo(() => {
    return stations.find((s) => String(s.id) === String(stationId));
  }, [stations, stationId]);

  const fullStations = useMemo(() => {
    if (selectedStation) return [selectedStation];

    return stations.filter((station) => {
      const status = String(
        station.statusCart || station.cartStatus || station.status || "",
      ).toLowerCase();

      return status === "full";
    });
  }, [stations, selectedStation]);

  const updateSpotStatusCartHandler = async (station) => {
    if (!station?.id) {
      Swal.fire("ไม่พบ Spot ID", "", "warning");
      return;
    }

    const result = await Swal.fire({
      title: "คุณต้องการ CLEAR CART ใช่ไหม?",
      text: `Station: ${station.name || station.id}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "CLEAR",
      cancelButtonText: "Cancel",
      reverseButtons: true,
      confirmButtonColor: "#0066c0",
    });

    if (!result.isConfirmed) return;

    try {
      setClearingId(station.id);

      await updateSpotStatusCart(station.id, "empty");

      const res = await fetchZoneDrop();
      setItems(res.data || []);

      Swal.fire("CLEAR CART สำเร็จ!", "", "success");
    } catch (err) {
      console.error(err);

      Swal.fire(
        "Clear Cart ไม่สำเร็จ",
        err?.message || "เกิดข้อผิดพลาด",
        "error",
      );
    } finally {
      setClearingId("");
    }
  };

  return (
    <ScreenLayout
      title="CART ASSIGN"
      onBack={() => navigate("/zone-list")}
      onHome={() => navigate("/")}
    >
      <Box sx={{ width: "100%", maxWidth: 420, mx: "auto", p: 2 }}>
        <Typography
          sx={{
            textAlign: "center",
            color: "#0066c0",
            fontSize: "20px",
            fontWeight: 900,
            border: "2px solid #000",
            mb: 2,
            py: 0.3,
          }}
        >
          CART STATION
        </Typography>

        {loading ? (
          <CircularProgress />
        ) : (
          <>
            <Typography sx={{ fontSize: 18, fontWeight: 900, mb: 1 }}>
              GROUP
            </Typography>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <Select
                value={groupId}
                onChange={(e) => {
                  setGroupId(e.target.value);
                  setStationId("");
                }}
                displayEmpty
                sx={{
                  height: 52,
                  bgcolor: "#d9f2d0",
                  fontWeight: 900,
                  fontSize: 22,
                  borderRadius: 0,
                }}
              >
                {groups.map((group) => (
                  <MenuItem key={group.id} value={group.id}>
                    {group.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "70px 1fr 120px",
                gap: 1,
                mb: 1,
              }}
            >
              <Typography sx={{ fontWeight: 900 }}>GROUP</Typography>
              <Typography sx={{ fontWeight: 900 }}>STATION</Typography>
              <Typography sx={{ fontWeight: 900, textAlign: "center" }}>
                STATUS
              </Typography>
            </Box>

            {stations
              .filter(
                (station) =>
                  String(station.statusCart).toLowerCase() === "full",
              )
              .map((station) => (
                <Box
                  key={station.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "70px 1fr 120px",
                    gap: 1,
                    alignItems: "center",
                    mb: 1.5,
                  }}
                >
                  <Typography>{selectedGroup?.name}</Typography>
                  <Typography>{station.name}</Typography>

                  <Button
                    variant="contained"
                    color="error"
                    disabled={clearingId === station.id}
                    onClick={() => updateSpotStatusCartHandler(station)}
                  >
                    {clearingId === station.id ? "CLEARING..." : "CLEAR CART"}
                  </Button>
                </Box>
              ))}

            <Button
              onClick={() =>
                navigate(
                  `/cart-status?groupId=${encodeURIComponent(groupId)}&groupName=${encodeURIComponent(selectedGroup?.name || "")}`,
                )
              }
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
              CART STATUS
            </Button>
          </>
        )}
      </Box>
    </ScreenLayout>
  );
}

export default CartSelect;
