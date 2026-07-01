import React from "react";
import { useRouteError, isRouteErrorResponse, useNavigate } from "react-router-dom";
import { AlertCircle, Home, ArrowLeft, RefreshCcw } from "lucide-react";

export default function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  let errorMessage = "An unexpected error occurred.";
  let errorCode = "Error";

  if (isRouteErrorResponse(error)) {
    errorCode = error.status.toString();
    errorMessage = error.statusText || error.data?.message || errorMessage;
    
    if (error.status === 404) {
      errorMessage = "The page you're looking for doesn't exist.";
    } else if (error.status === 401) {
      errorMessage = "You aren't authorized to see this.";
    } else if (error.status === 503) {
      errorMessage = "Looks like our API is down.";
    } else if (error.status === 418) {
      errorMessage = "🫖";
    }
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 to-primary-900 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full mb-6">
            <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
          </div>
          
          <h1 className="text-6xl font-black text-gray-200 dark:text-gray-700 mb-2">
            {errorCode}
          </h1>
          
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Oops! Something went wrong
          </h2>
          
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            {errorMessage}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl transition-all duration-200 font-medium group"
            >
              <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
              Go Back
            </button>
            
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center justify-center px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-all duration-200 font-medium shadow-lg shadow-primary-600/20 group"
            >
              <Home className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
              Dashboard
            </button>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex items-center text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium"
          >
            <RefreshCcw className="w-4 h-4 mr-1" />
            Try again
          </button>
        </div>
        
        <div className="px-8 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex justify-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            If you think this is a mistake, please contact support.
          </p>
        </div>
      </div>
    </div>
  );
}
