import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, Calendar, FileText, Clock } from 'lucide-react';
import { apiClient } from '../../api/client';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'leave_request' | 'permission_request' | 'leave_status' | 'permission_status' | 'general';
  isRead: boolean;
  createdAt: string;
  relatedEntity: string;
  entityId: string;
}

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await apiClient.getMyNotifications();
      console.log('Notifications response:', res);
      if (res && res.data) {
        setNotifications(res.data);
        setUnreadCount(res.unreadCount || 0);
      } else if (res && Array.isArray(res)) {
        setNotifications(res);
      }
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Refresh every minute
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await apiClient.markNotificationAsRead(id);
      setNotifications(prev => 
        prev.map(n => n._id === id ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'leave_request': return <Calendar className="w-4 h-4 text-blue-500" />;
      case 'permission_request': return <Clock className="w-4 h-4 text-purple-500" />;
      case 'leave_status': 
      case 'permission_status': return <FileText className="w-4 h-4 text-green-500" />;
      default: return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-gray-600 focus:outline-none"
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-20 overflow-hidden transform transition-all animate-in fade-in slide-in-from-top-2">
            <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-white">
              <h3 className="text-lg font-bold text-gray-800">Notifications</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={handleMarkAllRead}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-10 text-center">
                  <Bell className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications?.map((notification) => (
                  <div 
                    key={notification._id}
                    className={`p-4 border-b border-gray-50 flex gap-3 transition-colors ${notification.isRead ? 'bg-white' : 'bg-blue-50/30'}`}
                    onClick={() => !notification.isRead && handleMarkAsRead(notification._id)}
                  >
                    <div className="mt-1 flex-shrink-0 bg-white p-2 rounded-lg shadow-sm border border-gray-100">
                      {getTypeIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <p className={`text-sm font-bold truncate ${notification.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
                          {notification.title}
                        </p>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                          {new Date(notification.createdAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </div>
                      <p className={`text-xs leading-relaxed ${notification.isRead ? 'text-gray-500' : 'text-gray-600 font-medium'}`}>
                        {notification.message}
                      </p>
                      {!notification.isRead && (
                        <div className="mt-2">
                          <span className="inline-block h-2 w-2 rounded-full bg-blue-500"></span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-gray-50 text-center border-t border-gray-100">
              <button 
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold text-gray-500 hover:text-gray-700 uppercase tracking-wider"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
