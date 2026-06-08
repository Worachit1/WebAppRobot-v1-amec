import React from "react";
import { Box, Typography } from "@mui/material";

function MitsubishiLogo() {
  return (
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
      <Box sx={{ textAlign: "left" }}>
        <Typography
          variant="h5"
          sx={{
            textAlign: "center",
            fontWeight: 800,
            letterSpacing: 1,
            color: "#0066c0",
            border: "2px solid #000",
            mb: 1,
            py: 0.5,
          }}
        >
          AMR NO.01-MTM&STR
        </Typography>
      </Box>
    </Box>
  );
}

export default MitsubishiLogo;
