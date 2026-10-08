import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

const PolicyViolationsWidget = () => {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchViolations = async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('smartfix_token') || localStorage.getItem('smartfix_token');
        const baseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const res = await fetch(`${baseUrl}/admin/policy-violations`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setViolations(data.violations);
        }
      } catch (err) {
        console.error('Failed to load violations', err);
      } finally {
        setLoading(false);
      }
    };
    fetchViolations();
  }, []);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100">
      <div className="flex items-center gap-2 mb-4">
        <ShieldAlert className="text-red-500" size={24} />
        <h3 className="text-lg font-bold text-gray-800">Contact Policy Violations (Top Offenders)</h3>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading audit logs...</p>
      ) : violations.length === 0 ? (
        <p className="text-green-600 text-sm font-medium flex items-center gap-2">
          <AlertTriangle size={16} /> No recent contact sharing attempts.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Flagged Attempts</th>
                <th className="px-4 py-2">Last Incident</th>
              </tr>
            </thead>
            <tbody>
              {violations.map((v) => (
                <tr key={v._id} className="border-b">
                  <td className="px-4 py-2 font-medium">{v.user?.name || 'Unknown User'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${v.role === 'Worker' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                      {v.role}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-red-600 font-bold">{v.count}</td>
                  <td className="px-4 py-2">{new Date(v.lastAttemptAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PolicyViolationsWidget;
