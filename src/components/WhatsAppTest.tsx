import React, { useState } from "react";
import { MessageCircle, Send, CheckCircle, AlertCircle, Settings } from "lucide-react";

interface WhatsAppTestProps {}

export default function WhatsAppTest({}: WhatsAppTestProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [testPhone, setTestPhone] = useState("");
  const [activeTab, setActiveTab] = useState<"test" | "config" | "demo">(
    "demo"
  );

  const testConnection = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/whatsapp/test-connection", {
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

  const sendTestMessage = async () => {
    if (!testPhone) {
      setResult({
        success: false,
        message: "Please enter a test phone number",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/whatsapp/test-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone: testPhone }),
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
    if (!testPhone) {
      setResult({
        success: false,
        message: "Please enter a phone number to receive demo messages",
      });
      return;
    }

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
            "Routine maintenance - oil change, filter replacement, and general inspection",
          urgency: "Normal",
          preferredDate: new Date().toLocaleDateString(),
        },
        customerInfo: {
          name: "Demo Customer",
          phone: testPhone,
          email: "demo@example.com",
        },
      };

      const response = await fetch("/api/whatsapp/service-request-notification", {
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
    if (!testPhone) {
      setResult({
        success: false,
        message: "Please enter a phone number for status update",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const token = localStorage.getItem("auth_token");
      const demoData = {
        serviceRequest: {
          vehicleMake: "Toyota",
          vehicleModel: "Corolla",
        },
        customerInfo: {
          name: "Demo Customer",
          phone: testPhone,
        },
        status: "completed",
        message:
          "Great news! Your Toyota Corolla service is complete. We performed an oil change, replaced the air filter, and completed a comprehensive 21-point inspection. Everything looks good!",
        estimatedCompletion: "Ready for pickup now",
      };

      const response = await fetch("/api/whatsapp/status-update", {
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
          WhatsApp Service Test
        </h1>
        <p className="text-primary-600">
          Test and configure the Focus Form WhatsApp system (Powered by Twilio)
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
            Demo Messages
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

      <div className="bg-white rounded-lg border border-neutral-200 p-6">
        {activeTab === "demo" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Demo WhatsApp Messages
              </h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Phone Number (with country code)
                </label>
                <input
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+1-555-123-4567 or +919876543210"
                  className="input-field"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Include country code (e.g., +1 for US, +91 for India)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">
                  🚗 Service Request Notification
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  Demo message sent when a customer submits a service request
                </p>
                <button
                  onClick={sendDemoServiceRequest}
                  disabled={isLoading || !testPhone}
                  className="btn-primary w-full"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Demo Request
                </button>
              </div>

              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">
                  📱 Status Update
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  Demo message sent to update customers on their service status
                </p>
                <button
                  onClick={sendDemoStatusUpdate}
                  disabled={isLoading || !testPhone}
                  className="btn-primary w-full"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Demo Status
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "test" && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              Connection Testing
            </h3>

            <div className="space-y-3">
              <button
                onClick={testConnection}
                disabled={isLoading}
                className="btn-primary"
              >
                <Settings className="w-4 h-4 mr-2" />
                Test Twilio WhatsApp Connection
              </button>

              <div className="flex gap-3">
                <input
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+1-555-123-4567 or +919876543210"
                  className="input-field flex-1"
                />
                <button
                  onClick={sendTestMessage}
                  disabled={isLoading || !testPhone}
                  className="btn-primary"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Send Test
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "config" && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              WhatsApp Configuration
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">
                Current Configuration
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Service Provider:</span>
                  <span className="font-mono">Twilio</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Message Type:</span>
                  <span className="font-mono">WhatsApp Business API</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Authentication:</span>
                  <span className="font-mono">Account SID + Auth Token</span>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">
                Setup Instructions
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                <li>Create a Twilio account at <a href="https://www.twilio.com" target="_blank" rel="noopener noreferrer" className="underline">twilio.com</a></li>
                <li>Set up WhatsApp Sandbox or Business Account</li>
                <li>Get your Account SID from Twilio Console</li>
                <li>Generate Auth Token from Twilio Console</li>
                <li>Get your WhatsApp Number from Twilio (or use sandbox)</li>
                <li>Add to backend .env file:
                  <div className="bg-white p-2 rounded mt-1 font-mono text-xs">
                    TWILIO_ACCOUNT_SID=your_account_sid<br/>
                    TWILIO_AUTH_TOKEN=your_auth_token<br/>
                    TWILIO_WHATSAPP_NUMBER=+1234567890<br/>
                    TWILIO_SHOP_WHATSAPP=+1234567890
                  </div>
                </li>
                <li>Test the connection using the Test tab</li>
              </ol>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">
                Features Included
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-green-800">
                <li>Service request notifications to shop</li>
                <li>Customer confirmation messages</li>
                <li>Real-time status updates</li>
                <li>Report notifications with details</li>
                <li>Formatted messages with emojis</li>
                <li>Automatic phone number formatting</li>
              </ul>
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
              <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-auto">
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
