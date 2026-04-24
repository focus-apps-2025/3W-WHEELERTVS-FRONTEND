import React, { useMemo } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  useLocation,
  useParams,
} from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import {
  AttendanceProvider,
  useAttendanceStatus,
} from "./context/AttendanceContext";
import { useActivityTracker } from "./hooks/useActivityTracker";
import { LAYOUT_CONFIG } from "./config/layoutConfig";
import FormsPreview from "./components/FormsPreview";
import TestAPI from "./components/TestAPI";
import ResponseForm from "./components/ResponseForm";
import FollowUpFormDemo from "./components/forms/FollowUpFormDemo";
import FollowUpFormManager from "./components/forms/FollowUpFormManager";
import { FormWithFollowUpCreator } from "./components/forms/FormWithFollowUpCreator";
import FormWithFollowUpResponderWrapper from "./components/forms/FormWithFollowUpResponderWrapper";
import FormsAnalytics from "./components/analytics/FormsAnalytics";
import FormAnalyticsDashboard from "./components/analytics/FormAnalyticsDashboard";
import FormsManagementNew from "./components/FormsManagementNew";
import Management from "./components/management/Management";
import MailTest from "./components/MailTest";
import WhatsAppTest from "./components/WhatsAppTest";
import FormsList from "./components/FormsList";
import FormCreator from "./components/FormCreator";
import PreviewFormWrapper from "./components/PreviewFormWrapper";
import FormResponses from "./components/FormResponses";
import FormUploadsView from "./components/analytics/FormUploadsView";
import AllResponses from "./components/AllResponses";
import DashboardNew from "./components/DashboardNew";
import CustomerViewCarousel from "./components/CustomerViewCarousel";
import TenantManagement from "./components/superadmin/TenantManagement";
import GlobalFormManagement from "./components/superadmin/GlobalFormManagement";
import AdminManagement from "./components/admin/AdminManagement";
import UserActivityLogs from "./components/admin/UserActivityLogs";
import Attendance from "./components/admin/Attendance";
import HRAttendance from "./components/admin/HRAttendance";
import ShiftManagement from "./components/admin/ShiftManagement";
import AttendanceDashboard from "./components/inspectors/AttendanceDashboard";
import LoginPage from "./components/auth/LoginPage";
import SignupPage from "./components/auth/SignupPage";
import GuestAnalyticsLogin from "./components/auth/GuestAnalyticsLogin";
import FreeTrialManagement from "./components/superadmin/FreeTrialManagement";
import NotificationContainer from "./components/ui/NotificationContainer";
import Header from "./components/Header";
import Sidebar from "./components/layout/Sidebar";
import ResponseDetailsPage from "./components/ResponseDetailsPage";
import InviteStatusPage from "./components/InviteStatusPage";
import ErrorPage from "./components/ErrorPage";
import LeaveManagement from "./components/hr/LeaveManagement";
import PermissionManagement from "./components/hr/PermissionManagement";

const ROUTE_PERMISSIONS = {
  DASHBOARD: "dashboard:view",
  ANALYTICS: "analytics:view",
  CUSTOMER_REQUESTS: "requests:view",
  REQUEST_MANAGEMENT: "requests:manage",
} as const;

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // If user is a guest (guest token exists), and trying to access any private route
  // (Note: analytics route uses FlexibleAnalyticsRoute, not PrivateRoute directly)
  const isGuest = !!localStorage.getItem("guest_auth_token");
  
  if (isGuest && !isAuthenticated) {
    const guestFormId = localStorage.getItem("guest_form_id");
    return <Navigate to={`/forms/${guestFormId}/analytics?guest=true`} replace />;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  useActivityTracker(isAuthenticated);

  const isGuest = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get("guest") === "true" || !!localStorage.getItem("guest_auth_token");
  }, [location.search]);

  return (
    <div
      className="min-h-screen bg-white dark:bg-gray-950"
    >
      {!isGuest && <Header />}
      <main className={`${isGuest ? "" : "pt-16"} transition-all duration-300`}>
        <div className={isGuest ? "" : "p-4 sm:p-6"}>{children}</div>
      </main>
    </div>
  );
}

