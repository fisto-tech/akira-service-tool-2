import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [user, setUser] = useState(() => JSON.parse(sessionStorage.getItem('loggedInUser')));

  const fetchNotifications = useCallback(async (userId) => {
    try {
      // VITE_API_URL already contains '/api', so we shouldn't append it again
      const baseUrl = import.meta.env.VITE_API_URL;
      const res = await axios.get(`${baseUrl}/notifications/${userId}`);
      setNotifications(res.data);
      setUnreadCount(res.data.filter(n => !n.isRead).length);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, []);

  // Monitor session storage manually or via custom event
  useEffect(() => {
    const handleAuthChange = () => {
      const loggedUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
      setUser(loggedUser);
    };

    window.addEventListener('auth-change', handleAuthChange);
    // Initial check
    if (!user) handleAuthChange();

    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  useEffect(() => {
    if (user && !socket) {
      // Use the base URL without /api for socket connection
      const socketUrl = import.meta.env.VITE_API_BASE_URL1 || 
                       (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000');
      
      const newSocket = io(socketUrl, {
        transports: ['websocket', 'polling'], // Added transports for better compatibility
        withCredentials: true
      });
      
      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
        newSocket.emit('join-room', user.userId);
      });

      newSocket.on('notification:new', (notification) => {
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);
        
        if (Notification.permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/logo.png' 
          });
        }
      });

      fetchNotifications(user.userId);

      return () => {
          newSocket.off('notification:new');
          newSocket.close();
          setSocket(null);
      };
    }
  }, [user, fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      await axios.patch(`${import.meta.env.VITE_API_URL}/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const markAllAsRead = async () => {
      if (!user) return;
      try {
          await axios.patch(`${import.meta.env.VITE_API_URL}/notifications/${user.userId}/read-all`);
          setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
          setUnreadCount(0);
      } catch (err) {
          console.error('Error marking all as read:', err);
      }
  };

  const deleteNotification = async (id) => {
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n._id !== id));
      // Re-fetch or manually adjust unreadCount if needed
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const requestPermission = () => {
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  };

  return (
    <SocketContext.Provider value={{ socket, notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, requestPermission }}>
      {children}
    </SocketContext.Provider>
  );
};
