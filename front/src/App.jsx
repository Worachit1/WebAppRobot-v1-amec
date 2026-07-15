import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { OrderProvider } from "./context/OrderContext.jsx";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";

import History from "./pages/History.jsx";
import Status from "./pages/Status.jsx";

import ZoneList from "./pages/Zonelist.jsx";

import TaskAssign from "./pages/TaskAssign.jsx";
import CartSelect from "./pages/CartSelect.jsx";
import CartSelectStatus from "./pages/CartSelectStatus.jsx";
import SelectRobot from "./pages/SelectRobot.jsx";
import BackHomePoint from "./pages/BAckHomePoint.jsx";

function isAuthed() {
  return Boolean(localStorage.getItem("authUser"));
}

function RequireAuth({ children }) {
  if (!isAuthed()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <OrderProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Home />
            </RequireAuth>
          }
        />

        <Route
          path="/history"
          element={
            <RequireAuth>
              <History />
            </RequireAuth>
          }
        />
        <Route
          path="/status"
          element={
            <RequireAuth>
              <Status />
            </RequireAuth>
          }
        />
        <Route
          path="/zone-list"
          element={
            <RequireAuth>
              <ZoneList />
            </RequireAuth>
          }
        />

        <Route
          path="/task-assign/:zoneId"
          element={
            <RequireAuth>
              <TaskAssign />
            </RequireAuth>
          }
        />

        <Route
          path="/cart-select"
          element={
            <RequireAuth>
              <CartSelect />
            </RequireAuth>
          }
        />

        <Route
          path="/cart-status"
          element={
            <RequireAuth>
              <CartSelectStatus />
            </RequireAuth>
          }
        />

        <Route
          path="/select-robot"
          element={
            <RequireAuth>
              <SelectRobot />
            </RequireAuth>
          }
        />

        <Route
          path="/back-home-point"
          element={
            <RequireAuth>
              <BackHomePoint />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </OrderProvider>
  );
}

export default App;