function AccessControl({
  children,
  allowedRoles,
  requiredPermission,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
  requiredPermission?: string;
}) {
  const { user } = useAuth();
  const { isCheckedIn, loading: attendanceLoading } = useAttendanceStatus();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  if (
    requiredPermission === ROUTE_PERMISSIONS.ANALYTICS &&
    user.role === "inspector"
  ) {
    if (attendanceLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      );
    }
    if (!isCheckedIn) {
      return <Navigate to="/attendance-dashboard" replace />;
    }
  }

  if (
    requiredPermission &&
    user.role !== "admin" &&
    user.role !== "superadmin"
  ) {
    const permissionSet = new Set(user.permissions || []);
    if (!permissionSet.has(requiredPermission)) {
      return <Navigate to="/login" replace />;
    }
  }

  return <>{children}</>;
}

function RootRedirect() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Default landing pages by role
  if (user?.role === "inspector") {
    return <Navigate to="/attendance-dashboard" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

function RootShell() {
  return (
    <AttendanceProvider>
      <NotificationContainer />
      <Outlet />
    </AttendanceProvider>
  );
}

const withAuthenticatedLayout = (node: React.ReactNode) => (
  <PrivateRoute>
    <AuthenticatedLayout>{node}</AuthenticatedLayout>
  </PrivateRoute>
);

const withAccessControl = (
  node: React.ReactNode,
  options?: { allowedRoles?: string[]; requiredPermission?: string },
) =>
  withAuthenticatedLayout(<AccessControl {...options}>{node}</AccessControl>);

function FlexibleAnalyticsRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const { id } = useParams();
  const guestToken = localStorage.getItem("guest_auth_token");
  const guestFormId = localStorage.getItem("guest_form_id");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  if (guestToken) {
    // If it's a guest, they can ONLY access their assigned form analytics
    if (id === guestFormId) {
      return <>{children}</>;
    }
    // Otherwise redirect to their assigned analytics page
    return <Navigate to={`/forms/${guestFormId}/analytics?guest=true`} replace />;
  }

  return <Navigate to="/login" replace />;
}

const withFlexibleAnalytics = (node: React.ReactNode) => (
  <FlexibleAnalyticsRoute>
    <AuthenticatedLayout>{node}</AuthenticatedLayout>
  </FlexibleAnalyticsRoute>
);

