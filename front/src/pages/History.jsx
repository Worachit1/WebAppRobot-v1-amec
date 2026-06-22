import React, { useEffect, useState } from "react";
import {
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  ListItemText,
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

const FILTER_OPTIONS = [
  { value: "orderId", label: "หมายเลขคำสั่ง" },
  { value: "robotName", label: "Robot" },
  { value: "pickup", label: "Pick Up" },
  { value: "drop", label: "Drop Off" },
  { value: "cartName", label: "Cart" },
];

function HistoryCard({ item }) {
  const chipColor = STATUS_COLORS[item.status] || "default";

  return (
    <Box
      sx={{
        width: "100%",
        borderRadius: "8px",
        border: "2px solid #111",
        p: 2,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 2,
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 0.5,
        }}
      >
        <Typography variant="body2">
          <span style={{ fontWeight: 600 }}>หมายเลขคำสั่ง :</span>{" "}
          {item.orderId}
        </Typography>
        <Typography variant="body2">
          <span style={{ fontWeight: 600 }}>Robot :</span> {item.robotName}
        </Typography>
        <Typography variant="body2">
          <span style={{ fontWeight: 700 }}>Pick Up :</span> <br />{" "}
          {item.pickup?.name}
        </Typography>
        <Typography variant="body2">
          <span style={{ fontWeight: 700 }}>Drop Off :</span>
          <br /> {item.drop?.name}
        </Typography>
        <Typography variant="body2">
          <span style={{ fontWeight: 600 }}>เวลาดำเนินการ :</span>
          <br /> {formatDateTime(item.startedAt) || "-"}
        </Typography>
        <Typography variant="body2">
          <span style={{ fontWeight: 700 }}>Cart :</span> {item.cartName}
        </Typography>
      </Box>
      <Chip
        label={item.status}
        color={chipColor}
        size="small"
        sx={{ fontSize: "12px", fontWeight: 700 }}
      />
    </Box>
  );
}

function History() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("ALL");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const rowsPerPage = defaultRowsPerPage;

  const [searchFields, setSearchFields] = useState(
    FILTER_OPTIONS.map((o) => o.value),
  );

  useEffect(() => {
    setLoading(true);
    fetchHistory({
      status,
      q: query,
      fields: searchFields,
    })
      .then((data) => setItems(data))
      .finally(() => setLoading(false));
  }, [status, query, searchFields]);

  const totalItems = items.length;
  const startIndex = (page - 1) * rowsPerPage;
  const paginatedItems = items.slice(startIndex, startIndex + rowsPerPage);

  useEffect(() => {
    setPage(1);
  }, [status, query]);

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
          p: 2,
        }}
      >
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
            TASK HISTORY
          </Typography>
          <Box sx={{ display: "flex", width: "100%", gap: 1.5, mb: 3 }}>
            <TextField
              size="small"
              placeholder="ค้นหา"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              sx={{ width: "150px" }}
            />

            <Select
              multiple
              size="small"
              value={searchFields}
              displayEmpty
              renderValue={(selected) =>
                selected.length === FILTER_OPTIONS.length
                  ? "เลือกทั้งหมด"
                  : `${selected.length} ตัวกรอง`
              }
              onChange={(e) => {
                const value =
                  typeof e.target.value === "string"
                    ? e.target.value.split(",")
                    : e.target.value;

                if (value.includes("ALL")) {
                  setSearchFields(
                    searchFields.length === FILTER_OPTIONS.length
                      ? []
                      : FILTER_OPTIONS.map((o) => o.value),
                  );
                  return;
                }

                setSearchFields(value);
              }}
              sx={{ width: "130px" }}
            >
              <MenuItem value="ALL">
                <Checkbox
                  checked={searchFields.length === FILTER_OPTIONS.length}
                />
                <ListItemText primary="เลือกทั้งหมด" />
              </MenuItem>

              {FILTER_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Checkbox checked={searchFields.includes(option.value)} />
                  <ListItemText primary={option.label} />
                </MenuItem>
              ))}
            </Select>

            <Select
              size="small"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              sx={{ width: "110px" }}
            >
              <MenuItem value="ALL">ทั้งหมด</MenuItem>
              <MenuItem value="SEND_SUCCESS">Success</MenuItem>
              <MenuItem value="SEND_FAILED">Failed</MenuItem>
            </Select>
          </Box>
          {loading ? (
            <CircularProgress />
          ) : (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                width: "100%",
              }}
            >
              {items.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  ไม่มีรายการ
                </Typography>
              ) : (
                <>
                  {paginatedItems.map((item) => (
                    <HistoryCard key={item.orderId} item={item} />
                  ))}

                  <Pagination
                    page={page}
                    totalItems={totalItems}
                    rowsPerPage={rowsPerPage}
                    onPageChange={setPage}
                  />
                </>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </ScreenLayout>
  );
}

export default History;
