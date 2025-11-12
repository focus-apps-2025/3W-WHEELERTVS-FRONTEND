import React, { useState } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function TestAPI() {
  const { user, login, logout } = useAuth();
  const [testResults, setTestResults] = useState<string[]>([]);
  const [email, setEmail] = useState("admin@littleflowerschool.com");
  const [password, setPassword] = useState("admin123");

  const addResult = (message: string) => {
    setTestResults((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  const testLogin = async () => {
    try {
      const success = await login(email, password);
      addResult(success ? "✅ Login successful" : "❌ Login failed");
    } catch (error) {
      addResult(`❌ Login error: ${error}`);
    }
  };

  const testForms = async () => {
    try {
      const forms = await apiClient.getForms();
      addResult(`✅ Forms retrieved: ${forms.forms.length} forms found`);
    } catch (error) {
      addResult(`❌ Forms error: ${error}`);
    }
  };

  const testCreateForm = async () => {
    try {
      const formData = {
        title: "Test Form",
        description: "A test form created from frontend",
        isVisible: true,
        ...(user?.tenantId && { tenantId: user.tenantId }),
        sections: [
          {
            title: "Test Section",
            description: "A test section",
            questions: [
              {
                text: "What is your name?",
                type: "text",
                required: true,
              },
            ],
          },
        ],
      };

      const result = await apiClient.createForm(formData);
      addResult(`✅ Form created: ${result.form.title}`);
    } catch (error) {
      addResult(`❌ Create form error: ${error}`);
    }
  };

  const testDashboard = async () => {
    try {
      const analytics = await apiClient.getDashboardAnalytics();
      addResult(
        `✅ Dashboard data: ${JSON.stringify(analytics).substring(0, 100)}...`
      );
    } catch (error) {
      addResult(`❌ Dashboard error: ${error}`);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">API Test Page</h1>

      {/* User Status */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Authentication Status</h2>
        {user ? (
          <div>
            <p className="text-green-600">
              ✅ Logged in as: {user.firstName} {user.lastName} ({user.email})
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Role: {user.role}</p>
            <button
              onClick={logout}
              className="mt-2 bg-red-500 text-white px-4 py-2 rounded"
            >
              Logout
            </button>
          </div>
        ) : (
          <div>
            <p className="text-red-600">❌ Not logged in</p>
            <div className="mt-2 space-x-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="border p-2 rounded"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="border p-2 rounded"
              />
            </div>
          </div>
        )}
      </div>

      {/* Test Buttons */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4">API Tests</h2>
        <div className="space-x-2 space-y-2">
          <button
            onClick={testLogin}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Test Login
          </button>
          <button
            onClick={testForms}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Test Get Forms
          </button>
          <button
            onClick={testCreateForm}
            className="bg-purple-500 text-white px-4 py-2 rounded"
          >
            Test Create Form
          </button>
          <button
            onClick={testDashboard}
            className="bg-orange-500 text-white px-4 py-2 rounded"
          >
            Test Dashboard
          </button>
          <button
            onClick={clearResults}
            className="bg-gray-500 text-white px-4 py-2 rounded"
          >
            Clear Results
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-4">Test Results</h2>
        <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded max-h-96 overflow-y-auto">
          {testResults.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-500">
              No test results yet. Click a test button above.
            </p>
          ) : (
            <pre className="whitespace-pre-wrap text-sm">
              {testResults.join("\n")}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
