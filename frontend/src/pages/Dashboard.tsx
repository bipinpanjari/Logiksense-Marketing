import React from 'react';
import { BarChart3, TrendingUp, Users, Mail } from 'lucide-react';

export default function Dashboard() {
  const stats = [
    { label: 'Total Leads', value: '1,248', icon: Users, color: '#000' },
    { label: 'Emails Sent', value: '5,432', icon: Mail, color: '#000' },
    { label: 'Conversion Rate', value: '3.2%', icon: TrendingUp, color: '#000' },
    { label: 'Active Campaigns', value: '12', icon: BarChart3, color: '#000' },
  ];

  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '32px', color: '#333333' }}>Dashboard</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} style={{
              background: 'white',
              border: '2px solid #333333',
              borderRadius: 0,
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#666' }}>{stat.label}</span>
                <Icon size={20} style={{ color: '#333333' }} />
              </div>
              <span style={{ fontSize: '28px', fontWeight: 700, color: '#333333' }}>{stat.value}</span>
            </div>
          );
        })}
      </div>

      <div style={{
        background: 'white',
        border: '2px solid #333333',
        borderRadius: 0,
        padding: '24px'
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#333333' }}>Recent Activity</h3>
        <div style={{ color: '#666' }}>
          <p style={{ marginBottom: '12px' }}>📧 New email campaign "Spring Promotion" created</p>
          <p style={{ marginBottom: '12px' }}>👥 Imported 125 leads from CSV file</p>
          <p style={{ marginBottom: '12px' }}>✅ Email sequence "Welcome" completed 450 sends</p>
          <p>📊 Analytics report generated for last 30 days</p>
        </div>
      </div>
    </div>
  );
}
