import React from "react";
import { Box, IconButton, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import HomeIcon from "@mui/icons-material/Home";

function ScreenLayout({ title, onBack, onHome, children, showBack = true }) {
  return (
    <Box
      sx={{
        minHeight: "80vh",
        bgcolor: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        px: 2,
        pt: 3,
        pb: 6
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 420,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <IconButton onClick={onBack} disabled={!showBack} sx={{ opacity: showBack ? 1 : 0 }}>
          <ArrowBackIcon />
        </IconButton>
        <IconButton onClick={onHome}>
          <HomeIcon />
        </IconButton>
      </Box>

      <Box
        sx={{
          mt: 2,
          width: "100%",
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default ScreenLayout;
