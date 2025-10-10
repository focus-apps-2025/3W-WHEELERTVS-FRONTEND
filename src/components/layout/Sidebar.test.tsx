import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "../../context/AuthContext";
import { useSidebar } from "../../context/SidebarContext";

// Mock the context hooks
vi.mock("../../context/AuthContext");
vi.mock("../../context/SidebarContext");

const mockUseAuth = vi.mocked(useAuth);
const mockUseSidebar = vi.mocked(useSidebar);

// Test wrapper with Router
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe("Sidebar Component", () => {
  const mockSidebarContext = {
    isCollapsed: false,
    isMobileOpen: false,
    toggleSidebar: vi.fn(),
    openMobile: vi.fn(),
    closeMobile: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSidebar.mockReturnValue(mockSidebarContext);
  });

  it("renders sidebar navigation items", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockUseSidebar.mockReturnValue(mockSidebarContext);

    render(
      <TestWrapper>
        <Sidebar />
      </TestWrapper>
    );

    // Check for authenticated menu items
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Service Analytics")).toBeInTheDocument();
    expect(screen.getByText("Customer Requests")).toBeInTheDocument();
    expect(screen.getByText("Request Management")).toBeInTheDocument();
    expect(screen.getByText("Shop Settings")).toBeInTheDocument();
    expect(screen.getByText("Email System")).toBeInTheDocument();
  });

  it("toggles sidebar collapsed state", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockUseSidebar.mockReturnValue(mockSidebarContext);

    render(
      <TestWrapper>
        <Sidebar />
      </TestWrapper>
    );

    const toggleButton = screen.getByRole("button");
    fireEvent.click(toggleButton);

    expect(mockSidebarContext.toggleSidebar).toHaveBeenCalled();
  });

  it("shows mobile overlay correctly", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockUseSidebar.mockReturnValue({
      ...mockSidebarContext,
      isMobileOpen: true,
    });

    render(
      <TestWrapper>
        <Sidebar />
      </TestWrapper>
    );

    // Mobile overlay should be present
    const overlay = document.querySelector(".lg\\:hidden.fixed.inset-0");
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveClass("bg-black", "bg-opacity-50");
  });

  it("displays tooltips when collapsed", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockUseSidebar.mockReturnValue({
      ...mockSidebarContext,
      isCollapsed: true,
    });

    render(
      <TestWrapper>
        <Sidebar />
      </TestWrapper>
    );

    // Check that menu item titles are not visible when collapsed
    const menuItemSpan = screen.queryByText("Dashboard");
    expect(menuItemSpan).not.toBeInTheDocument();

    // Check for tooltip presence (they have absolute positioning)
    const tooltips = document.querySelectorAll(".absolute.left-full");
    expect(tooltips.length).toBeGreaterThan(0);
  });

  it("highlights active menu item", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockUseSidebar.mockReturnValue(mockSidebarContext);

    // Mock current location to be dashboard
    Object.defineProperty(window, "location", {
      value: { pathname: "/dashboard" },
      writable: true,
    });

    render(
      <TestWrapper>
        <Sidebar />
      </TestWrapper>
    );

    // Find the dashboard link and check if it has active styling
    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink).toHaveClass("bg-primary-50", "text-primary-700");
  });

  it("shows different menus per auth", () => {
    // Test unauthenticated state
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    mockUseSidebar.mockReturnValue(mockSidebarContext);

    const { rerender } = render(
      <TestWrapper>
        <Sidebar />
      </TestWrapper>
    );

    // Should show only public menu items
    expect(screen.getByText("Service Requests")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();

    // Test authenticated state
    mockUseAuth.mockReturnValue({ isAuthenticated: true });

    rerender(
      <TestWrapper>
        <Sidebar />
      </TestWrapper>
    );

    // Should show authenticated menu items
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Service Analytics")).toBeInTheDocument();
  });

  it("handles mobile menu toggle", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockUseSidebar.mockReturnValue({
      ...mockSidebarContext,
      isMobileOpen: true,
    });

    render(
      <TestWrapper>
        <Sidebar />
      </TestWrapper>
    );

    // Click on overlay to close mobile menu
    const overlay = document.querySelector(".lg\\:hidden.fixed.inset-0");
    if (overlay) {
      fireEvent.click(overlay);
      expect(mockSidebarContext.closeMobile).toHaveBeenCalled();
    }
  });

  it("closes mobile on navigation", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockUseSidebar.mockReturnValue({
      ...mockSidebarContext,
      isMobileOpen: true,
    });

    render(
      <TestWrapper>
        <Sidebar />
      </TestWrapper>
    );

    // Click on a navigation link
    const dashboardLink = screen.getByText("Dashboard");
    fireEvent.click(dashboardLink);

    expect(mockSidebarContext.closeMobile).toHaveBeenCalled();
  });
});