const router = createBrowserRouter(
  [
    {
      element: <RootShell />,
      errorElement: <ErrorPage />,
      children: [
        { path: "/login", element: <LoginPage /> },
        { path: "/signup", element: <SignupPage /> },
        { path: "/forms/:id/analytics/login", element: <GuestAnalyticsLogin /> },
        { path: "/", element: <RootRedirect /> },
        { path: "/forms/preview", element: <FormsPreview /> },
        { path: "/api-test", element: <TestAPI /> },
        { path: "/forms/:id/respond", element: <ResponseForm /> },
        { path: "/followup/demo", element: <FollowUpFormDemo /> },
        {
          path: "/followup/forms/:id/respond",
          element: <FormWithFollowUpResponderWrapper />,
        },
        {
          path: "/dashboard",
          element: withAccessControl(<DashboardNew />, {
            requiredPermission: ROUTE_PERMISSIONS.DASHBOARD,
          }),
        },
        {
          path: "/forms/analytics",
          element: withAccessControl(<FormsAnalytics />, {
            requiredPermission: ROUTE_PERMISSIONS.ANALYTICS,
          }),
        },
        {
          path: "/forms/:id/analytics",
          element: withFlexibleAnalytics(<FormAnalyticsDashboard />),
        },
        {
          path: "/forms/management",
          element: withAccessControl(<FormsManagementNew />, {
            requiredPermission: ROUTE_PERMISSIONS.REQUEST_MANAGEMENT,
          }),
        },
        {
          path: "/forms/followup/management",
          element: withAuthenticatedLayout(
            <FollowUpFormManager onFormCreated={() => {}} />,
          ),
        },
        {
          path: "/forms/followup/create",
          element: withAuthenticatedLayout(
            <FormWithFollowUpCreator onFormCreated={() => {}} />,
          ),
        },
        {
          path: "/system/management",
          element: withAuthenticatedLayout(<Management />),
        },
        {
          path: "/mail/test",
          element: withAuthenticatedLayout(<MailTest />),
        },
        {
          path: "/whatsapp/test",
          element: withAuthenticatedLayout(<WhatsAppTest />),
        },
        {
          path: "/forms",
          element: withAuthenticatedLayout(<FormsList />),
        },
        {
          path: "/forms/create",
          element: withAuthenticatedLayout(<FormCreator />),
        },
        {
          path: "/forms/:id/edit",
          element: withAuthenticatedLayout(<FormCreator />),
        },
        {
          path: "/forms/:id/preview",
          element: withAuthenticatedLayout(<PreviewFormWrapper />),
        },
        {
          path: "/forms/:id/responses",
          element: withAuthenticatedLayout(<FormResponses />),
        },
        {
          path: "/forms/:id/uploads",
          element: withAuthenticatedLayout(<FormUploadsView />),
        },
        {
          path: "/responses/all",
          element: withAccessControl(<AllResponses />, {
            requiredPermission: ROUTE_PERMISSIONS.CUSTOMER_REQUESTS,
          }),
        },
        {
          path: "/responses/:id",
          element: withAccessControl(<ResponseDetailsPage />, {
            requiredPermission: ROUTE_PERMISSIONS.CUSTOMER_REQUESTS,
          }),
        },
        {
          path: "/admin/management",
          element: withAccessControl(<AdminManagement />, {
            allowedRoles: ["admin"],
          }),
        },
        {
          path: "/admin/activity-logs",
          element: withAccessControl(<UserActivityLogs />, {
            allowedRoles: ["admin", "superadmin"],
          }),
        },
        {
          path: "/admin/attendance",
          element: withAccessControl(<Attendance />, {
            allowedRoles: ["admin", "superadmin", "subadmin"],
          }),
        },
        {
          path: "/hr-attendance",
          element: withAccessControl(<HRAttendance />, {
            allowedRoles: ["admin", "subadmin"],
          }),
        },
        {
          path: "/shifts",
          element: withAccessControl(<ShiftManagement />, {
            allowedRoles: ["admin", "subadmin"],
          }),
        },
        {
          path: "/attendance-dashboard",
          element: withAccessControl(<AttendanceDashboard />, {
            allowedRoles: ["inspector"],
          }),
        },
        {
          path: "/inspector/attendance",
          element: withAccessControl(
            <AttendanceDashboard showAllHistory={true} />,
            {
              allowedRoles: ["inspector"],
            },
          ),
        },
        {
          path: "/hr/leaves",
          element: withAccessControl(<LeaveManagement />, {
            allowedRoles: ["admin", "inspector", "subadmin"],
          }),
        },
        {
          path: "/hr/permissions",
          element: withAccessControl(<PermissionManagement />, {
            allowedRoles: ["admin", "inspector", "subadmin"],
          }),
        },
        {
          path: "/superadmin/tenants",
          element: withAccessControl(<TenantManagement />, {
            allowedRoles: ["superadmin"],
          }),
        },
        {
          path: "/superadmin/free-trial",
          element: withAccessControl(<FreeTrialManagement />, {
            allowedRoles: ["superadmin"],
          }),
        },
        {
          path: "/superadmin/forms",
          element: withAccessControl(<GlobalFormManagement />, {
            allowedRoles: ["superadmin"],
          }),
        },
        {
          path: "/forms/:id/invites",
          element: withAuthenticatedLayout(<InviteStatusPage />),
        },
      ],
    },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  },
);

export default function App() {
  return <RouterProvider router={router} />;
}
