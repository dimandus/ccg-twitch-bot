import React, { useRef, useEffect } from 'react';
import '../styles/ActivityLog.css';
import { FiClipboard } from 'react-icons/fi';

function ActivityLog({ logs }) {
  const logsEndRef = useRef(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="activity-log">
      <div className="log-header">
        <FiClipboard className="log-icon" />
        <h2>ЛОГИ АКТИВНОСТИ БОТА</h2>
      </div>
      <div className="log-container">
        <div className="logs-list">
          {logs.map((log, index) => (
            <div key={index} className="log-entry">
              {log}
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}

export default ActivityLog;
