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
import Swal from "sweetalert2";

import ScreenLayout from "../components/ScreenLayout.jsx";
import { fetchZoneDrop, createHomeOrder } from "../api/client.js";
import { formatSpotName } from "../config/fotmatSpotName.js";

function BackHomePoint() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const robotId = searchParams.get("robotId");
  const robotName = searchParams.get("robotName");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [dropOff, setDropOff] = useState("");
  const [dropStations, setDropStations] = useState([]);

  const allowedHomePointIds = [
    "d-s-g-z3-home-cartreturn",
    "d-s-g-z3-home-feederin",
    "d-s-g-z3-home-home-ps-hp",
  ];

  useEffect(() => {
    setLoading(true);

    fetchZoneDrop()
      .then((dropRes) => {
        const dropZones = dropRes?.data || [];

        const allDropSpots = dropZones
          .flatMap((zone) =>
            (zone.groups || zone.group || []).flatMap(
              (group) => group.spots || [],
            ),
          )
          .filter((spot) => allowedHomePointIds.includes(String(spot.id)));

        setDropStations(allDropSpots);
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedDropStation = useMemo(() => {
    return dropStations.find((station) => station.id === dropOff);
  }, [dropStations, dropOff]);

  const handleConfirm = async () => {
    if (!robotId || !dropOff) return;

    const result = await Swal.fire({
      title: "Are You Sure",
      html: `
        <div style="text-align:left; font-size:18px;">
          <div><b>Robot:</b> ${robotName || "-"}</div>
          <div><b>Home Point:</b> ${formatSpotName(selectedDropStation?.name || "-")}</div>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Confirm",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#1976d2",
      cancelButtonColor: "#777",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      setSubmitting(true);

      await createHomeOrder({
        robotId,
        dropSpotId: dropOff,
      });

      navigate("/zone-list");
    } catch (err) {
      console.error(err);

      Swal.fire({
        icon: "error",
        title: "Back home failed",
        text: err?.response?.data?.error || err.message || "Back home failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const backToZoneListUrl = `/zone-list?robotId=${encodeURIComponent(
    robotId || "",
  )}&robotName=${encodeURIComponent(robotName || "")}`;

  const handleBack = () => {
    navigate(backToZoneListUrl);
  };

  if (loading) {
    return (
      <ScreenLayout onBack={handleBack} onHome={() => navigate("/")}>
        <CircularProgress />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout onBack={handleBack} onHome={() => navigate("/")}>
      <Box
        sx={{
          width: "100%",
          maxWidth: 460,
          mx: "auto",
          p: 2,
          bgcolor: "#fff",
        }}
      >
        <Typography
          sx={{
            textAlign: "center",
            color: "#0066c0",
            fontSize: 24,
            fontWeight: 900,
            border: "2px solid #000",
            mb: 2,
          }}
        >
          TASK HOME
        </Typography>

        <Box
          sx={{
            mb: 3,
            p: 1.5,
            border: "2px solid #000",
            bgcolor: "#f5f5f5",
          }}
        >
          <Typography sx={{ fontSize: 18, fontWeight: 900 }}>ROBOT</Typography>

          <Typography sx={{ fontSize: 24 }}>{robotName || "-"}</Typography>
        </Box>

        <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 1 }}>
          HOME POINT
        </Typography>

        <FormControl fullWidth sx={{ mb: 4 }}>
          <Select
            value={dropOff}
            displayEmpty
            onChange={(e) => setDropOff(e.target.value)}
            sx={{
              height: 64,
              fontSize: 20,
              borderRadius: "4px",
              bgcolor: "#fff",
              "& .MuiSelect-icon": {
                bgcolor: "#9fe3ff",
                height: "100%",
                width: 72,
                top: 0,
                right: 0,
              },
            }}
          >
            <MenuItem value="" disabled>
              ---Select Home Point---
            </MenuItem>

            {dropStations.map((station) => (
              <MenuItem key={station.id} value={station.id}>
                {formatSpotName(station.name)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Button
            onClick={handleBack}
            sx={{
              color: "#000",
              fontSize: 24,
              fontWeight: 800,
              textTransform: "none",
              border: "2px solid #d32f2f",
              borderRadius: "4px",
            }}
          >
            Cancel
          </Button>

          <Button
            disabled={!dropOff || !robotId || submitting}
            variant="contained"
            onClick={handleConfirm}
            sx={{
              minWidth: 170,
              height: 64,
              fontSize: 28,
              fontWeight: 900,
              borderRadius: "4px",
              textTransform: "none",
            }}
          >
            {submitting ? "Sending..." : "Confirm"}
          </Button>
        </Box>
      </Box>
    </ScreenLayout>
  );
}

export default BackHomePoint;
