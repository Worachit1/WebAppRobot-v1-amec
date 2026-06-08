// import React, { useEffect, useState } from "react";
// import {
//   Box,
//   Chip,
//   CircularProgress,
//   MenuItem,
//   Select,
//   TextField,
//   Typography,
// } from "@mui/material";
// import { useNavigate } from "react-router-dom";

// import ScreenLayout from "../components/ScreenLayout.jsx";
// import { fetchHistory } from "../api/client.js";

// import { formatDateTime } from "../config/formatDatetime.js";

// import Pagination from "../components/Pagination.jsx";

// const STATUS_COLORS = {
//   COMPLETED: "success",
//   CANCELLED: "error",
//   RUNNING: "warning",
//   QUEUED: "default",
//   SEND_SUCCESS: "success",
//   SEND_FAILED: "error",
//   EXECUTION_FAILED: "error",
//   SENDING: "warning",
// };

// function HistoryCard({ item }) {
//   const chipColor = STATUS_COLORS[item.status] || "default";

//   return (
//     <Box
//       sx={{
//         width: "100%",
//         borderRadius: "8px",
//         border: "2px solid #111",
//         p: 2,
//         display: "flex",
//         justifyContent: "space-between",
//         alignItems: "flex-start",
//         gap: 2,
//       }}
//     >
//       <Box
//         sx={{
//           display: "flex",
//           flexDirection: "column",
//           gap: 0.5,
//         }}
//       >
//         <Typography variant="body2">หมายเลขคำสั่ง : {item.orderId}</Typography>
//         <Typography variant="body2">
//           รายละเอียด :<br /> {item.pickup?.name} → {item.drop?.name}
//         </Typography>
//         <Typography variant="body2">
//           เวลาดำเนินการ :<br /> {formatDateTime(item.startedAt) || "-"}
//         </Typography>
//         <Typography variant="body2">
//           สถานะหุ่นยนต์ :<br /> {item.status}
//         </Typography>
//       </Box>
//       <Chip
//         label={item.status}
//         color={chipColor}
//         size="small"
//         sx={{ fontSize: "12px" }}
//       />
//     </Box>
//   );
// }

// function HistoryRow({ item, index }) {
//   return (
//     <Box
//       sx={{
//         display: "grid",
//         gridTemplateColumns: "28px 99px 85px 35px 70px",
//         alignItems: "center",
//         minHeight: 32,
//       }}
//     >
//       <Typography sx={{ fontSize: "11px" }}>{index + 1}</Typography>

//       <Typography
//         sx={{
//           fontSize: "11px",
//           overflow: "hidden",
//           textOverflow: "ellipsis",
//           whiteSpace: "nowrap",
//         }}
//       >
//         {item.pickup?.name || "-"}
//       </Typography>

//       <Typography
//         sx={{
//           fontSize: "11px",
//           overflow: "hidden",
//           textOverflow: "ellipsis",
//           whiteSpace: "nowrap",
//         }}
//       >
//         {item.drop?.name || "-"}
//       </Typography>

//       <Typography sx={{ fontSize: "11px" }}>
//         {item.cartName || item.cartType || "-"}
//       </Typography>

//       <Typography
//         sx={{
//           fontSize: "10px",
//           fontWeight: 700,
//           color:
//             item.status === "SEND_SUCCESS"
//               ? "#2e7d32"
//               : item.status === "SEND_FAILED"
//                 ? "#d32f2f"
//                 : "#000",
//         }}
//       >
//         {item.status}
//       </Typography>
//     </Box>
//   );
// }

// function History() {
//   const navigate = useNavigate();
//   const [status, setStatus] = useState("ALL");
//   const [query, setQuery] = useState("");
//   const [items, setItems] = useState([]);
//   const [loading, setLoading] = useState(true);

//   const [page, setPage] = useState(1);
//   const rowsPerPage = 4;

//   useEffect(() => {
//     setLoading(true);
//     fetchHistory({ status, q: query })
//       .then((data) => setItems(data))
//       .finally(() => setLoading(false));
//   }, [status, query]);

//   const totalItems = items.length;
//   const startIndex = (page - 1) * rowsPerPage;
//   const paginatedItems = items.slice(startIndex, startIndex + rowsPerPage);

//   useEffect(() => {
//     setPage(1);
//   }, [status, query]);

//   return (
//     <ScreenLayout
//       title="ประวัติการสั่งงาน"
//       onBack={() => navigate("/")}
//       onHome={() => navigate("/")}
//     >
//       <Box
//         sx={{
//           width: "100%",
//           minHeight: "80vh",
//           p: 2,
//         }}
//       >
//         <Box
//           sx={{
//             maxWidth: "420px",
//             mx: "auto",
//             backgroundColor: "#fff",
//             p: 2,
//             marginTop: "5px",
//             padding: "12px",
//           }}
//         >
//           <Typography
//             sx={{
//               textAlign: "center",
//               color: "#0066c0",
//               fontSize: "20px",
//               fontWeight: 900,
//               border: "2px solid #000",
//               mb: 3,
//             }}
//           >
//             TASK HISTORY
//           </Typography>
//           <Box sx={{ display: "flex", width: "100%", gap: 2 }}>
//             <TextField
//               fullWidth
//               size="small"
//               placeholder="ค้นหา งาน / คำสั่ง"
//               value={query}
//               onChange={(e) => setQuery(e.target.value)}
//             />
//             <Select
//               size="small"
//               value={status}
//               onChange={(e) => setStatus(e.target.value)}
//               sx={{
//                 mb: 3,
//               }}
//             >
//               <MenuItem value="ALL">ทั้งหมด</MenuItem>
//               <MenuItem value="COMPLETED">Completed</MenuItem>
//               <MenuItem value="CANCELLED">Cancel</MenuItem>
//               <MenuItem value="RUNNING">On Task</MenuItem>
//             </Select>
//           </Box>
//           {loading ? (
//             <CircularProgress />
//           ) : (
//             <Box
//               sx={{
//                 display: "flex",
//                 flexDirection: "column",
//                 gap: 2,
//                 width: "100%",
//               }}
//             >
//               {items.length === 0 ? (
//                 <Typography variant="body2" color="text.secondary">
//                   ไม่มีรายการ
//                 </Typography>
//               ) : (
//                 <>
//                   <Box
//                     sx={{
//                       display: "grid",
//                       gridTemplateColumns: "28px 99px 85px 35px 70px",
//                       mb: 1,
//                     }}
//                   >
//                     <Typography sx={{ fontSize: "13px", fontWeight: 900 }}>
//                       Task
//                     </Typography>

//                     <Typography sx={{ fontSize: "13px", fontWeight: 900 }}>
//                       Pick Up
//                     </Typography>

//                     <Typography sx={{ fontSize: "13px", fontWeight: 900 }}>
//                       Drop Off
//                     </Typography>

//                     <Typography sx={{ fontSize: "13px", fontWeight: 900 }}>
//                       Cart
//                     </Typography>

//                     <Typography sx={{ fontSize: "13px", fontWeight: 900 }}>
//                       Status
//                     </Typography>
//                   </Box>

//                   {paginatedItems.map((item, index) => (
//                     <HistoryRow
//                       key={item.orderId}
//                       item={item}
//                       index={startIndex + index}
//                     />
//                   ))}

//                   <Pagination
//                     page={page}
//                     totalItems={totalItems}
//                     rowsPerPage={rowsPerPage}
//                     onPageChange={setPage}
//                   />
//                 </>
//               )}
//             </Box>
//           )}
//         </Box>
//       </Box>
//     </ScreenLayout>
//   );
// }

// export default History;
