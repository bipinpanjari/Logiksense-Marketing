import React, { useState } from 'react';
import { Trash2, Edit2, Search, Plus, X, Upload, LayoutGrid, List } from 'lucide-react';

// Import XLSX library - using dynamic import for better compatibility
const XLSX = require('xlsx');

export default function Leads() {
  const [leads, setLeads] = useState([
    { id: 1, name: 'John Doe', email: 'john@example.com', phone: '555-1234', company: 'Tech Corp', title: 'Manager', stage: 'Qualified', source: 'Website', score: 'Hot', lastActivity: '2 days ago' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', phone: '555-5678', company: 'Design Inc', title: 'Director', stage: 'Negotiation', source: 'Referral', score: 'Hot', lastActivity: '1 day ago' },
    { id: 3, name: 'Mike Johnson', email: 'mike@example.com', phone: '555-9012', company: 'Marketing Pro', title: 'Owner', stage: 'Contacted', source: 'Email', score: 'Warm', lastActivity: '3 days ago' },
    { id: 4, name: 'Sarah Williams', email: 'sarah@example.com', phone: '555-3456', company: 'Sales Team', title: 'VP Sales', stage: 'New', source: 'Event', score: 'Cold', lastActivity: 'Never' },
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState('All');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('kanban');
  const [draggedLead, setDraggedLead] = useState<any>(null);
  const [newLeadData, setNewLeadData] = useState<any>({
    name: '',
    email: '',
    phone: '',
    company: '',
    title: '',
    stage: 'New',
    source: 'Website',
    score: 'Cold'
  });

  const stages = ['New', 'Contacted', 'Qualified', 'Negotiation', 'Won', 'Lost'];
  const sources = ['Website', 'Email', 'Referral', 'Social Media', 'Event', 'Other'];
  const scores = ['Cold', 'Warm', 'Hot'];

  const stageColors: { [key: string]: string } = {
    New: '#94a3b8',
    Contacted: '#3b82f6',
    Qualified: '#8b5cf6',
    Negotiation: '#f59e0b',
    Won: '#10b981',
    Lost: '#ef4444'
  };

  const getStageCount = (stage: string) => {
    if (stage === 'All') return leads.length;
    return leads.filter(l => l.stage === stage).length;
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.company.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = filterStage === 'All' || lead.stage === filterStage;
    return matchesSearch && matchesStage;
  });

  const handleEdit = (lead: any) => {
    setEditingId(lead.id);
    setEditData({ ...lead });
  };

  const handleSave = () => {
    setLeads(leads.map(l => l.id === editingId ? editData : l));
    setEditingId(null);
    setEditData(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData(null);
  };

  const handleAddClick = () => {
    setIsAdding(true);
    setNewLeadData({
      name: '',
      email: '',
      phone: '',
      company: '',
      title: '',
      stage: 'New',
      source: 'Website',
      score: 'Cold'
    });
  };

  const handleAddSave = () => {
    const newId = Math.max(...leads.map(l => Number(l.id)), 0) + 1;
    setLeads([...leads, { id: newId, ...newLeadData, lastActivity: 'Just now' }]);
    setIsAdding(false);
    setNewLeadData({});
  };

  const handleAddCancel = () => {
    setIsAdding(false);
    setNewLeadData({});
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Map Excel columns to lead fields
        const importedLeads = jsonData.map((row: any, index: number) => {
          const newId = Math.max(...leads.map(l => Number(l.id)), 0) + index + 1;
          return {
            id: newId,
            name: row['Name'] || row['name'] || row['Name'] || '',
            email: row['Email'] || row['email'] || '',
            phone: row['Phone'] || row['phone'] || row['Phone Number'] || '',
            company: row['Company'] || row['company'] || '',
            title: row['Title'] || row['title'] || row['Job Title'] || '',
            stage: ['New', 'Contacted', 'Qualified', 'Negotiation', 'Won', 'Lost'].includes(row['Stage'] || row['stage']) ? (row['Stage'] || row['stage']) : 'New',
            source: ['Website', 'Email', 'Referral', 'Social Media', 'Event', 'Other'].includes(row['Source'] || row['source']) ? (row['Source'] || row['source']) : 'Other',
            score: ['Cold', 'Warm', 'Hot'].includes(row['Score'] || row['score']) ? (row['Score'] || row['score']) : 'Cold',
            lastActivity: 'Just imported'
          };
        });

        setLeads([...leads, ...importedLeads]);
        setImportMessage(`Successfully imported ${importedLeads.length} lead(s)!`);
        setTimeout(() => setImportMessage(''), 3000);
        setIsImporting(false);
      } catch (error) {
        setImportMessage('Error importing file. Please check the format.');
        setTimeout(() => setImportMessage(''), 3000);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDragStart = (e: React.DragEvent, lead: any) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(lead.id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnStage = (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    if (draggedLead) {
      setLeads(leads.map(lead => 
        lead.id === draggedLead.id ? { ...lead, stage: targetStage } : lead
      ));
      setDraggedLead(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedLead(null);
  };

  return (
    <div style={{ padding: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#333333', margin: 0 }}>Leads CRM</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '6px', background: '#f5f5f5', border: '2px solid #333333', borderRadius: 0, padding: '4px' }}>
            <button
              onClick={() => setViewMode('kanban')}
              style={{
                background: viewMode === 'kanban' ? '#333333' : 'transparent',
                color: viewMode === 'kanban' ? 'white' : '#333333',
                border: 'none',
                borderRadius: 0,
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 600,
                fontSize: '13px'
              }}
              title="Kanban View"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                background: viewMode === 'table' ? '#333333' : 'transparent',
                color: viewMode === 'table' ? 'white' : '#333333',
                border: 'none',
                borderRadius: 0,
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 600,
                fontSize: '13px'
              }}
              title="Table View"
            >
              <List size={16} />
            </button>
          </div>
          <button onClick={() => setIsImporting(true)} style={{
            background: 'white',
            color: '#333333',
            border: '2px solid #333333',
            borderRadius: 0,
            padding: '12px 20px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Upload size={18} /> Import Excel
          </button>
          <button onClick={handleAddClick} style={{
            background: '#333333',
            color: 'white',
            border: '2px solid #333333',
            borderRadius: 0,
            padding: '12px 20px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Plus size={18} /> Add Lead
          </button>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        // Kanban Board View
        <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px', marginBottom: '24px' }}>
          {stages.map((stage) => (
            <div key={stage} style={{ flex: '0 0 320px', background: '#f9f9f9', border: '2px solid #333333', borderRadius: 0 }}>
              <div style={{ background: stageColors[stage] || '#333333', color: 'white', padding: '16px', fontWeight: 600, fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{stage}</span>
                <span style={{ background: 'rgba(255,255,255,0.3)', padding: '4px 8px', borderRadius: '3px', fontSize: '12px' }}>
                  {leads.filter(l => l.stage === stage).length}
                </span>
              </div>
              <div
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnStage(e, stage)}
                style={{
                  padding: '12px',
                  minHeight: '500px',
                  background: draggedLead ? '#f0f0f0' : '#f9f9f9',
                  transition: 'background-color 0.2s'
                }}
              >
                {leads
                  .filter(lead => lead.stage === stage)
                  .map((lead, index) => (
                    <div
                      key={`lead-${lead.id}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead)}
                      onDragEnd={handleDragEnd}
                      style={{
                        background: 'white',
                        border: '2px solid #333333',
                        borderRadius: 0,
                        padding: '14px',
                        marginBottom: '10px',
                        cursor: draggedLead?.id === lead.id ? 'grabbing' : 'grab',
                        opacity: draggedLead?.id === lead.id ? 0.5 : 1,
                        boxShadow: draggedLead?.id === lead.id ? '0 8px 16px rgba(0,0,0,0.15)' : 'none',
                        transform: draggedLead?.id === lead.id ? 'scale(0.95)' : 'scale(1)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#333333', flex: 1 }}>
                          {lead.name}
                        </h3>
                        <button
                          onClick={() => setLeads(leads.filter(l => l.id !== lead.id))}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#dc2626',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#666' }}>
                        {lead.company}
                      </p>
                      <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#999' }}>
                        {lead.email}
                      </p>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{
                          background: lead.score === 'Hot' ? '#ef4444' : lead.score === 'Warm' ? '#f59e0b' : '#94a3b8',
                          color: 'white',
                          padding: '4px 8px',
                          fontSize: '10px',
                          fontWeight: 600
                        }}>
                          {lead.score}
                        </span>
                        <span style={{
                          background: '#e5e5e5',
                          color: '#666',
                          padding: '4px 8px',
                          fontSize: '10px',
                          fontWeight: 600
                        }}>
                          {lead.source}
                        </span>
                      </div>
                      <button
                        onClick={() => handleEdit(lead)}
                        style={{
                          marginTop: '10px',
                          width: '100%',
                          background: 'white',
                          color: '#333333',
                          border: '2px solid #333333',
                          borderRadius: 0,
                          padding: '6px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '11px'
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                {leads.filter(l => l.stage === stage).length === 0 && (
                  <div style={{ textAlign: 'center', color: '#999', padding: '32px 16px', fontSize: '13px' }}>
                    No leads yet
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Table View
        <>
          {/* Stage Filters */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {['All', ...stages].map((stage) => (
              <button
                key={stage}
                onClick={() => setFilterStage(stage)}
                style={{
                  background: filterStage === stage ? '#333333' : 'white',
                  color: filterStage === stage ? 'white' : '#333333',
                  border: '2px solid #333333',
                  borderRadius: 0,
                  padding: '8px 16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                {stage} <span style={{ marginLeft: '6px', opacity: 0.7 }}>({getStageCount(stage)})</span>
              </button>
            ))}
          </div>

      {/* Search Box */}
      <div style={{
        background: 'white',
        border: '2px solid #333333',
        borderRadius: 0,
        padding: '16px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <Search size={20} style={{ color: '#333333', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search by name, email, or company..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            border: 'none',
            outline: 'none',
            width: '100%',
            fontSize: '14px',
            padding: '8px 0'
          }}
        />
      </div>

      {/* Table */}
      <div style={{
        background: 'white',
        border: '2px solid #333333',
        borderRadius: 0,
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #333333' }}>
              <th style={{ padding: '14px', textAlign: 'left', fontWeight: 600, color: '#333333', fontSize: '12px' }}>Name</th>
              <th style={{ padding: '14px', textAlign: 'left', fontWeight: 600, color: '#333333', fontSize: '12px' }}>Email</th>
              <th style={{ padding: '14px', textAlign: 'left', fontWeight: 600, color: '#333333', fontSize: '12px' }}>Company</th>
              <th style={{ padding: '14px', textAlign: 'left', fontWeight: 600, color: '#333333', fontSize: '12px' }}>Stage</th>
              <th style={{ padding: '14px', textAlign: 'left', fontWeight: 600, color: '#333333', fontSize: '12px' }}>Source</th>
              <th style={{ padding: '14px', textAlign: 'left', fontWeight: 600, color: '#333333', fontSize: '12px' }}>Score</th>
              <th style={{ padding: '14px', textAlign: 'left', fontWeight: 600, color: '#333333', fontSize: '12px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#999' }}>
                  No leads found. Try adjusting your filters.
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => (
                <tr key={lead.id} style={{ borderBottom: '1px solid #e5e5e5' }}>
                  <td style={{ padding: '14px', color: '#333333', fontWeight: 500 }}>{lead.name}</td>
                  <td style={{ padding: '14px', color: '#666', fontSize: '13px' }}>{lead.email}</td>
                  <td style={{ padding: '14px', color: '#666', fontSize: '13px' }}>{lead.company}</td>
                  <td style={{ padding: '14px' }}>
                    <span style={{
                      background: stageColors[lead.stage] || '#999',
                      color: 'white',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      display: 'inline-block'
                    }}>
                      {lead.stage}
                    </span>
                  </td>
                  <td style={{ padding: '14px', fontSize: '13px', color: '#666' }}>{lead.source}</td>
                  <td style={{ padding: '14px' }}>
                    <span style={{
                      background: lead.score === 'Hot' ? '#ef4444' : lead.score === 'Warm' ? '#f59e0b' : '#94a3b8',
                      color: 'white',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      display: 'inline-block'
                    }}>
                      {lead.score}
                    </span>
                  </td>
                  <td style={{ padding: '14px', display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleEdit(lead)}
                      style={{
                        background: 'white',
                        border: '2px solid #333333',
                        borderRadius: 0,
                        padding: '6px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setLeads(leads.filter(l => l.id !== lead.id))}
                      style={{
                        background: 'white',
                        border: '2px solid #333333',
                        borderRadius: 0,
                        padding: '6px',
                        cursor: 'pointer',
                        color: '#dc2626'
                      }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
        </>
      )}

      {/* Edit Modal */}
      {editingId && editData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={handleCancel}>
          <div style={{
            background: 'white',
            border: '2px solid #333333',
            borderRadius: 0,
            padding: '32px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#333333' }}>Edit Lead</h2>
              <button
                onClick={handleCancel}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {['name', 'email', 'phone', 'company', 'title'].map((field) => (
                <div key={field}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333333' }}>
                    {field.charAt(0).toUpperCase() + field.slice(1)}
                  </label>
                  <input
                    type="text"
                    value={editData[field] || ''}
                    onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #333333',
                      borderRadius: 0,
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              ))}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333333' }}>
                  Stage
                </label>
                <select
                  value={editData.stage}
                  onChange={(e) => setEditData({ ...editData, stage: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  {stages.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333333' }}>
                  Source
                </label>
                <select
                  value={editData.source}
                  onChange={(e) => setEditData({ ...editData, source: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  {sources.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333333' }}>
                  Lead Score
                </label>
                <select
                  value={editData.score}
                  onChange={(e) => setEditData({ ...editData, score: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  {scores.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                  onClick={handleSave}
                  style={{
                    flex: 1,
                    background: '#333333',
                    color: 'white',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    padding: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Save Changes
                </button>
                <button
                  onClick={handleCancel}
                  style={{
                    flex: 1,
                    background: 'white',
                    color: '#333333',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    padding: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {isAdding && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={handleAddCancel}>
          <div style={{
            background: 'white',
            border: '2px solid #333333',
            borderRadius: 0,
            padding: '32px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#333333' }}>Add New Lead</h2>
              <button
                onClick={handleAddCancel}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {['name', 'email', 'phone', 'company', 'title'].map((field) => (
                <div key={field}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333333' }}>
                    {field.charAt(0).toUpperCase() + field.slice(1)}
                  </label>
                  <input
                    type="text"
                    value={newLeadData[field] || ''}
                    onChange={(e) => setNewLeadData({ ...newLeadData, [field]: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #333333',
                      borderRadius: 0,
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              ))}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333333' }}>
                  Stage
                </label>
                <select
                  value={newLeadData.stage}
                  onChange={(e) => setNewLeadData({ ...newLeadData, stage: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  {stages.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333333' }}>
                  Source
                </label>
                <select
                  value={newLeadData.source}
                  onChange={(e) => setNewLeadData({ ...newLeadData, source: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  {sources.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333333' }}>
                  Lead Score
                </label>
                <select
                  value={newLeadData.score}
                  onChange={(e) => setNewLeadData({ ...newLeadData, score: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  {scores.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                  onClick={handleAddSave}
                  style={{
                    flex: 1,
                    background: '#333333',
                    color: 'white',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    padding: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Add Lead
                </button>
                <button
                  onClick={handleAddCancel}
                  style={{
                    flex: 1,
                    background: 'white',
                    color: '#333333',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    padding: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Status Message */}
      {importMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: importMessage.includes('Error') ? '#ef4444' : '#10b981',
          color: 'white',
          padding: '16px 20px',
          borderRadius: '4px',
          zIndex: 2000,
          fontSize: '14px',
          fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          border: '2px solid ' + (importMessage.includes('Error') ? '#dc2626' : '#059669')
        }}>
          {importMessage}
        </div>
      )}

      {/* Import Excel Modal */}
      {isImporting && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setIsImporting(false)}>
          <div style={{
            background: 'white',
            border: '2px solid #333333',
            borderRadius: 0,
            padding: '32px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#333333' }}>Import Leads from Excel</h2>
              <button
                onClick={() => setIsImporting(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#f5f5f5', border: '2px dashed #ccc', borderRadius: 0, padding: '32px', textAlign: 'center' }}>
                <Upload size={32} style={{ margin: '0 auto 12px', color: '#999' }} />
                <p style={{ margin: '0 0 16px 0', color: '#666', fontSize: '14px' }}>
                  Click below or drag and drop your Excel file
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelImport}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div style={{ background: '#f9f9f9', border: '1px solid #e5e5e5', borderRadius: 0, padding: '16px', fontSize: '13px', color: '#666' }}>
                <p style={{ margin: '0 0 12px 0', fontWeight: 600, color: '#333' }}>Expected Excel Format:</p>
                <ul style={{ margin: '0', paddingLeft: '20px', color: '#666' }}>
                  <li>Name</li>
                  <li>Email</li>
                  <li>Phone</li>
                  <li>Company</li>
                  <li>Title</li>
                  <li>Stage (New, Contacted, Qualified, Negotiation, Won, Lost)</li>
                  <li>Source (Website, Email, Referral, Social Media, Event, Other)</li>
                  <li>Score (Cold, Warm, Hot)</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                  onClick={() => setIsImporting(false)}
                  style={{
                    flex: 1,
                    background: 'white',
                    color: '#333333',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    padding: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
