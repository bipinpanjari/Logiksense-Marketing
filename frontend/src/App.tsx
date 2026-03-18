import React, { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { BarChart3, Mail, Users, Settings, LogOut, Menu, X, ChevronDown, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import './App.css';
import EmailPage from './pages/email';
import Dashboard from './pages/Dashboard';
import LeadsEnhanced from './pages/LeadsEnhanced';
import EnhancedEmailCampaigns from './pages/EnhancedEmailCampaigns';
import CampaignCalendar from './pages/CampaignCalendar';
import EmailSettings from './pages/EmailSettings';
import Registration from './pages/Registration';

function App() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState({ email: false, dashboard: false, leads: false, settings: false });

  // Show full-page registration on /register route
  if (location.pathname === '/register') {
    return <Registration />;
  }

  const toggleMenu = (key: string) => {
    setExpandedMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const menuItems = [
    {
      category: 'dashboard',
      label: 'Dashboard',
      icon: BarChart3,
      path: '/dashboard'
    },
    {
      category: 'leads',
      label: 'Leads CRM',
      icon: Users,
      path: '/leads'
    },
    {
      category: 'email',
      label: 'Email Marketing',
      icon: Mail,
      hasSubmenu: true,
      submenu: [
        { label: 'Campaigns', path: '/email/campaigns' },
        { label: 'Calendar', path: '/email/calendar' },
        { label: 'Email Templates', path: '/email/templates' },
        { label: 'Sequences', path: '/email/sequences' },
        { label: 'New Sequence', path: '/email/new' },
        { label: 'Email Settings', path: '/email/settings' }
      ]
    },
    {
      category: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/settings'
    }
  ];

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        {/* Collapse Button - Right Edge */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="sidebar-collapse-btn"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? (
            <ChevronLeft size={20} />
          ) : (
            <ChevronRight size={20} />
          )}
        </button>

        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">LS</div>
            {sidebarOpen && <span className="logo-text">Logik Sense</span>}
          </div>
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="sidebar-toggle"
              title="Collapse"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isExpanded = expandedMenus[item.category];
            const isActive = item.path ? location.pathname === item.path : false;
            
            if (item.hasSubmenu) {
              return (
                <div key={item.category}>
                  <button
                    onClick={() => toggleMenu(item.category)}
                    className={`nav-item nav-item-parent ${isExpanded ? 'expanded' : ''}`}
                    title={!sidebarOpen ? item.label : ''}
                  >
                    <Icon size={22} className="nav-icon" />
                    {sidebarOpen && (
                      <>
                        <span className="nav-label">{item.label}</span>
                        <ChevronDown size={18} className={`chevron ${isExpanded ? 'rotated' : ''}`} />
                      </>
                    )}
                  </button>
                  
                  {isExpanded && sidebarOpen && (
                    <div className="submenu">
                      {item.submenu!.map((subitem) => (
                        <Link
                          key={subitem.path}
                          to={subitem.path}
                          className={`nav-item nav-subitem ${location.pathname === subitem.path ? 'active' : ''}`}
                        >
                          <span className="nav-label">{subitem.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
                title={!sidebarOpen ? item.label : ''}
              >
                <Icon size={22} className="nav-icon" />
                {sidebarOpen && <span className="nav-label">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            onClick={() => {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('user');
              window.location.href = '/login';
            }}
            className="logout-btn"
            title="Logout"
          >
            <LogOut size={22} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Top Bar */}
        <header className="top-bar">
          <div className="top-bar-content">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="menu-button"
            >
              <Menu size={24} />
            </button>
            <h1 className="page-title">Logik Sense Marketing Automation</h1>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-content">
          <Routes>
            <Route path="/email" element={<EmailPage />} />
            <Route path="/email/campaigns" element={<EnhancedEmailCampaigns />} />
            <Route path="/email/calendar" element={<CampaignCalendar />} />
            <Route path="/email/templates" element={<EmailPage />} />
            <Route path="/email/sequences" element={<EmailPage />} />
            <Route path="/email/new" element={<EmailPage />} />
            <Route path="/email/settings" element={<EmailSettings />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/leads" element={<LeadsEnhanced />} />
            <Route path="/settings" element={<EmailSettings />} />
            <Route
              path="/"
              element={
                <div className="content-placeholder">
                  <h2>Welcome to Logik Sense</h2>
                  <p>Select a module from the sidebar to get started</p>
                </div>
              }
            />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
