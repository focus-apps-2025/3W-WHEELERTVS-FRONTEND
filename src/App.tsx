import React from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
} from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useSidebar } from "./context/SidebarContext";
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
import TenantManagement from "./components/superadmin/TenantManagement";
import LoginPage from "./components/auth/LoginPage";
import NotificationContainer from "./components/ui/NotificationContainer";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/Header";

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
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <Header />
      <main
        className={`pt-16 transition-all duration-300 ${
          isCollapsed ? "lg:ml-16" : "lg:ml-64"
        }`}
      >
        <div className="container mx-auto p-6">{children}</div>
      </main>
    </div>
  );
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
          element: withAuthenticatedLayout(<DashboardNew />),
        },
        {
          path: "/forms/analytics",
          element: withAuthenticatedLayout(<FormsAnalytics />),
        },
        {
          path: "/forms/:id/analytics",
          element: withAuthenticatedLayout(<FormAnalyticsDashboard />),
        },
        {
          path: "/forms/management",
          element: withAuthenticatedLayout(<FormsManagementNew />),
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
          element: withAuthenticatedLayout(<AllResponses />),
        },
        {
          path: "/superadmin/tenants",
          element: withAuthenticatedLayout(<TenantManagement />),
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
