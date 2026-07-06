import { useMemo, useState, useEffect } from "react";
import {
  Box,
  Button,
  FormControl,
  MenuItem,
  Select,
  Typography,
  CircularProgress,
} from "@mui/material";
import ScreenLayout from "../components/ScreenLayout.jsx";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  fetchZonePick,
  fetchZoneDrop,
  fetchCarts,
  fetchRobots,
  createOrder,
} from "../api/client.js";
import cartT2Img from "../../src/assets/images/cart/Cart T2.png";
import cartT3Img from "../../src/assets/images/cart/Cart T3.png";
import cartT6Img from "../../src/assets/images/cart/Cart T6.png";

import { dropRules } from "../config/dropRules.js";
import Swal from "sweetalert2";
import { formatSpotName } from "../config/fotmatSpotName.js";

const cartTypes = [
  { id: "t2", img: cartT2Img },
  { id: "t3", img: cartT3Img },
  { id: "t6", img: cartT6Img },
];

function TaskAssign() {
  const navigate = useNavigate();

  const { zoneId } = useParams();
  const [searchParams] = useSearchParams();

  const groupId = searchParams.get("groupId");
  const card = searchParams.get("card");
  const zoneName = searchParams.get("zoneName");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [pickup, setPickup] = useState("");
  const [dropOff, setDropOff] = useState("");
  const [cartType, setCartType] = useState("");

  const [pickupStations, setPickupStations] = useState([]);
  const [dropStations, setDropStations] = useState([]);

  const [robots, setRobots] = useState([]);
  const [carts, setCarts] = useState([]);

  const robotId = searchParams.get("robotId");
  const robotName = searchParams.get("robotName");

  const selectedRobot =
    robots.find((robot) => String(robot.id) === String(robotId)) || null;

  const canSelectCart = Boolean(pickup && dropOff);

  useEffect(() => {
    setLoading(true);

    Promise.all([fetchZonePick(), fetchZoneDrop(), fetchCarts(), fetchRobots()])
      .then(([pickRes, dropRes, cartRes, robotRes]) => {
        const pickZones = pickRes?.data || [];
        const dropZones = dropRes?.data || [];

        const selectedGroup = pickZones
          .flatMap((zone) => zone.groups || zone.group || [])
          .find((group) => group.id === groupId);

        const allDropSpots = dropZones.flatMap((zone) =>
          (zone.groups || zone.group || []).flatMap(
            (group) => group.spots || [],
          ),
        );

        setPickupStations(selectedGroup?.spots || []);
        setDropStations(allDropSpots);
        setCarts(cartRes?.data || []);
        setRobots(robotRes?.data || []);
      })
      .finally(() => setLoading(false));
  }, [groupId]);

  const dropOptions = useMemo(() => {
    if (!pickup) return dropStations;

    const allowedDropIds = dropRules[pickup];
    if (!allowedDropIds) return dropStations;

    return dropStations.filter((station) =>
      allowedDropIds.includes(station.id),
    );
  }, [pickup, dropStations]);

  const selectedDropStation = useMemo(() => {
    return dropStations.find((station) => station.id === dropOff);
  }, [dropStations, dropOff]);

  const dropStatusCart = selectedDropStation?.statusCart || "empty";
  const dropStatusWork = selectedDropStation?.statusWork || "free";

  const handlePickupChange = (value) => {
    setPickup(value);
    setCartType("");

    const allowedDropIds = dropRules[value];
    const nextDropOptions = allowedDropIds
      ? dropStations.filter((station) => allowedDropIds.includes(station.id))
      : dropStations;

    if (!nextDropOptions.some((station) => station.id === dropOff)) {
      setDropOff("");
    }
  };

  const handleConfirm = async () => {
    if (!pickup || !dropOff || !cartType || !selectedRobot) return;

    const selectedPickupStation = pickupStations.find(
      (station) => station.id === pickup,
    );

    const selectedDropStation = dropStations.find(
      (station) => station.id === dropOff,
    );

    const result = await Swal.fire({
      title: "Are You Sure",
      html: `
      <div style="text-align:left; font-size:18px;">
        <div><b>Pick up:</b> ${formatSpotName(selectedPickupStation?.name || "-")}</div>
        <div><b>Drop Off:</b> ${formatSpotName(selectedDropStation?.name || "-")}</div>
        <div><b>Robot:</b> ${selectedRobot?.name || "-"}</div>
        <div><b>Cart:</b> ${String(cartType).toUpperCase()}</div>
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

      const res = await createOrder({
        robotId: selectedRobot.id,
        cartId: String(cartType),
        pickupSpotId: pickup,
        dropSpotId: dropOff,
      });

      const orderStatus = res?.status;

      if (orderStatus === "QUEUED") {
        await Swal.fire({
          icon: "info",
          title: "Added to Queue",
          text: "Drop Off not available, order added to queue. Please wait for the robot to finish its current task.",
          confirmButtonColor: "#1976d2",
        });
      } else if (orderStatus === "PENDING") {
        await Swal.fire({
          icon: "warning",
          title: "Pending",
          text: "Drop Off not available, order is pending. Please wait for the cart to be empty.",
          confirmButtonColor: "#ed6c02",
        });
      } else {
        await Swal.fire({
          icon: "success",
          title: "Order Sent",
          text: "Order sent successfully to the robot.",
          timer: 1200,
          showConfirmButton: false,
        });
      }
      // navigate(backToZoneListUrl);
      navigate("/");
    } catch (err) {
      console.error(err);

      Swal.fire({
        icon: "error",
        title: "Create order failed",
        text:
          err?.response?.data?.error || err.message || "Create order failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const backToZoneListUrl = `/zone-list?robotId=${encodeURIComponent(
    robotId || "",
  )}&robotName=${encodeURIComponent(robotName || "")}`;

  if (loading) {
    return (
      <ScreenLayout
        onBack={() => navigate(backToZoneListUrl)}
        onHome={() => navigate("/")}
      >
        <CircularProgress />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      onBack={() => navigate(backToZoneListUrl)}
      onHome={() => navigate("/")}
    >
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
          TASK ASSIGN
        </Typography>

        <Typography
          sx={{
            textAlign: "center",
            bgcolor: "#dff5d8",
            border: "1px solid #000",
            fontSize: 22,
            fontWeight: 900,
            py: 1,
            mb: 3,
          }}
        >
          {card}
        </Typography>

        <Box
          sx={{
            mb: 3,
            p: 1.5,
            border: "2px solid #000",
            bgcolor: "#f5f5f5",
          }}
        >
          <Typography
            sx={{
              fontSize: 18,
              fontWeight: 900,
            }}
          >
            ROBOT
          </Typography>

          <Typography
            sx={{
              fontSize: 24,
            }}
          >
            {robotName || "-"}
          </Typography>
        </Box>

        <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 1 }}>
          PICKUP
        </Typography>

        <FormControl fullWidth sx={{ mb: 2 }}>
          <Select
            value={pickup}
            displayEmpty
            onChange={(e) => handlePickupChange(e.target.value)}
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
              ---Select Pickup Station---
            </MenuItem>
            {pickupStations.map((station) => (
              <MenuItem key={station.id} value={station.id}>
                {formatSpotName(station.name)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 1 }}>
          DROP OFF
        </Typography>

        <FormControl fullWidth sx={{ mb: 2 }}>
          <Select
            value={dropOff}
            displayEmpty
            disabled={!pickup}
            onChange={(e) => {
              setDropOff(e.target.value);
              setCartType("");
            }}
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
              ---Select Drop Off Station---
            </MenuItem>
            {dropOptions.map((station) => (
              <MenuItem key={station.id} value={station.id}>
                {formatSpotName(station.name)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 1 }}>
          CART TYPE
        </Typography>

        <Box sx={{ display: "flex", gap: 3, mb: 3 }}>
          {cartTypes.map((cart) => {
            const isSelected = cartType === cart.id;

            return (
              <Button
                key={cart.id}
                disabled={!canSelectCart}
                onClick={() => setCartType(cart.id)}
                sx={{
                  width: 120,
                  height: 120,
                  borderRadius: "4px",
                  border: isSelected ? "4px solid #000" : "2px solid #333",
                  bgcolor: "#fff",
                  color: "#000",
                  p: 0.5,
                  opacity: canSelectCart ? 1 : 0.45,
                  cursor: canSelectCart ? "pointer" : "not-allowed",
                  "&:hover": {
                    bgcolor: "#fff",
                  },
                  "&.Mui-disabled": {
                    bgcolor: "#fff",
                  },
                }}
              >
                <Box
                  component="img"
                  src={cart.img}
                  alt={`Cart type ${cart.id}`}
                  sx={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    filter: isSelected ? "none" : "grayscale(100%)",
                  }}
                />
              </Button>
            );
          })}
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            mb: 4,
          }}
        >
          <Typography sx={{ fontSize: 22, fontWeight: 900 }}>
            DROP OFF STATUS :
          </Typography>

          <Button
            disabled
            sx={{
              minWidth: 120,
              height: 48,
              bgcolor: dropStatusCart === "full" ? "#ed6c2f" : "#2e7d32",
              color: "#fff !important",
              fontSize: 18,
              fontWeight: 900,
              "&.Mui-disabled": {
                bgcolor: dropStatusCart === "full" ? "#ed6c2f" : "#2e7d32",
                color: "#fff",
                opacity: 1,
              },
            }}
          >
            {dropStatusCart.toUpperCase()}
          </Button>
        </Box>

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Button
            onClick={() => navigate(backToZoneListUrl)}
            sx={{
              color: "#000",
              fontSize: 24,
              fontWeight: 800,
              textTransform: "none",
              border: "2px solid #d32f2f",
              "&:hover": {
                bgcolor: "#e95656",
                color: "#fff",
              },
              borderRadius: "4px",
            }}
          >
            Cancel
          </Button>

          <Button
            disabled={
              !pickup || !dropOff || !cartType || !selectedRobot || submitting
            }
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

export default TaskAssign;
