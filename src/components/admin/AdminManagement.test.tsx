import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminManagement from "./AdminManagement";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/client";

vi.mock("../../context/AuthContext");
vi.mock("../../api/client", () => {
  const fn = () => vi.fn();
  return {
    apiClient: {
      getUsers: fn(),
      createUser: fn(),
      updateUser: fn(),
    },
    ApiError: class MockApiError extends Error {},
  };
});

const mockedUseAuth = vi.mocked(useAuth);
const mockedApiClient = apiClient as unknown as {
  getUsers: ReturnType<typeof vi.fn>;
  createUser: ReturnType<typeof vi.fn>;
  updateUser: ReturnType<typeof vi.fn>;
};

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

const createUserPayload = (overrides: Record<string, unknown> = {}) => ({
  _id: "sub-1",
  firstName: "Casey",
  lastName: "Admin",
  email: "casey@example.com",
  username: "casey",
  permissions: ["dashboard:view"],
  isActive: true,
  ...overrides,
});

describe("AdminManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApiClient.getUsers.mockResolvedValue({ users: [] });
    mockedApiClient.createUser.mockResolvedValue({ user: null });
    mockedApiClient.updateUser.mockResolvedValue({});
  });

  it("restricts access for non-admin users", () => {
    mockedUseAuth.mockReturnValue(
      createAuthValue({
        isAuthenticated: true,
        user: {
          _id: "staff-1",
          firstName: "Staff",
          lastName: "Member",
          email: "staff@example.com",
          username: "staff",
          role: "staff",
          permissions: [],
          isActive: true,
        } as any,
      })
    );

    render(<AdminManagement />);

    expect(screen.getByText("Access restricted")).toBeInTheDocument();
    expect(mockedApiClient.getUsers).not.toHaveBeenCalled();
  });

  it("loads and displays sub-admins for admins", async () => {
    mockedUseAuth.mockReturnValue(
      createAuthValue({
        isAuthenticated: true,
        user: {
          _id: "admin-1",
          firstName: "Admin",
          lastName: "User",
          email: "admin@example.com",
          username: "admin",
          role: "admin",
          permissions: [],
          isActive: true,
        } as any,
      })
    );

    mockedApiClient.getUsers.mockResolvedValueOnce({
      users: [
        createUserPayload({
          _id: "sub-2",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          username: "john",
        }),
      ],
    });

    render(<AdminManagement />);

    await waitFor(() => expect(screen.getByText("John Doe")).toBeInTheDocument());
    expect(mockedApiClient.getUsers).toHaveBeenCalledWith({
      role: "subadmin",
      limit: 100,
    });
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
  });

  it("creates sub-admins with selected permissions", async () => {
    mockedUseAuth.mockReturnValue(
      createAuthValue({
        isAuthenticated: true,
        user: {
          _id: "admin-1",
          firstName: "Admin",
          lastName: "User",
          email: "admin@example.com",
          username: "admin",
          role: "admin",
          permissions: [],
          isActive: true,
        } as any,
      })
    );

    const createdUser = createUserPayload({
      _id: "sub-3",
      firstName: "New",
      lastName: "Admin",
      email: "new@example.com",
      username: "newadmin",
      permissions: ["dashboard:view", "requests:view"],
    });

    mockedApiClient.createUser.mockResolvedValueOnce({ user: createdUser });

    render(<AdminManagement />);

    fireEvent.change(screen.getByPlaceholderText("First name"), {
      target: { value: " New " },
    });
    fireEvent.change(screen.getByPlaceholderText("Last name"), {
      target: { value: "Admin" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email address"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Username"), {
      target: { value: "newadmin" },
    });
    fireEvent.change(screen.getByPlaceholderText("Temporary password"), {
      target: { value: "Pass123!" },
    });

    const dashboardCheckbox = screen
      .getByText("Dashboard")
      .closest("label")
      ?.querySelector("input") as HTMLInputElement;
    const customerRequestsCheckbox = screen
      .getByText("Customer Requests")
      .closest("label")
      ?.querySelector("input") as HTMLInputElement;

    fireEvent.click(dashboardCheckbox);
    fireEvent.click(customerRequestsCheckbox);

    fireEvent.click(screen.getByRole("button", { name: "Add sub-admin" }));

    await waitFor(() => expect(mockedApiClient.createUser).toHaveBeenCalled());

    expect(mockedApiClient.createUser).toHaveBeenCalledWith({
      firstName: "New",
      lastName: "Admin",
      email: "new@example.com",
      username: "newadmin",
      password: "Pass123!",
      role: "subadmin",
      permissions: ["dashboard:view", "requests:view"],
    });

    await waitFor(() => expect(screen.getByText("New Admin")).toBeInTheDocument());
  });

  it("updates permissions for existing sub-admins", async () => {
    mockedUseAuth.mockReturnValue(
      createAuthValue({
        isAuthenticated: true,
        user: {
          _id: "admin-1",
          firstName: "Admin",
          lastName: "User",
          email: "admin@example.com",
          username: "admin",
          role: "admin",
          permissions: [],
          isActive: true,
        } as any,
      })
    );

    mockedApiClient.getUsers.mockResolvedValueOnce({
      users: [
        createUserPayload({
          _id: "sub-4",
          permissions: ["dashboard:view"],
        }),
      ],
    });

    render(<AdminManagement />);

    await waitFor(() =>
      expect(screen.getByTestId("subadmin-card-sub-4")).toBeInTheDocument()
    );

    const permissionCheckbox = screen.getByTestId(
      "permission-sub-4-requests:view"
    ) as HTMLInputElement;

    expect(permissionCheckbox.checked).toBe(false);

    fireEvent.click(permissionCheckbox);

    await waitFor(() =>
      expect(mockedApiClient.updateUser).toHaveBeenCalledWith("sub-4", {
        permissions: ["dashboard:view", "requests:view"],
      })
    );

    expect(permissionCheckbox.checked).toBe(true);
  });
});
