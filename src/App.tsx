import React from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
} from "react-router-dom";
import { useAuth } from "./context/AuthContext";
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
import FormsList from "./components/FormsList";
import FormCreator from "./components/FormCreator";
import PreviewFormWrapper from "./components/PreviewFormWrapper";
import FormResponses from "./components/FormResponses";
import AllResponses from "./components/AllResponses";
import DashboardNew from "./components/DashboardNew";
import CustomerViewCarousel from "./components/CustomerViewCarousel";
import TenantManagement from "./components/superadmin/TenantManagement";
import AdminManagement from "./components/admin/AdminManagement";
import LoginPage from "./components/auth/LoginPage";
import NotificationContainer from "./components/ui/NotificationContainer";
import Header from "./components/Header";
import ResponseDetailsPage from "./components/ResponseDetailsPage";
import InviteStatusPage from "./components/InviteStatusPage";

const ROUTE_PERMISSIONS = {
  DASHBOARD: "dashboard:view",
  ANALYTICS: "analytics:view",
  CUSTOMER_REQUESTS: "requests:view",
  REQUEST_MANAGEMENT: "requests:manage",
} as const;

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-white dark:bg-gray-950"
      style={{ zoom: LAYOUT_CONFIG.zoomScale }}
    >
      <Header />
      <main className="pt-16 transition-all duration-300">
        <div className="p-4 sm:p-6">{children}</div>
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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
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
  const { isAuthenticated } = useAuth();

  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
}

function RootShell() {
  return (
    <>
      <NotificationContainer />
      <Outlet />
    </>
  );
}

const withAuthenticatedLayout = (node: React.ReactNode) => (
  <PrivateRoute>
    <AuthenticatedLayout>{node}</AuthenticatedLayout>
  </PrivateRoute>
);

const withAccessControl = (
  node: React.ReactNode,
  options?: { allowedRoles?: string[]; requiredPermission?: string }
) =>
  withAuthenticatedLayout(<AccessControl {...options}>{node}</AccessControl>);

const router = createBrowserRouter(
  [
    {
      element: <RootShell />,
      children: [
        { path: "/login", element: <LoginPage /> },
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
          element: withAccessControl(<FormAnalyticsDashboard />, {
            requiredPermission: ROUTE_PERMISSIONS.ANALYTICS,
          }),
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
            <FollowUpFormManager onFormCreated={() => {}} />
          ),
        },
        {
          path: "/forms/followup/create",
          element: withAuthenticatedLayout(
            <FormWithFollowUpCreator onFormCreated={() => {}} />
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
          path: "/superadmin/tenants",
          element: withAccessControl(<TenantManagement />, {
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
  }
);

export default function App() {
  return <RouterProvider router={router} />;
}
