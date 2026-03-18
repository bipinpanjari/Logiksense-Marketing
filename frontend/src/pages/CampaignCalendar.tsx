import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Users, Mail, Check } from 'lucide-react';

interface DailyActivity {
  date: string;
  emailsSent: number;
  leadsBooked: number;
  meetingsScheduled: number;
  conversionsMade: number;
  leads: {
    id: string;
    name: string;
    email: string;
    action: 'email_sent' | 'booked' | 'meeting' | 'converted';
    time: string;
  }[];
}

export default function CampaignCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 17)); // March 17, 2026
  const [selectedDay, setSelectedDay] = useState<DailyActivity | null>(null);

  // Mock data for calendar
  const activityData: { [key: string]: DailyActivity } = {
    '2026-03-01': {
      date: '2026-03-01',
      emailsSent: 25,
      leadsBooked: 3,
      meetingsScheduled: 2,
      conversionsMade: 1,
      leads: [
        { id: '1', name: 'John Smith', email: 'john@example.com', action: 'email_sent', time: '09:30 AM' },
        { id: '2', name: 'Sarah Johnson', email: 'sarah@example.com', action: 'email_sent', time: '09:32 AM' },
        { id: '3', name: 'Mike Chen', email: 'mike@example.com', action: 'booked', time: '02:15 PM' },
      ]
    },
    '2026-03-05': {
      date: '2026-03-05',
      emailsSent: 42,
      leadsBooked: 6,
      meetingsScheduled: 4,
      conversionsMade: 2,
      leads: [
        { id: '4', name: 'Emily Davis', email: 'emily@example.com', action: 'email_sent', time: '10:00 AM' },
        { id: '5', name: 'Robert Wilson', email: 'robert@example.com', action: 'meeting', time: '11:30 AM' },
        { id: '6', name: 'Lisa Anderson', email: 'lisa@example.com', action: 'converted', time: '03:45 PM' },
      ]
    },
    '2026-03-10': {
      date: '2026-03-10',
      emailsSent: 38,
      leadsBooked: 5,
      meetingsScheduled: 3,
      conversionsMade: 1,
      leads: [
        { id: '7', name: 'David Brown', email: 'david@example.com', action: 'email_sent', time: '09:00 AM' },
        { id: '8', name: 'Jennifer Lee', email: 'jennifer@example.com', action: 'booked', time: '01:20 PM' },
      ]
    },
    '2026-03-15': {
      date: '2026-03-15',
      emailsSent: 56,
      leadsBooked: 8,
      meetingsScheduled: 5,
      conversionsMade: 3,
      leads: [
        { id: '9', name: 'Christopher Green', email: 'chris@example.com', action: 'email_sent', time: '08:45 AM' },
        { id: '10', name: 'Amanda White', email: 'amanda@example.com', action: 'booked', time: '02:30 PM' },
        { id: '11', name: 'Kevin Martinez', email: 'kevin@example.com', action: 'converted', time: '04:00 PM' },
      ]
    },
    '2026-03-17': {
      date: '2026-03-17',
      emailsSent: 48,
      leadsBooked: 7,
      meetingsScheduled: 4,
      conversionsMade: 2,
      leads: [
        { id: '12', name: 'Jessica Taylor', email: 'jessica@example.com', action: 'email_sent', time: '09:15 AM' },
        { id: '13', name: 'Daniel Moore', email: 'daniel@example.com', action: 'booked', time: '11:00 AM' },
        { id: '14', name: 'Rachel Davis', email: 'rachel@example.com', action: 'meeting', time: '03:00 PM' },
      ]
    },
    '2026-03-20': {
      date: '2026-03-20',
      emailsSent: 32,
      leadsBooked: 4,
      meetingsScheduled: 2,
      conversionsMade: 1,
      leads: [
        { id: '15', name: 'Paul Anderson', email: 'paul@example.com', action: 'email_sent', time: '10:30 AM' },
      ]
    },
    '2026-03-25': {
      date: '2026-03-25',
      emailsSent: 61,
      leadsBooked: 9,
      meetingsScheduled: 6,
      conversionsMade: 4,
      leads: [
        { id: '16', name: 'Susan Jackson', email: 'susan@example.com', action: 'email_sent', time: '09:00 AM' },
        { id: '17', name: 'Mark Thompson', email: 'mark@example.com', action: 'booked', time: '01:45 PM' },
        { id: '18', name: 'Lauren Harris', email: 'lauren@example.com', action: 'converted', time: '04:30 PM' },
      ]
    }
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDateKey = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    setSelectedDay(null);
  };

  const handleDayClick = (day: number) => {
    const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dayData = activityData[dateKey];
    setSelectedDay(dayData || { date: dateKey, emailsSent: 0, leadsBooked: 0, meetingsScheduled: 0, conversionsMade: 0, leads: [] });
  };

  const getActivityLevel = (emailsSent: number) => {
    if (emailsSent > 50) return '#dc2626';
    if (emailsSent > 35) return '#f97316';
    if (emailsSent > 20) return '#eab308';
    if (emailsSent > 0) return '#10b981';
    return '#e5e5e5';
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = [];

  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  // Days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#333333', margin: '0 0 32px 0' }}>
        📅 Campaign Calendar
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Calendar */}
        <div style={{ background: 'white', border: '2px solid #333333', borderRadius: 0, padding: '24px' }}>
          {/* Month Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <button
              onClick={handlePrevMonth}
              style={{
                background: 'white',
                border: '2px solid #333333',
                borderRadius: 0,
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ChevronLeft size={20} />
            </button>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#333333' }}>{monthName}</h2>
            <button
              onClick={handleNextMonth}
              style={{
                background: 'white',
                border: '2px solid #333333',
                borderRadius: 0,
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', fontSize: '11px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', background: '#10b981' }}></div>
              <span>Low (1-20)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', background: '#eab308' }}></div>
              <span>Medium (21-35)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', background: '#f97316' }}></div>
              <span>High (36-50)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', background: '#dc2626' }}></div>
              <span>Very High (50+)</span>
            </div>
          </div>

          {/* Day Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '8px' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} style={{ textAlign: 'center', fontWeight: 700, color: '#666', fontSize: '12px', padding: '8px' }}>
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
            {days.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`}></div>;
              }

              const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), day);
              const dayActivity = activityData[dateKey];
              const emailsSent = dayActivity?.emailsSent || 0;
              const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();

              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(day)}
                  style={{
                    background: getActivityLevel(emailsSent),
                    border: isToday ? '3px solid #333333' : '2px solid #ddd',
                    borderRadius: 0,
                    padding: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '80px',
                    transition: 'all 0.2s',
                    opacity: emailsSent > 0 ? 1 : 0.6
                  }}
                  onMouseEnter={(e) => {
                    if (emailsSent > 0) {
                      (e.target as HTMLButtonElement).style.transform = 'scale(1.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLButtonElement).style.transform = 'scale(1)';
                  }}
                >
                  <div style={{ fontSize: '16px', fontWeight: 700, color: emailsSent > 0 ? 'white' : '#666', marginBottom: '4px' }}>
                    {day}
                  </div>
                  {emailsSent > 0 && (
                    <>
                      <div style={{ fontSize: '11px', color: 'white', fontWeight: 600 }}>
                        {emailsSent} emails
                      </div>
                      <div style={{ fontSize: '10px', color: 'white', opacity: 0.9 }}>
                        {dayActivity?.leadsBooked} booked
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Side Panel - Day Details */}
        {selectedDay && (
          <div style={{ background: 'white', border: '2px solid #333333', borderRadius: 0, padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#333333' }}>
              {new Date(selectedDay.date).toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>

            {/* Statistics */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: '#f0f9ff', border: '2px solid #0284c7', borderRadius: 0, padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600 }}>EMAILS SENT</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#0284c7' }}>{selectedDay.emailsSent}</div>
              </div>
              <div style={{ background: '#f0fdf4', border: '2px solid #10b981', borderRadius: 0, padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>LEADS BOOKED</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#10b981' }}>{selectedDay.leadsBooked}</div>
              </div>
              <div style={{ background: '#fefce8', border: '2px solid #eab308', borderRadius: 0, padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600 }}>MEETINGS</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#b45309' }}>{selectedDay.meetingsScheduled}</div>
              </div>
              <div style={{ background: '#fef2f2', border: '2px solid #ef4444', borderRadius: 0, padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>CONVERSIONS</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626' }}>{selectedDay.conversionsMade}</div>
              </div>
            </div>

            {/* Activity List */}
            {selectedDay.leads.length > 0 ? (
              <>
                <h4 style={{ margin: '16px 0 12px 0', fontSize: '13px', fontWeight: 700, color: '#333333' }}>
                  Activity Details
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                  {selectedDay.leads.map((lead, idx) => (
                    <div key={idx} style={{ background: '#f9f9f9', border: '1px solid #e5e5e5', borderRadius: 0, padding: '10px', fontSize: '12px' }}>
                      <div style={{ fontWeight: 600, color: '#333333', marginBottom: '4px' }}>
                        {lead.action === 'email_sent' && '📧 '}
                        {lead.action === 'booked' && '✓ '}
                        {lead.action === 'meeting' && '📅 '}
                        {lead.action === 'converted' && '🎉 '}
                        {lead.name}
                      </div>
                      <div style={{ color: '#666', fontSize: '11px', marginBottom: '2px' }}>
                        {lead.email}
                      </div>
                      <div style={{ color: '#999', fontSize: '10px' }}>
                        {lead.action === 'email_sent' && 'Email sent'}
                        {lead.action === 'booked' && 'Lead booked'}
                        {lead.action === 'meeting' && 'Meeting scheduled'}
                        {lead.action === 'converted' && 'Conversion made'}
                        {' • '} {lead.time}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ color: '#999', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>
                No activity on this day
              </div>
            )}
          </div>
        )}
      </div>

      {/* Monthly Summary */}
      <div style={{ marginTop: '32px', background: 'white', border: '2px solid #333333', borderRadius: 0, padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#333333' }}>
          📊 {monthName} Summary
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <div style={{ background: '#f0f9ff', border: '2px solid #0284c7', borderRadius: 0, padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#0284c7', fontWeight: 600, marginBottom: '8px' }}>TOTAL EMAILS</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0284c7' }}>
              {Object.values(activityData).reduce((sum, day) => sum + day.emailsSent, 0)}
            </div>
          </div>
          <div style={{ background: '#f0fdf4', border: '2px solid #10b981', borderRadius: 0, padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 600, marginBottom: '8px' }}>LEADS BOOKED</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#10b981' }}>
              {Object.values(activityData).reduce((sum, day) => sum + day.leadsBooked, 0)}
            </div>
          </div>
          <div style={{ background: '#fefce8', border: '2px solid #eab308', borderRadius: 0, padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#b45309', fontWeight: 600, marginBottom: '8px' }}>MEETINGS</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#b45309' }}>
              {Object.values(activityData).reduce((sum, day) => sum + day.meetingsScheduled, 0)}
            </div>
          </div>
          <div style={{ background: '#fef2f2', border: '2px solid #ef4444', borderRadius: 0, padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600, marginBottom: '8px' }}>CONVERSIONS</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#dc2626' }}>
              {Object.values(activityData).reduce((sum, day) => sum + day.conversionsMade, 0)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
