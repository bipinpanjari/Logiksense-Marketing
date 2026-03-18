import React from 'react';
import { Trash2, Edit2, Play, Pause } from 'lucide-react';

export default function SequencesList({ sequences, setSequences }: any) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'paused':
        return 'status-paused';
      case 'draft':
        return 'status-draft';
      default:
        return 'status-draft';
    }
  };

  return (
    <div className="email-card">
      <div className="email-card-header">
        <h3 className="email-card-title">Email Sequences</h3>
      </div>

      {sequences.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📧</div>
          <p className="empty-state-title">No Sequences Yet</p>
          <p className="empty-state-text">
            Create your first email sequence using the "New Sequence" tab
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="email-table">
            <thead>
              <tr>
                <th>Sequence Name</th>
                <th>Status</th>
                <th>Steps</th>
                <th>Active Leads</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sequences.map((seq: any) => (
                <tr key={seq.id}>
                  <td style={{ fontWeight: 600 }}>{seq.name}</td>
                  <td>
                    <span className={`status-badge ${getStatusColor(seq.status)}`}>
                      {seq.status}
                    </span>
                  </td>
                  <td>{seq.steps?.length || 0}</td>
                  <td>{seq.activeLeads || 0}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-icon" title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button className="btn btn-icon" title={seq.status === 'active' ? 'Pause' : 'Play'}>
                        {seq.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button
                        onClick={() => setSequences(sequences.filter((s: any) => s.id !== seq.id))}
                        className="btn btn-icon"
                        title="Delete"
                        style={{ color: '#dc2626' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
