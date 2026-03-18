import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { FileText, List, PlusCircle } from 'lucide-react';
import SequencesList from './SequencesList';
import SequenceBuilder from './SequenceBuilder';
import EmailTemplateEditor from './EmailTemplateEditor';
import './email.css';

export default function EmailPage() {
  const location = useLocation();
  const [sequences, setSequences] = useState([]);
  const [templates, setTemplates] = useState([]);

  // Determine active tab based on URL path
  const getActiveTabFromPath = () => {
    if (location.pathname.includes('/templates')) return 'templates';
    if (location.pathname.includes('/sequences')) return 'sequences';
    if (location.pathname.includes('/new')) return 'builder';
    return 'templates'; // default
  };

  const [activeTab, setActiveTab] = useState(getActiveTabFromPath());

  useEffect(() => {
    setActiveTab(getActiveTabFromPath());
  }, [location.pathname]);

  const tabs = [
    { id: 'templates', label: 'Email Templates', icon: FileText },
    { id: 'sequences', label: 'Sequences', icon: List },
    { id: 'builder', label: 'New Sequence', icon: PlusCircle },
  ];

  return (
    <div className="email-page">
      {/* Header */}
      <div className="email-header">
        <div>
          <h1 className="email-title">Email Marketing</h1>
          <p className="email-subtitle">
            Create and manage email sequences, templates, and track performance
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="email-tabs">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`email-tab ${activeTab === id ? 'active' : ''}`}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="email-content">
        {activeTab === 'templates' && (
          <EmailTemplateEditor templates={templates} setTemplates={setTemplates} />
        )}
        {activeTab === 'sequences' && (
          <SequencesList sequences={sequences} setSequences={setSequences} />
        )}
        {activeTab === 'builder' && (
          <SequenceBuilder onSave={() => setActiveTab('sequences')} />
        )}
      </div>
    </div>
  );
}
