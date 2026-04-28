import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Settings,
  Trash2,
  CheckCheck,
  Filter,
  Clock,
  AlertCircle,
  UserCheck,
  Zap,
  Package,
  Wrench
} from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { formatDistanceToNow } from 'date-fns';

const NotificationsDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState('All');
  const [activeSubTab, setActiveSubTab] = useState('all');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [sortOrder, setSortOrder] = useState('Desc');
  const dropdownRef = useRef(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, requestPermission } = useSocket();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const mainTabs = ['All', 'Service Call'];
  const subTabs = ['all', 'Assignment', 'Escalation', 'Critical'];

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      let matchesMain = activeMainTab === 'All';
      if (!matchesMain) {
        if (activeMainTab === 'Service Call') {
          matchesMain = ['Assignment', 'Escalation', 'Critical'].includes(n.type);
          if (matchesMain && activeSubTab !== 'all') {
            matchesMain = n.type === activeSubTab;
          }
        } else {
          matchesMain = n.type === activeMainTab;
        }
      }
      const matchesUnread = !onlyUnread || !n.isRead;
      return matchesMain && matchesUnread;
    }).sort((a, b) => {
      if (sortOrder === 'Desc') return new Date(b.createdAt) - new Date(a.createdAt);
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  }, [notifications, activeMainTab, activeSubTab, onlyUnread, sortOrder]);

  const getUnreadCount = (mainTab, subTab = null) => {
    return notifications.filter(n => {
      if (n.isRead) return false;
      if (mainTab === 'All') return true;
      if (mainTab === 'Service Call') {
        const isServiceCall = ['Assignment', 'Escalation', 'Critical'].includes(n.type);
        if (!isServiceCall) return false;
        if (!subTab || subTab === 'all') return true;
        return n.type === subTab;
      }
      return n.type === mainTab;
    }).length;
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Assignment': return <UserCheck className="w-[1vw] h-[1vw] text-blue-600" />;
      case 'Escalation': return <Zap className="w-[1vw] h-[1vw] text-amber-600" />;
      case 'Critical': return <AlertCircle className="w-[1vw] h-[1vw] text-red-600" />;
      case 'Service Material': return <Wrench className="w-[1vw] h-[1vw] text-emerald-600" />;
      case 'Production NC': return <Package className="w-[1vw] h-[1vw] text-purple-600" />;
      default: return <Bell className="w-[1vw] h-[1vw] text-slate-600" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          requestPermission();
        }}
        className={`relative p-[0.5vw] rounded-full border transition-all cursor-pointer group ${isOpen ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:border-blue-300'}`}
      >
        <Bell className={`w-[1.1vw] h-[1.1vw] transition-colors ${isOpen ? 'text-blue-600' : 'text-black group-hover:text-blue-600'}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-[0.2vw] -right-[0.2vw] bg-red-600 text-white text-[0.6vw] font-semibold px-[0.3vw] py-[0.05vw] rounded-full border border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="absolute right-0 mt-[0.6vw] w-[34vw] bg-white rounded-[1vw] border border-slate-200 z-[2000] overflow-hidden"
          >
            {/* Header */}
            <div className="p-[1vw] border-b border-slate-100 bg-slate-50/30">
              <div className="flex items-center justify-between mb-[0.8vw]">
                <h3 className="text-[1.1vw] font-semibold text-black">Notifications</h3>
                <div className="flex items-center gap-[0.8vw]">
                  <button
                    onClick={() => setSortOrder(s => s === 'Asc' ? 'Desc' : 'Asc')}
                    className="flex items-center gap-[0.3vw] text-[0.75vw] font-medium text-black hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    <Filter className="w-[0.8vw] h-[0.8vw]" /> Sort: {sortOrder}
                  </button>
                  <div className="flex items-center gap-[0.4vw]">
                    <span className="text-[0.75vw] font-medium text-black">Only Unread</span>
                    <button
                      onClick={() => setOnlyUnread(!onlyUnread)}
                      className={`relative w-[2vw] h-[1.1vw] rounded-full transition-colors border ${onlyUnread ? 'bg-blue-600 border-blue-700' : 'bg-slate-200 border-slate-300'}`}
                    >
                      <div className={`absolute top-1/2 -translate-y-1/2 w-[0.75vw] h-[0.75vw] bg-white rounded-full transition-all ${onlyUnread ? 'left-[1.1vw]' : 'left-[0.15vw]'}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Tabs */}
              <div className="flex items-center gap-[1.2vw] mb-[0.6vw] border-b border-slate-100">
                {mainTabs.map(tab => {
                  const count = getUnreadCount(tab);
                  return (
                    <button
                      key={tab}
                      onClick={() => {
                        setActiveMainTab(tab);
                        setActiveSubTab('all');
                      }}
                      className={`relative pb-[0.4vw] text-[0.8vw] font-medium transition-all cursor-pointer flex items-center gap-[0.3vw] ${activeMainTab === tab ? 'text-blue-600' : 'text-black hover:text-blue-500'}`}
                    >
                      {tab}
                      {count > 0 && (
                        <span className="bg-blue-100 text-blue-700 text-[0.6vw] px-[0.4vw] py-[0.05vw] rounded-full font-bold border border-blue-200">
                          {count}
                        </span>
                      )}
                      {activeMainTab === tab && (
                        <motion.div layoutId="mainTab" className="absolute bottom-0 left-0 right-0 h-[0.1vw] bg-blue-600 rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Sub Tabs for Service Call */}
              {activeMainTab === 'Service Call' && (
                <div className="flex items-center gap-[0.8vw] mt-[0.4vw]">
                  {subTabs.map(tab => {
                    const count = getUnreadCount('Service Call', tab);
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveSubTab(tab)}
                        className={`px-[0.6vw] py-[0.2vw] rounded-full text-[0.7vw] font-medium transition-all border cursor-pointer flex items-center gap-[0.25vw] ${activeSubTab === tab ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-black border-slate-200 hover:border-blue-300'}`}
                      >
                        {tab === 'all' ? 'All' : tab === 'Assignment' ? 'Assignments' : tab === 'Escalation' ? 'Escalations' : tab}
                        {count > 0 && (
                          <span className={`text-[0.6vw] px-[0.3vw] py-[0.02vw] rounded-full font-bold ${activeSubTab === tab ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-700'}`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end mt-[0.4vw]">
                <button
                  onClick={markAllAsRead}
                  className="text-[0.7vw] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-[0.2vw] cursor-pointer"
                >
                  <CheckCheck className="w-[0.8vw] h-[0.8vw]" /> Mark all as read
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="max-h-[28vw] overflow-y-auto bg-white p-[0.6vw] space-y-[0.6vw]">
              {filteredNotifications.length === 0 ? (
                <div className="py-[3vw] flex flex-col items-center justify-center text-center">
                  <div className="w-[3.5vw] h-[3.5vw] rounded-full border border-slate-100 bg-slate-50 flex items-center justify-center mb-[0.8vw]">
                    <Bell className="w-[1.8vw] h-[1.8vw] text-slate-200" />
                  </div>
                  <p className="text-[0.9vw] font-medium text-black">No notifications yet</p>
                  <p className="text-[0.75vw] text-black opacity-60">We'll notify you when something important happens.</p>
                </div>
              ) : (
                filteredNotifications.map((n) => (
                  <motion.div
                    key={n._id}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`group relative bg-white border border-slate-100 rounded-[0.6vw] p-[0.8vw] transition-all hover:border-blue-300 ${!n.isRead ? 'bg-blue-50/20 border-l-[0.2vw] border-l-blue-600' : ''}`}
                    onClick={() => !n.isRead && markAsRead(n._id)}
                  >
                    <div className="flex gap-[0.8vw]">
                      <div className="w-[2.8vw] h-[2.8vw] rounded-[0.6vw] bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-white group-hover:border-blue-100 transition-all">
                        {getTypeIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-[0.1vw]">
                          <h4 className="text-[0.85vw] font-semibold text-black truncate pr-[1vw]">{n.title}</h4>
                          <div className="flex items-center gap-[0.4vw]">
                            {n.priority === 'Critical' && (
                              <span className="bg-red-50 text-red-600 text-[0.6vw] font-bold px-[0.4vw] py-[0.05vw] rounded-full border border-red-100">CRITICAL</span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(n._id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-[0.2vw] text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                            >
                              <Trash2 className="w-[0.75vw] h-[0.75vw]" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[0.75vw] text-black opacity-80 leading-snug mb-[0.4vw] font-normal">{n.message}</p>

                        <div className="flex items-center justify-between pt-[0.4vw] border-t border-slate-50">
                          <div className="flex items-center gap-[0.3vw] text-[0.65vw] font-medium text-black opacity-60">
                            <Clock className="w-[0.7vw] h-[0.7vw]" />
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </div>
                          {n.data?.callNumber && (
                            <div className="text-[0.65vw] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-[0.4vw] py-[0.05vw] rounded-[0.2vw]">
                              #{n.data.callNumber}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-[0.6vw] border-t border-slate-100 bg-slate-50/50 flex justify-center">
              <button className="text-[0.75vw] font-medium text-black opacity-70 hover:opacity-100 flex items-center gap-[0.3vw] transition-all cursor-pointer">
                <Settings className="w-[0.8vw] h-[0.8vw]" /> Notification Settings
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationsDropdown;
