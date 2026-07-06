import React, { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import ScreenLayout from "../components/ScreenLayout.jsx";
import AmrLogo from "../components/Amr-mtm-str.jsx";

import taskAssignImg from "../../src/assets/images/location_task_assign.jpg";
import cartIcon from "../../src/assets/images/cartIcon.png";

const TEST_PASSWORD = "AMECAMR26";

function Home() {
  const navigate = useNavigate();
  const [pendingPath, setPendingPath] = useState(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const openPasswordDialog = (path) => {
    setPendingPath(path);
    setPassword("");
    setError("");
  };

  const closeDialog = () => {
    setPendingPath(null);
    setPassword("");
    setError("");
  };

  const submitPassword = () => {
    if (password === TEST_PASSWORD) {
      const target = pendingPath;
      closeDialog();
      navigate(target);
    } else {
      setError("รหัสผ่านไม่ถูกต้อง");
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") submitPassword();
  };

  return (
    <ScreenLayout
      title="Home"
      onBack={() => {}}
      showBack={false}
      onHome={() => navigate("/")}
    >
      <AmrLogo />

      <Box
        sx={{
          display: "flex",
          gap: 4,
          width: "100%",
          justifyContent: "center",
          m: 4,
        }}
      >
        <Button
          variant="contained"
          onClick={() => navigate("/select-robot")}
          sx={{
            flex: 1,
            minHeight: 180,
            borderRadius: "4px",
            backgroundColor: "#f5f5f5",
            color: "#0066c0",
            fontSize: "18px",
            fontWeight: 800,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: "2px",
            boxShadow: "4px 4px 8px rgba(0,0,0,0.25)",
            "&:hover": {
              backgroundColor: "#ececec",
              boxShadow: "6px 6px 12px rgba(0,0,0,0.3)",
            },
          }}
        >
          <span>TASK ASSIGN</span>

          <img
            src={taskAssignImg}
            alt="Task Assign"
            style={{
              width: "150px",
              height: "100px",
              objectFit: "contain",
            }}
          />
        </Button>
        <Button
          variant="contained"
          color="inherit"
          sx={{
            flex: 1,
            minHeight: 180,
            borderRadius: "4px",
            backgroundColor: "#f5f5f5",
            color: "#0066c0",
            fontSize: "18px",
            fontWeight: 800,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: "2px",
            boxShadow: "4px 4px 8px rgba(0,0,0,0.25)",
            "&:hover": {
              backgroundColor: "#ececec",
              boxShadow: "6px 6px 12px rgba(0,0,0,0.3)",
            },
          }}
          onClick={() => navigate("/status")}
        >
          <span>TASK STATUS</span>
          <Box sx={{ fontSize: "56px", color: "#000" }}>
            <i className="fa-solid fa-chart-pie"></i>
          </Box>
        </Button>
      </Box>

      <Box
        sx={{
          display: "flex",
          gap: 4,
          width: "100%",
          justifyContent: "center",
          m: 4,
        }}
      >
        <Button
          variant="contained"
          color="inherit"
          sx={{
            flex: 1,
            minHeight: 180,
            borderRadius: "4px",
            backgroundColor: "#f5f5f5",
            color: "#0066c0",
            fontSize: "18px",
            fontWeight: 800,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: "2px",
            boxShadow: "4px 4px 8px rgba(0,0,0,0.25)",
            "&:hover": {
              backgroundColor: "#ececec",
              boxShadow: "6px 6px 12px rgba(0,0,0,0.3)",
            },
          }}
          onClick={() => navigate("/history")}
        >
          <span>TASK HISTORY</span>
          <Box
            sx={{
              fontSize: "56px",
              position: "relative",
              width: "70px",
              height: "90px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#000",
            }}
          >
            <i className="fa-regular fa-file-lines"></i>

            <i
              className="fa-solid fa-clock"
              style={{
                position: "absolute",
                right: "0",
                bottom: "4px",
                fontSize: "24px",
                backgroundColor: "#f5f5f5",
                borderRadius: "50%",
                padding: "2px",
                height: "32px",
              }}
            />
          </Box>
        </Button>
        {/* <Button
          variant="contained"
          color="inherit"
          sx={{
            flex: 1,
            minHeight: 180,
            borderRadius: "4px",
            backgroundColor: "#f5f5f5",
            color: "#0066c0",
            fontSize: "18px",
            fontWeight: 800,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: "2px",
            boxShadow: "4px 4px 8px rgba(0,0,0,0.25)",
            "&:hover": {
              backgroundColor: "#ececec",
              boxShadow: "6px 6px 12px rgba(0,0,0,0.3)",
            },
          }}
          // onClick={() => navigate("/cancel")}
        >
          <span>UTILIZATION</span>
          <Box
            sx={{
              fontSize: "56px",
              position: "relative",
              width: "80px",
              height: "90px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              color: "#000",
            }}
          >
            <i className="fa-solid fa-chart-column"></i>

            <i
              className="fa-solid fa-clock"
              style={{
                position: "absolute",
                left: "0",
                bottom: "0",
                fontSize: "24px",
                backgroundColor: "#f5f5f5",
                borderRadius: "50%",
                padding: "2px",
                height: "35px",
              }}
            />
          </Box>
        </Button> */}
      </Box>
    </ScreenLayout>
  );
}

export default Home;
