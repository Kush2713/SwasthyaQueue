import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useState } from "react";
import LoginPage from "./pages/LoginPage";
import PatientRegistration from "./pages/patient/PatientRegistration";
import PatientTokenPage from "./pages/patient/PatientTokenPage";
import PatientDashboard from "./pages/patient/PatientDashboard";
import StaffDashboard from "./pages/staff/StaffDashboard";
import LiveQueueDisplay from "./pages/display/LiveQueueDisplay";

function RoleGuard({ user, allowed, children }) {
  if (!user) return <Navigate to="/" replace />;
  if (!allowed.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [tokenData, setTokenData] = useState(null);

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
    if (loggedInUser.role === "patient") {
      setTokenData(null);
      navigate("/patient/register");
    } else {
      navigate("/staff/dashboard");
    }
  };

  const handleLogout = () => {
    setUser(null);
    setTokenData(null);
    navigate("/");
  };

  const handleRegistered = (payload) => {
    setTokenData(payload);
    navigate("/patient/token");
  };

  return (
    <Routes>
      <Route path="/" element={<LoginPage onLogin={handleLogin} />} />

      <Route
        path="/patient/register"
        element={
          <RoleGuard user={user} allowed={["patient"]}>
            <PatientRegistration user={user} onBack={() => navigate("/")} onRegistered={handleRegistered} />
          </RoleGuard>
        }
      />

      <Route
        path="/patient/token"
        element={
          <RoleGuard user={user} allowed={["patient"]}>
            {tokenData ? (
              <PatientTokenPage tokenData={tokenData} onBack={() => navigate("/patient/register")} onProceed={() => navigate("/patient/dashboard")} />
            ) : (
              <Navigate to="/patient/register" replace />
            )}
          </RoleGuard>
        }
      />

      <Route
        path="/patient/dashboard"
        element={
          <RoleGuard user={user} allowed={["patient"]}>
            <PatientDashboard user={user} tokenData={tokenData} onRegister={() => navigate("/patient/register")} onLogout={handleLogout} />
          </RoleGuard>
        }
      />

      <Route
        path="/staff/dashboard"
        element={
          <RoleGuard user={user} allowed={["staff"]}>
            <StaffDashboard user={user} onLogout={handleLogout} />
          </RoleGuard>
        }
      />

      <Route path="/display" element={<LiveQueueDisplay />} />
      <Route path="/tv" element={<LiveQueueDisplay />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
