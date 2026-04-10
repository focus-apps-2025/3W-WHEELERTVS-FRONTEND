import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, Loader2, Repeat, Edit3 } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (file: File, remark?: string) => Promise<void>;
  onClose: () => void;
  disabled?: boolean;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose, disabled }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [remark, setRemark] = useState('');
  const [showRemarkInput, setShowRemarkInput] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let isMounted = true;

    const startCamera = async () => {
      try {
        setIsCameraReady(false);
        setError(null);
        
        // Stop any existing tracks
        if (videoRef.current && videoRef.current.srcObject) {
          const oldStream = videoRef.current.srcObject as MediaStream;
          oldStream.getTracks().forEach(track => track.stop());
        }

        // Simplified constraints - remove exact and width/height to avoid OverconstrainedError
        const constraints = {
          video: facingMode === 'environment' 
            ? { facingMode: 'environment' } 
            : { facingMode: 'user' }
        };

        console.log('Requesting camera with constraints:', constraints);
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (videoRef.current && isMounted) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          
          // Wait for video metadata to load
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current && isMounted) {
              videoRef.current.play()
                .then(() => {
                  console.log('Camera started successfully');
                  if (isMounted) {
                    setIsCameraReady(true);
                  }
                })
                .catch(err => {
                  console.error('Play error:', err);
                  if (isMounted) setError('Failed to play video stream');
                });
            }
          };
        }
      } catch (err) {
        console.error('Camera error:', err);
        if (isMounted) {
          // Try with default video constraints if facing mode fails
          try {
            console.log('Trying fallback camera constraints');
            const fallbackStream = await navigator.mediaDevices.getUserMedia({
              video: true
            });
            
            if (videoRef.current && isMounted) {
              videoRef.current.srcObject = fallbackStream;
              videoRef.current.onloadedmetadata = () => {
                if (videoRef.current && isMounted) {
                  videoRef.current.play()
                    .then(() => {
                      setIsCameraReady(true);
                      setError(null);
                    })
                    .catch(() => setError('Failed to start camera'));
                }
              };
            }
          } catch (fallbackErr) {
            console.error('Fallback camera error:', fallbackErr);
            setError('Unable to access camera. Please check permissions and ensure no other app is using the camera.');
          }
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const oldStream = videoRef.current.srcObject as MediaStream;
        oldStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const switchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const capturePhoto = () => {
    console.log('Capture button clicked, camera ready:', isCameraReady);
    
    if (!isCameraReady) {
      setError('Camera is not ready yet. Please wait.');
      return;
    }
    
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Get video dimensions
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      
      if (videoWidth === 0 || videoHeight === 0) {
        setError('Unable to capture: Video dimensions not available');
        return;
      }
      
      console.log('Capturing photo:', videoWidth, 'x', videoHeight);
      
      // Set canvas to video dimensions
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      
      // Draw video frame
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to data URL
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(imageData);
        
        // Stop the stream
        if (video.srcObject) {
          const stream = video.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
        }
        setIsCameraReady(false);
      }
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setError(null);
    setRemark('');
    setShowRemarkInput(false);
    // Refresh the page to restart camera
    window.location.reload();
  };

  const uploadPhoto = async () => {
    if (capturedImage && !isUploading) {
      setIsUploading(true);
      try {
        const response = await fetch(capturedImage);
        const blob = await response.blob();
        const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
        await onCapture(file, remark);
        onClose();
      } catch (err) {
        console.error('Upload failed:', err);
        setError('Failed to upload photo');
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            Take Photo
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            disabled={isUploading}
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Camera/Preview Area */}
        <div className="relative bg-black" style={{ minHeight: '400px', maxHeight: '60vh' }}>
          {!capturedImage ? (
            <>
              {!isCameraReady && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
                  <Loader2 className="w-8 h-8 animate-spin text-white" />
                  <span className="mt-2 text-white text-sm">Starting camera...</span>
                  <span className="text-white text-xs mt-1 opacity-75">Please allow camera access</span>
                </div>
              )}
              
              {/* Video Container */}
              <div className="relative w-full h-full flex items-center justify-center bg-black" style={{ minHeight: '400px' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ 
                    display: isCameraReady ? 'block' : 'none',
                    transform: facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)'
                  }}
                />
              </div>
              
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Switch Camera Button */}
              {isCameraReady && (
                <button
                  onClick={switchCamera}
                  className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors backdrop-blur z-20"
                  title="Switch Camera"
                >
                  <Repeat className="w-5 h-5 text-white" />
                </button>
              )}

              {/* Capture Button - Bottom Center */}
              {isCameraReady && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center z-20">
                  <button
                    onClick={capturePhoto}
                    disabled={disabled || !isCameraReady}
                    className="flex items-center justify-center w-16 h-16 bg-white rounded-full hover:bg-gray-200 transition-all transform hover:scale-105 active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Camera className="w-8 h-8 text-black" />
                  </button>
                </div>
              )}
            </>
          ) : (
            // Preview captured image
            <div className="relative w-full h-full flex items-center justify-center bg-black" style={{ minHeight: '400px' }}>
              <img
                src={capturedImage}
                alt="Captured"
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </div>

        {/* Remark Input Section */}
        {capturedImage && !showRemarkInput && (
          <div className="p-3 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={() => setShowRemarkInput(true)}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-blue-500 transition-colors"
            >
              <Edit3 className="w-3 h-3" />
              Add a remark/note...
            </button>
          </div>
        )}

        {showRemarkInput && (
          <div className="p-3 border-t border-gray-100 dark:border-gray-800">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-tight mb-1">
              Remark / Note
            </label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Add any notes about this photo..."
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              rows={2}
            />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs border-t border-red-200 dark:border-red-800">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
            <button
              onClick={() => {
                setError(null);
                window.location.reload();
              }}
              className="mt-2 text-xs bg-red-100 dark:bg-red-900/40 px-3 py-1 rounded hover:bg-red-200 dark:hover:bg-red-800/40 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="p-4 flex justify-center gap-4 border-t border-gray-100 dark:border-gray-800">
          {capturedImage && (
            <>
              <button
                onClick={retakePhoto}
                disabled={isUploading}
                className="flex items-center gap-2 px-5 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-full transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                Retake
              </button>
              <button
                onClick={uploadPhoto}
                disabled={isUploading}
                className="flex items-center gap-2 px-5 py-3 bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors disabled:opacity-50"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Use Photo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraCapture;