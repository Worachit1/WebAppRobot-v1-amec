import React, { useEffect, useState } from "react";
import {
  Box,
  Chip,
  CircularProgress,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import ScreenLayout from "../components/ScreenLayout.jsx";
import { fetchHistory } from "../api/client.js";

import { formatDateTime } from "../config/formatDatetime.js";

import Pagination from "../components/Pagination.jsx";
import { defaultRowsPerPage } from "../config/rowPerPages.js";

import { formatSpotName } from "../config/fotmatSpotName.js";

const STATUS_COLORS = {
  COMPLETED: "success",
  CANCELLED: "error",
  RUNNING: "warning",
  QUEUED: "default",
  SEND_SUCCESS: "success",
  SEND_FAILED: "error",
  EXECUTION_FAILED: "error",
  SENDING: "warning",
};

function History() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("ALL");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const rowsPerPage = defaultRowsPerPage;

  const paginatedItems = items;

  useEffect(() => {
    setLoading(true);

    fetchHistory({
      status,
      q: query,
      page,
      limit: rowsPerPage,
    })
      .then((data) => {
        setItems(data.items || []);
        setTotalItems(data.pagination?.totalItems || 0);
      })
      .finally(() => setLoading(false));
  }, [status, query, page, rowsPerPage]);

  const handleQueryChange = (e) => {
    setPage(1);
    setQuery(e.target.value);
  };

  const handleStatusChange = (e) => {
    setPage(1);
    setStatus(e.target.value);
  };

  return (
    <ScreenLayout
      title="ประวัติการสั่งงาน"
      onBack={() => navigate("/")}
      onHome={() => navigate("/")}
    >
      <Box
        sx={{
          width: "100%",
          minHeight: "80vh",
          p: 1,
        }}
      >
        <Box
          sx={{
            maxWidth: "420px",
            mx: "auto",
            backgroundColor: "#fff",
            p: 1,
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
              mb: 2,
            }}
          >
            TASK HISTORY
          </Typography>

          <Box sx={{ display: "flex", width: "100%", gap: 2, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search"
              value={query}
              onChange={handleQueryChange}
            />

            <Select
              size="small"
              value={status}
              onChange={handleStatusChange}
              sx={{ minWidth: 135 }}
            >
              <MenuItem value="ALL">ALL</MenuItem>
              <MenuItem value="QUEUED">Waiting Queue</MenuItem>
              <MenuItem value="PENDING">Pending</MenuItem>
              <MenuItem value="SEND_SUCCESS">Success</MenuItem>
              <MenuItem value="SEND_FAILED">Failed</MenuItem>
              <MenuItem value="CANCELLED">Cancelled</MenuItem>
            </Select>
          </Box>

          {loading ? (
            <CircularProgress />
          ) : items.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              ไม่มีรายการ
            </Typography>
          ) : (
            <>
              <Box sx={{ width: "100%", overflowX: "auto" }}>
                <Box
                  component="table"
                  sx={{
                    width: "100%",
                    borderCollapse: "separate",
                    borderSpacing: "5px 25px",
                    fontSize: 10,
                    "& th": {
                      textAlign: "left",
                      fontWeight: 900,
                      textDecoration: "underline",
                      whiteSpace: "nowrap",
                    },
                    "& td": {
                      verticalAlign: "middle",
                      whiteSpace: "nowrap",
                    },
                  }}
                >
                  <Box component="thead">
                    <Box component="tr">
                      <Box component="th">Task</Box>
                      <Box component="th">Pick Up</Box>
                      <Box component="th">Drop Off</Box>
                      <Box component="th">Cart</Box>
                      <Box component="th">Robot</Box>
                      <Box component="th">Status</Box>
                    </Box>
                  </Box>

                  <Box component="tbody">
                    {paginatedItems.map((item, index) => {
                      const statusLabel =
                        item.status === "SEND_SUCCESS"
                          ? "Success"
                          : item.status === "SEND_FAILED"
                            ? "Failed"
                            : item.status === "QUEUED"
                              ? "Queued"
                              : item.status === "PENDING"
                                ? "Pending"
                                : item.status === "CANCELLED"
                                  ? "Cancelled"
                                  : item.status || "-";

                      const statusColor =
                        item.status === "SEND_SUCCESS"
                          ? "#1976d2"
                          : item.status === "QUEUED"
                            ? "#ed6c02"
                            : item.status === "PENDING"
                              ? "#7b1fa2"
                              : item.status === "SEND_FAILED"
                                ? "#d32f2f"
                                : item.status === "CANCELLED"
                                  ? "#777"
                                  : "#000";

                      return (
                        <Box
                          component="tr"
                          key={`${item.orderId || "no-order"}-${item.status || "no-status"}-${page}-${index}`}
                        >
                          <Box component="td">
                            {(page - 1) * rowsPerPage + index + 1}
                          </Box>

                          <Box component="td">
                            {formatSpotName(item.pickup?.name || "-")}
                          </Box>

                          <Box component="td">
                            {formatSpotName(item.drop?.name || "-")}
                          </Box>

                          <Box component="td">
                            {item.cartName || item.cartId || "-"}
                          </Box>

                          <Box component="td">
                            {item.robotName || item.robotId || "-"}
                          </Box>

                          <Box
                            component="td"
                            sx={{
                              fontWeight: 900,
                              color: statusColor,
                              textTransform: "capitalize",
                            }}
                          >
                            {statusLabel}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              </Box>

              <Pagination
                page={page}
                totalItems={totalItems}
                rowsPerPage={rowsPerPage}
                onPageChange={setPage}
              />
            </>
          )}
        </Box>
      </Box>
    </ScreenLayout>
  );
}

export default History;
