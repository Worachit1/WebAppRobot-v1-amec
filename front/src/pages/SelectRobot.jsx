import { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  ButtonBase,
} from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";

import ScreenLayout from "../components/ScreenLayout.jsx";
import { fetchConfig } from "../api/client.js";

const DEFAULT_ROBOT_ID = "C100";

// function RobotCard({ robot, selected, onSelect }) {
//   return (
//     <ButtonBase
//       onClick={() => onSelect(robot)}
//       disableRipple
//       disableTouchRipple
//       focusRipple={false}
//       sx={{
//         display: "flex",
//         flexDirection: "column",
//         alignItems: "center",
//         gap: 1,
//         borderRadius: 2,
//         "&.Mui-focusVisible": {
//           outline: "none",
//         },
//       }}
//     >

// ใช้ชั่วคราวเพื่อให้เลือกได้เฉพาะ robot C100 เท่านั้น
function RobotCard({ robot, selected, disabled, onSelect }) {
  return (
    <ButtonBase
      onClick={() => {
        if (!disabled) onSelect(robot);
      }}
      disabled={disabled}
      disableRipple
      disableTouchRipple
      focusRipple={false}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1,
        borderRadius: 2,
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        "&.Mui-disabled": {
          opacity: 0.35,
        },
      }}
    >
      <Box
        sx={{
          width: 130,
          height: 130,
          borderRadius: "50%",
          border: "3px solid",
          borderColor: selected ? "#0066c0" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "#f6f6f6",
          overflow: "hidden",
        }}
      >
        {robot.imageUrl ? (
          <Box
            component="img"
            src={robot.imageUrl}
            alt={robot.name}
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        ) : (
          <Typography sx={{ fontWeight: 900 }}>{robot.name}</Typography>
        )}
      </Box>

      <Box
        sx={{
          px: 2,
          py: 0.5,
          borderRadius: 999,
          border: "1px solid #111",
          bgcolor: selected ? "#0066c0" : "#fff",
          color: selected ? "#fff" : "#111",
        }}
      >
        <Typography sx={{ fontWeight: 900 }}>{robot.name}</Typography>
      </Box>
    </ButtonBase>
  );
}

function SelectRobot() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const zoneId = searchParams.get("zoneId");
  const zoneName = searchParams.get("zoneName");
  const groupId = searchParams.get("groupId");
  const groupName = searchParams.get("groupName");
  const type = searchParams.get("type") || "CALL_AMR";

  const [robots, setRobots] = useState([]);
  const [selectedRobot, setSelectedRobot] = useState(null);
  const [loading, setLoading] = useState(true);

  // useEffect(() => {
  //   fetchConfig()
  //     .then((config) => {
  //       setRobots(config?.robots || []);
  //     })
  //     .finally(() => setLoading(false));
  // }, []);

  // ใช้ชั่วคราวเพื่อให้เลือกได้เฉพาะ robot C100 เท่านั้น
  useEffect(() => {
    fetchConfig()
      .then((config) => {
        const robotList = config?.robots || [];
        const defaultRobot = robotList.find(
          (robot) => String(robot.id) === DEFAULT_ROBOT_ID,
        );

        setRobots(robotList);
        setSelectedRobot(defaultRobot || null);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleNext = () => {
    if (!selectedRobot) return;

    if (type === "HOME") {
      navigate(
        `/back-home-point?robotId=${encodeURIComponent(
          selectedRobot.id,
        )}&robotName=${encodeURIComponent(selectedRobot.name)}`,
      );
      return;
    }

    navigate(
      `/zone-list?robotId=${encodeURIComponent(
        selectedRobot.id,
      )}&robotName=${encodeURIComponent(selectedRobot.name)}`,
    );
  };

  return (
    <ScreenLayout
      title="Select Robot"
      onBack={() => navigate("/")}
      onHome={() => navigate("/")}
      contentMaxWidth={900}
      headerMaxWidth={900}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 900,
          mx: "auto",
          p: 1,
        }}
      >
        <Typography
          sx={{
            width: "100%",
            textAlign: "center",
            color: "#0066c0",
            fontSize: 20,
            fontWeight: 900,
            border: "1px solid #000",
            mb: 7,
            py: 0.5,
            boxSizing: "border-box",
          }}
        >
          ROBOT SELECT
        </Typography>

        {loading ? (
          <CircularProgress />
        ) : (
          <>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 4,
                mb: 5,
                justifyItems: "center",
              }}
            >
              {robots.map((robot) => (
                <RobotCard
                  key={robot.id}
                  robot={robot}
                  selected={selectedRobot?.id === robot.id}
                  onSelect={setSelectedRobot}
                />
              ))}
              
              {/*ใช้ชั่วคราวเพื่อให้เลือกได้เฉพาะ robot C100 เท่านั้น */}
              {/* {robots.map((robot) => {
                const isLocked = String(robot.id) !== DEFAULT_ROBOT_ID;

                return (
                  <RobotCard
                    key={robot.id}
                    robot={robot}
                    selected={selectedRobot?.id === robot.id}
                    disabled={isLocked}
                    onSelect={setSelectedRobot}
                  />
                );
              })} */}
            </Box>

            <Box sx={{ width: "100%", mx: "auto" }}>
              <Button
                fullWidth
                variant="contained"
                disabled={!selectedRobot}
                onClick={handleNext}
                sx={{
                  borderRadius: "4px",
                  p: 1,
                  fontWeight: 900,
                  bgcolor: selectedRobot ? "#0066c0" : "#ccc",
                }}
              >
                Next
              </Button>
            </Box>
          </>
        )}
      </Box>
    </ScreenLayout>
  );
}

export default SelectRobot;
