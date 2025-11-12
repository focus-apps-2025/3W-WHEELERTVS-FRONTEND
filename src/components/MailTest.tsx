import React, { useState } from "react";
import { Mail, Send, CheckCircle, AlertCircle, Settings } from "lucide-react";

interface MailTestProps {}

export default function MailTest({}: MailTestProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [testEmail, setTestEmail] = useState("");
  const [activeTab, setActiveTab] = useState<"test" | "config" | "demo">(
    "demo"
  );

  const testConnection = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/mail/test-connection", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({ success: false, message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail) {
      setResult({
        success: false,
        message: "Please enter a test email address",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/mail/test-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to: testEmail }),
      });
      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({ success: false, message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const sendDemoServiceRequest = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const demoData = {
        serviceRequest: {
          id: "DEMO-" + Date.now(),
          vehicleMake: "Toyota",
          vehicleModel: "Corolla",
          vehicleYear: "2021",
          licensePlate: "DEMO-123",
          serviceType: "Oil Change & Inspection",
          issueDescription:
            "Routine maintenance - oil change, filter replacement, and general inspection. Customer requested full service check.",
          urgency: "Normal",
          preferredDate: new Date().toLocaleDateString(),
        },
        customerInfo: {
          name: "Demo Customer",
          email: testEmail || "demo@example.com",
          phone: "(555) 987-6543",
        },
      };

      const response = await fetch("/api/mail/service-request-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demoData),
      });
      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({ success: false, message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const sendDemoStatusUpdate = async () => {
    if (!testEmail) {
      setResult({
        success: false,
        message: "Please enter an email address for status update",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const token = localStorage.getItem("token");
      const demoData = {
        serviceRequest: {
          vehicleMake: "Toyota",
          vehicleModel: "Corolla",
        },
        customerInfo: {
          name: "Demo Customer",
          email: testEmail,
        },
        status: "completed",
        message:
          "Great news! Your Toyota Corolla service is complete. We performed an oil change, replaced the air filter, and completed a comprehensive 21-point inspection. Everything looks good and your vehicle is ready for pickup.",
        estimatedCompletion: "Ready for pickup now",
      };

      const response = await fetch("/api/mail/status-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(demoData),
      });
      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({ success: false, message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary-800 mb-2">
          Mail System Test
        </h1>
        <p className="text-primary-600">
          Test and configure the Focus Form email system
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("demo")}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "demo"
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Demo Emails
          </button>
          <button
            onClick={() => setActiveTab("test")}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "test"
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Connection Test
          </button>
          <button
            onClick={() => setActiveTab("config")}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "config"
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Configuration
          </button>
        </nav>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-neutral-200 dark:border-gray-700 p-6">
        {activeTab === "demo" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Demo Email Templates
              </h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Test Email Address
                </label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="your-email@example.com"
                  className="input-field"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                  Enter your email to receive demo notifications
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  🚗 Service Request Notification
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Demo email that gets sent when a customer submits a service
                  request
                </p>
                <button
                  onClick={sendDemoServiceRequest}
                  disabled={isLoading}
                  className="btn-primary w-full"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Demo Service Request
                </button>
              </div>

              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  📧 Status Update
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Demo email that gets sent to update customers on their service
                  status
                </p>
                <button
                  onClick={sendDemoStatusUpdate}
                  disabled={isLoading || !testEmail}
                  className="btn-primary w-full"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Demo Status Update
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "test" && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Connection Testing
            </h3>

            <div className="space-y-3">
              <button
                onClick={testConnection}
                disabled={isLoading}
                className="btn-primary"
              >
                <Settings className="w-4 h-4 mr-2" />
                Test Mail Server Connection
              </button>

              <div className="flex gap-3">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="your-email@example.com"
                  className="input-field flex-1"
                />
                <button
                  onClick={sendTestEmail}
                  disabled={isLoading || !testEmail}
                  className="btn-primary"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send Test Email
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "config" && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Email Configuration
            </h3>
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                Current Configuration
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">SMTP Host:</span>
                  <span className="font-mono">smtp.gmail.com</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">SMTP Port:</span>
                  <span className="font-mono">587</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Shop Email:</span>
                  <span className="font-mono">admin@focus.com</span>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">
                Setup Instructions
              </h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>Update SMTP_USER and SMTP_PASS in backend .env file</li>
                <li>For Gmail: Use app-specific password</li>
                <li>For other providers: Configure SMTP_HOST and SMTP_PORT</li>
                <li>Test the connection using the Test tab</li>
              </ol>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div
            className={`mt-6 p-4 rounded-lg ${
              result.success
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <div className="flex items-center">
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              )}
              <span
                className={`font-medium ${
                  result.success ? "text-green-800" : "text-red-800"
                }`}
              >
                {result.success ? "Success!" : "Error"}
              </span>
            </div>
            <p
              className={`mt-1 text-sm ${
                result.success ? "text-green-700" : "text-red-700"
              }`}
            >
              {result.message}
            </p>
            {result.data && (
              <pre className="mt-2 text-xs bg-white dark:bg-gray-900 p-2 rounded border overflow-auto">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            )}
          </div>
        )}

        {isLoading && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              <span className="text-blue-800">Processing...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
