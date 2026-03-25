import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import LoginPage from "./pages/LoginPage";
import PatientRegistration from "./pages/patient/PatientRegistration";
import PatientTokenPage from "./pages/patient/PatientTokenPage";
import PatientDashboard from "./pages/patient/PatientDashboard";
import StaffDashboard from "./pages/staff/StaffDashboard";
import ReceptionDashboard from "./pages/reception/ReceptionDashboard";
import PatientCasePage from "./pages/case/PatientCasePage";
import LiveQueueDisplay from "./pages/display/LiveQueueDisplay";
import { clearSession, getCurrentSession, getStoredSession, saveSession } from "./lib/api";

function RoleGuard({ user, allowed, children }) {
  if (!user) return <Navigate to="/" replace />;
  if (!allowed.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function CaseRoute({ user, onBack }) {
  const { queueId } = useParams();
  return <PatientCasePage queueId={queueId} user={user} onBack={onBack} />;
}

function AppRoutes() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [tokenData, setTokenData] = useState(null);
  const [authHydrated, setAuthHydrated] = useState(false);

  useEffect(() => {
    const storedSession = getStoredSession();
    if (!storedSession?.authToken) {
      setAuthHydrated(true);
      return;
    }

    getCurrentSession()
      .then((response) => {
        if (response?.user) {
          saveSession(response.user);
          setUser(response.user);
        } else {
          clearSession();
        }
      })
      .catch(() => {
        clearSession();
      })
      .finally(() => setAuthHydrated(true));
  }, []);

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
    saveSession(loggedInUser);
    if (loggedInUser.role === "patient") {
      setTokenData(null);
      navigate("/patient/dashboard");
    } else if (loggedInUser.role === "receptionist") {
      navigate("/reception/dashboard");
    } else if (loggedInUser.role === "nurse" || loggedInUser.role === "doctor") {
      navigate("/staff/dashboard");
    } else {
      navigate("/");
    }
  };

  const handleLogout = () => {
    setUser(null);
    setTokenData(null);
    clearSession();
    navigate("/");
  };

  const handleRegistered = (payload) => {
    setTokenData(payload);
    navigate("/patient/token");
  };

  if (!authHydrated) {
    return null;
  }

  return (
    <Routes>
      <Route path="/" element={<LoginPage onLogin={handleLogin} />} />

      <Route
        path="/patient/register"
        element={
          <RoleGuard user={user} allowed={["patient"]}>
            <PatientRegistration user={user} onBack={() => navigate("/patient/dashboard")} onRegistered={handleRegistered} />
          </RoleGuard>
        }
      />

      <Route path="/patient/book" element={<Navigate to="/patient/register" replace />} />

      <Route
        path="/patient/token"
        element={
          <RoleGuard user={user} allowed={["patient"]}>
            {tokenData ? (
              <PatientTokenPage tokenData={tokenData} onBack={() => navigate("/patient/dashboard")} onProceed={() => navigate("/patient/dashboard")} />
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
        path="/reception/dashboard"
        element={
          <RoleGuard user={user} allowed={["receptionist"]}>
            <ReceptionDashboard user={user} onLogout={handleLogout} />
          </RoleGuard>
        }
      />

      <Route
        path="/staff/dashboard"
        element={
          <RoleGuard user={user} allowed={["nurse", "doctor"]}>
            <StaffDashboard user={user} onLogout={handleLogout} />
          </RoleGuard>
        }
      />

      <Route
        path="/case/queue/:queueId"
        element={
          <RoleGuard user={user} allowed={["receptionist", "nurse", "doctor"]}>
            <CaseRoute user={user} onBack={() => navigate(user?.role === "receptionist" ? "/reception/dashboard" : "/staff/dashboard")} />
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
