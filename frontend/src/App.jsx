// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

// Public pages
import HomePage from "./pages/HomePage";
import DoctorsPage from "./pages/DoctorsPage";
import DoctorDetailPage from "./pages/DoctorDetailPage";
import TutorialPage from "./pages/TutorialPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import BookingSuccessPage from "./pages/BookingSuccessPage";

import AccountLayout from "./pages/AccountLayout.jsx";
import PatientProfilePage from "./pages/PatientProfilePage.jsx";
import AppointmentListPage from "./pages/AppointmentListPage.jsx";
import AppointmentDetailPage from "./pages/AppointmentDetailPage";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import CheckoutPage from "./pages/CheckoutPage";
import HospitalDetailPage from "./pages/HospitalDetailPage.jsx";
import HospitalsPage from "./pages/HospitalsPage.jsx";
import PolicyPrivacy from "./pages/PolicyPrivacy.jsx";
import PolicyTerms from "./pages/PolicyTerms.jsx";
import NewsListPage from "./pages/news/NewsListPage.jsx";

// Guard
import RequireRole from "./components/RequireRole.jsx";

// Admin
import AdminLayout from "./pages/admin/AdminLayout.jsx";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage.jsx";
import AdminUsersPage from "./pages/admin/AdminUsersPage.jsx";
import AdminDoctorsPage from "./pages/admin/AdminDoctorsPage.jsx";
import AdminHospitalsPage from "./pages/admin/AdminHospitalsPage.jsx";
import AdminSpecialtiesPage from "./pages/admin/AdminSpecialtiesPage.jsx";
import AdminAppointmentsPage from "./pages/admin/AdminAppointmentsPage.jsx";

//Doctor
import DoctorLayout from "./pages/doctor/DoctorLayout.jsx";
import DoctorSchedulePage from "./pages/doctor/DoctorSchedulePage.jsx";
import DoctorAppointmentsPage from "./pages/doctor/DoctorAppointmentsPage.jsx";
import DoctorMetricsPage from "./pages/doctor/DoctorMetricsPage.jsx";
import DoctorProfilePage from "./pages/doctor/DoctorProfilePage.jsx";
import DoctorReportsPage from "./pages/doctor/DoctorReportsPage.jsx";

import { useLocation } from "react-router-dom";
import AssistantButton from "./components/chatbot/AssistantButton";

function PublicLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />
    </>
  );
}

function Chatbot() {
  const location = useLocation();

  // 1. Ẩn ở trang đăng nhập / đăng ký
  if (location.pathname === "/login" || location.pathname === "/register") {
    return null;
  }

  let role = localStorage.getItem("role");
  if (!role) {
    try {
      role = JSON.parse(localStorage.getItem("user") || "{}").role;
    } catch {
      role = null;
    }
  }

  if (role === "admin" || role === "doctor") {
    return null;
  }

  return <AssistantButton />;
}


export default function App() {
  return (
    <Router>
      <Routes>
        {/* ADMIN*/}
        <Route element={<RequireRole role="admin" />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="doctors" element={<AdminDoctorsPage />} />
            <Route path="hospitals" element={<AdminHospitalsPage />} />
            <Route path="specialties" element={<AdminSpecialtiesPage />} />
            <Route path="appointments" element={<AdminAppointmentsPage />} />

          </Route>
        </Route>

        {/* Doctor*/}
        <Route element={<RequireRole role="doctor" />}>
          <Route path="/doctor" element={<DoctorLayout />}>
            <Route index element={<DoctorSchedulePage />} />
            <Route path="profile" element={<DoctorProfilePage />} />
            <Route path="schedule" element={<DoctorSchedulePage />} />
            <Route path="appointments" element={<DoctorAppointmentsPage />} />
            <Route path="metrics" element={<DoctorMetricsPage />} />
            <Route path="reports" element={<DoctorReportsPage />} />
          </Route>
        </Route>


        {/* PUBLIC + USER AREA  */}
        <Route element={<PublicLayout />}>
          {/* user protected */}
          <Route element={<RequireRole />}>
            <Route path="/me" element={<AccountLayout />}>
              <Route index element={<PatientProfilePage />} />
              <Route path="appointments" element={<AppointmentListPage />} />
              <Route path="appointments/:id" element={<AppointmentDetailPage />} />
              <Route path="notifications" element={<NotificationsPage />} />

            </Route>
            <Route path="/checkout" element={<CheckoutPage />} />
          </Route>

          {/* public */}
          <Route path="/" element={<HomePage />} />
          <Route path="/doctors" element={<DoctorsPage />} />      {/* Danh sach bac si   */}
          <Route path="/doctors/:id" element={<DoctorDetailPage />} />
          <Route path="/tutorial" element={<TutorialPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/search" element={<DoctorsPage />} />
          <Route path="/booking-success/:id" element={<BookingSuccessPage />} />
          <Route path="/hospitals" element={<HospitalsPage />} />
          <Route path="/hospitals/:id" element={<HospitalDetailPage />} />
          <Route path="/policy/privacy" element={<PolicyPrivacy />} />
          <Route path="/policy/terms" element={<PolicyTerms />} />
          <Route path="/news" element={<Navigate to="/news/service" replace />} />
          <Route path="/news/:category" element={<NewsListPage />} />
        </Route>

      </Routes>
      {/* Nút trợ lý AI */}
      <Chatbot />
    </Router >
  );
}
