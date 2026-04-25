import React, { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  AlertCircle,
  HelpCircle
} from "lucide-react";

const NotificationContext = createContext(null);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmData, setConfirmData] = useState(null);

  const addToast = useCallback((message, type = "success", duration = 3000) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    
    if (duration !== Infinity) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setConfirmData({
        ...options,
        resolve
      });
    });
  }, []);

  const handleConfirm = (value) => {
    if (confirmData) {
      confirmData.resolve(value);
      setConfirmData(null);
    }
  };

  return (
    <NotificationContext.Provider value={{ toast: addToast, confirm }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-[2vw] right-[2vw] z-[9999] flex flex-col gap-[0.8vw] pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className={`
                pointer-events-auto flex items-center gap-[0.8vw] px-[1.2vw] py-[0.8vw] rounded-[0.8vw] shadow-lg border min-w-[18vw] max-w-[25vw]
                ${t.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : ""}
                ${t.type === "error" ? "bg-red-50 border-red-200 text-red-800" : ""}
                ${t.type === "warning" ? "bg-amber-50 border-amber-200 text-amber-800" : ""}
                ${t.type === "info" ? "bg-blue-50 border-blue-200 text-blue-800" : ""}
              `}
            >
              <div className="flex-shrink-0">
                {t.type === "success" && <CheckCircle className="w-[1.2vw] h-[1.2vw] text-emerald-500" />}
                {t.type === "error" && <AlertCircle className="w-[1.2vw] h-[1.2vw] text-red-500" />}
                {t.type === "warning" && <AlertTriangle className="w-[1.2vw] h-[1.2vw] text-amber-500" />}
                {t.type === "info" && <Info className="w-[1.2vw] h-[1.2vw] text-blue-500" />}
              </div>
              <p className="text-[0.85vw] font-medium flex-1">{t.message}</p>
              <button 
                onClick={() => removeToast(t.id)}
                className="p-[0.2vw] hover:bg-black/5 rounded-full transition-colors"
              >
                <X className="w-[1vw] h-[1vw] opacity-50" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Confirm Modal */}
      <AnimatePresence>
        {confirmData && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-[2vw] bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[1.2vw] shadow-2xl border border-slate-200 w-full max-w-[32vw] overflow-hidden"
            >
              <div className="p-[1.8vw] flex flex-col gap-[1.2vw]">
                <div className="flex items-start gap-[1.2vw]">
                  <div className={`
                    w-[3.5vw] h-[3.5vw] rounded-full flex items-center justify-center flex-shrink-0
                    ${confirmData.type === "danger" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}
                  `}>
                    {confirmData.type === "danger" ? <AlertTriangle className="w-[1.8vw] h-[1.8vw]" /> : <HelpCircle className="w-[1.8vw] h-[1.8vw]" />}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[1.2vw] font-bold text-slate-900 mb-[0.4vw]">
                      {confirmData.title || "Confirm Action"}
                    </h3>
                    <div className="text-[0.9vw] text-slate-500 leading-relaxed">
                      {typeof confirmData.message === "string" ? confirmData.message : confirmData.message}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-[0.8vw] mt-[0.6vw]">
                  <button
                    onClick={() => handleConfirm(false)}
                    className="px-[1.2vw] py-[0.6vw] rounded-[0.6vw] text-[0.85vw] font-semibold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    {confirmData.cancelText || "Cancel"}
                  </button>
                  <button
                    onClick={() => handleConfirm(true)}
                    className={`
                      px-[1.5vw] py-[0.6vw] rounded-[0.6vw] text-[0.85vw] font-bold text-white shadow-lg transition-all cursor-pointer
                      ${confirmData.type === "danger" ? "bg-red-600 hover:bg-red-700 shadow-red-200" : "bg-blue-600 hover:bg-blue-700 shadow-blue-200"}
                    `}
                  >
                    {confirmData.confirmText || "Confirm"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
};
