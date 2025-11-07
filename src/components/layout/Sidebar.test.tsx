import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "../../context/AuthContext";
import { useSidebar } from "../../context/SidebarContext";

vi.mock("../../context/AuthContext");
vi.mock("../../context/SidebarContext");
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

const mockUseAuth = vi.mocked(useAuth);
const mockUseSidebar = vi.mocked(useSidebar);
const mockUseNavigate = vi.mocked(useNavigate);

const createAuthValue = (
  overrides: Partial<ReturnType<typeof useAuth>> = {}
): ReturnType<typeof useAuth> =>
  ({
    user: null,
    tenant: null,
    login: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: false,
    loading: false,
    error: null,
    ...overrides,
  }) as ReturnType<typeof useAuth>;

const createSidebarValue = (
  overrides: Partial<ReturnType<typeof useSidebar>> = {}
): ReturnType<typeof useSidebar> => ({
  isCollapsed: false,
  isMobileOpen: false,
  toggleSidebar: vi.fn(),
  openMobile: vi.fn(),
  closeMobile: vi.fn(),
  ...overrides,
});

const renderSidebar = (initialEntry = "/") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Sidebar />
    </MemoryRouter>
  );

describe("Sidebar", () => {
  let navigateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock = vi.fn();
    mockUseNavigate.mockReturnValue(navigateMock);
    mockUseSidebar.mockReturnValue(createSidebarValue());
  });

  it("shows public menu for guests", () => {
    mockUseAuth.mockReturnValue(createAuthValue());

    renderSidebar();

    expect(screen.getByText("Service Requests")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).toBeNull();
  });

  it("shows admin management menu for admin role", () => {
    const auth = createAuthValue({
      isAuthenticated: true,
      user: {
        _id: "1",
        username: "admin",
        email: "admin@example.com",
        firstName: "Admin",
        lastName: "User",
        role: "admin",
        isActive: true,
      },
    });

    mockUseAuth.mockReturnValue(auth);

    renderSidebar();

    expect(screen.getByText("Admin Management")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("hides admin management for subadmin role without permissions", () => {
    const auth = createAuthValue({
      isAuthenticated: true,
      user: {
        _id: "2",
        username: "subadmin",
        email: "subadmin@example.com",
        firstName: "Sub",
        lastName: "Admin",
        role: "subadmin",
        isActive: true,
        permissions: [],
      },
    });

    mockUseAuth.mockReturnValue(auth);

    renderSidebar();

    expect(screen.queryByText("Admin Management")).toBeNull();
    expect(screen.queryByText("Dashboard")).toBeNull();
    expect(screen.queryByText("Customer Requests")).toBeNull();
  });

  it("shows permitted items for subadmin with permissions", () => {
    const auth = createAuthValue({
      isAuthenticated: true,
      user: {
        _id: "5",
        username: "subadmin",
        email: "subadmin@example.com",
        firstName: "Perm",
        lastName: "Admin",
        role: "subadmin",
        isActive: true,
        permissions: ["dashboard:view", "requests:view"],
      },
    });

    mockUseAuth.mockReturnValue(auth);

    renderSidebar();

    expect(screen.queryByText("Admin Management")).toBeNull();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Customer Requests")).toBeInTheDocument();
    expect(screen.queryByText("Service Analytics")).toBeNull();
  });

  it("shows super admin specific menu", () => {
    const auth = createAuthValue({
      isAuthenticated: true,
      user: {
        _id: "3",
        username: "super",
        email: "super@example.com",
        firstName: "Super",
        lastName: "Admin",
        role: "superadmin",
        isActive: true,
      },
    });

    mockUseAuth.mockReturnValue(auth);

    renderSidebar();

    expect(screen.getByText("Tenant Management")).toBeInTheDocument();
    expect(screen.queryByText("Admin Management")).toBeNull();
  });

  it("logs out and navigates to login", () => {
    const logout = vi.fn();
    const auth = createAuthValue({
      isAuthenticated: true,
      logout,
      user: {
        _id: "4",
        username: "admin",
        email: "admin@example.com",
        firstName: "Admin",
        lastName: "User",
        role: "admin",
        isActive: true,
      },
    });

    mockUseAuth.mockReturnValue(auth);

    renderSidebar();

    const signOutButton = screen.getByRole("button", { name: "Sign Out" });
    fireEvent.click(signOutButton);

    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith("/login");
  });
});
