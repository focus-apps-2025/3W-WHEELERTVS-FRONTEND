import React from "react";
import { Heart } from "lucide-react";
import { Link } from "react-router-dom";

export default function ThankYouMessage() {
  return (
    <div className="w-full bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center py-6 sm:py-12 px-4 sm:px-6 min-h-screen">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 text-center">
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto mb-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
            <Heart className="w-12 h-12 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
            Thanks for sharing your thoughts!
          </h1>
          <p className="text-lg text-gray-700 dark:text-gray-300">
            Your response has been successfully submitted.
          </p>
        </div>
        <Link
          to="/forms/analytics"
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to Forms
        </Link>
      </div>
    </div>
  );
}
