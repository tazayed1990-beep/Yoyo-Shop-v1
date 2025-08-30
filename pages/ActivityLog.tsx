import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import Spinner from '../components/ui/Spinner';
import Card from '../components/ui/Card';

interface LogEntry {
  id: string;
  user: string;
  action: string;
  details: string;
  timestamp: any;
}

const ActivityLog: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = db.collection('activityLog')
      .orderBy('timestamp', 'desc')
      .limit(200) // prevent fetching too much data
      .onSnapshot(snapshot => {
        const logData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate()
        })) as LogEntry[];
        setLogs(logData);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching activity logs:", error);
        setLoading(false);
      });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-full"><Spinner /></div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold text-gray-800 mb-6">Activity Log</h1>
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full leading-normal">
            <thead>
              <tr>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Timestamp</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">
                    {log.timestamp ? log.timestamp.toLocaleString() : 'N/A'}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">{log.user}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">{log.action}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default ActivityLog;
