import React, { useState } from 'react';
import { Trash2, Edit2, Search, Plus, X, Upload, LayoutGrid, List, Filter } from 'lucide-react';

const XLSX = require('xlsx');

interface Lead {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  location: string;
  position: string;
  companyType: string; // Healthcare, Tech, Finance, etc.
  seniority: string; // C-Level, Manager, Specialist
  department: string; // Sales, IT, HR, etc.
  emailStatus: 'unverified' | 'valid' | 'bounce' | 'pending';
  stage: string;
  source: string;
  score: string;
  lastActivity: string;
}

interface ColumnMapping {
  [key: string]: string; // Maps Excel column to Lead field
}

interface Segment {
  id: string;
  name: string;
  filters: {
    companyType?: string;
    seniority?: string;
    department?: string;
    emailStatus?: string;
  };
}

const INDUSTRIES = [
  'Healthcare',
  'Technology',
  'Finance',
  'Manufacturing',
  'Real Estate',
  'Education',
  'Retail',
  'Consulting',
  'Legal',
  'Other'
];

const SENIORITY_LEVELS = [
  'C-Level (CEO/CTO/CFO)',
  'Director/VP',
  'Manager',
  'Specialist/Individual',
  'Support'
];

const DEPARTMENTS = [
  'Sales',
  'IT/Technology',
  'HR/Operations',
  'Finance',
  'Marketing',
  'Customer Success',
  'Executive',
  'Other'
];

export default function LeadsEnhanced() {
  // Core State
  const [leads, setLeads] = useState<Lead[]>([
    {
      id: 1,
      fullName: 'John Doe',
      email: 'john@techcorp.com',
      phone: '555-1234',
      companyName: 'Tech Corp',
      location: 'San Francisco, CA',
      position: 'VP of Sales',
      companyType: 'Technology',
      seniority: 'Director/VP',
      department: 'Sales',
      emailStatus: 'valid',
      stage: 'Qualified',
      source: 'Website',
      score: 'Hot',
      lastActivity: '2 days ago',
    }
  ]);

  // UI State
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [showSegmentBuilder, setShowSegmentBuilder] = useState(false);
  
  // Edit/Add State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Lead | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newLeadData, setNewLeadData] = useState<Partial<Lead>>({});

  // Excel Import State
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [mappingTemplates, setMappingTemplates] = useState<{ name: string; mapping: ColumnMapping }[]>([]);

  // Filters State
  const [activeFilters, setActiveFilters] = useState({
    companyType: '',
    seniority: '',
    department: '',
    emailStatus: ''
  });

  // Segments
  const [segments, setSegments] = useState<Segment[]>([]);
  const [newSegmentName, setNewSegmentName] = useState('');

  const stages = ['New', 'Contacted', 'Qualified', 'Negotiation', 'Won', 'Lost'];

  const stageColors: { [key: string]: string } = {
    New: '#94a3b8',
    Contacted: '#3b82f6',
    Qualified: '#8b5cf6',
    Negotiation: '#f59e0b',
    Won: '#10b981',
    Lost: '#ef4444'
  };

  // Filter leads based on search and active filters
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.companyName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilters =
      (!activeFilters.companyType || lead.companyType === activeFilters.companyType) &&
      (!activeFilters.seniority || lead.seniority === activeFilters.seniority) &&
      (!activeFilters.department || lead.department === activeFilters.department) &&
      (!activeFilters.emailStatus || lead.emailStatus === activeFilters.emailStatus);

    return matchesSearch && matchesFilters;
  });

  // Handle Excel Upload with Column Mapping
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        setExcelData(jsonData);
        setShowColumnMapper(true);

        // Auto-detect columns
        if (jsonData.length > 0) {
          const firstRow = jsonData[0];
          const autoMapping: ColumnMapping = {};
          const excelColumns = Object.keys(firstRow);

          const fieldMappings: { [key: string]: string[] } = {
            fullName: ['name', 'fullname', 'full name', 'contact name'],
            email: ['email', 'email address'],
            phone: ['phone', 'phone number'],
            companyName: ['company', 'company name', 'organization'],
            location: ['location', 'city', 'address'],
            position: ['position', 'title', 'job title'],
            companyType: ['industry', 'company type', 'sector'],
            seniority: ['seniority', 'level', 'rank'],
            department: ['department', 'dept']
          };

          excelColumns.forEach(col => {
            const lowerCol = col.toLowerCase();
            for (const [field, aliases] of Object.entries(fieldMappings)) {
              if (aliases.some(alias => lowerCol.includes(alias))) {
                autoMapping[col] = field;
                break;
              }
            }
          });

          setColumnMapping(autoMapping);
        }
      } catch (error) {
        alert('Error reading file');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Save column mapping template
  const saveColumnTemplate = () => {
    const name = prompt('Save this mapping as:');
    if (name) {
      setMappingTemplates([...mappingTemplates, { name, mapping: columnMapping }]);
    }
  };

  // Confirm column mapping and import
  const confirmImport = () => {
    if (Object.keys(columnMapping).length === 0) {
      alert('Please map at least one column');
      return;
    }

    const importedLeads = excelData.map((row: any, index: number) => {
      const newId = Math.max(...leads.map(l => l.id), 0) + index + 1;
      const mappedLead: Lead = {
        id: newId,
        fullName: row[Object.keys(columnMapping).find(k => columnMapping[k] === 'fullName')] || '',
        email: row[Object.keys(columnMapping).find(k => columnMapping[k] === 'email')] || '',
        phone: row[Object.keys(columnMapping).find(k => columnMapping[k] === 'phone')] || '',
        companyName: row[Object.keys(columnMapping).find(k => columnMapping[k] === 'companyName')] || '',
        location: row[Object.keys(columnMapping).find(k => columnMapping[k] === 'location')] || '',
        position: row[Object.keys(columnMapping).find(k => columnMapping[k] === 'position')] || '',
        companyType: row[Object.keys(columnMapping).find(k => columnMapping[k] === 'companyType')] || 'Other',
        seniority: row[Object.keys(columnMapping).find(k => columnMapping[k] === 'seniority')] || 'Specialist/Individual',
        department: row[Object.keys(columnMapping).find(k => columnMapping[k] === 'department')] || 'Other',
        emailStatus: 'pending',
        stage: 'New',
        source: 'Imported',
        score: 'Cold',
        lastActivity: 'Just imported'
      };
      return mappedLead;
    });

    setLeads([...leads, ...importedLeads]);
    setShowColumnMapper(false);
    setExcelData([]);
    setColumnMapping({});
    alert(`Imported ${importedLeads.length} leads successfully!`);
  };

  // Save current filters as segment
  const saveAsSegment = () => {
    const name = newSegmentName || `Segment ${segments.length + 1}`;
    const newSegment: Segment = {
      id: `segment-${Date.now()}`,
      name,
      filters: activeFilters
    };
    setSegments([...segments, newSegment]);
    setNewSegmentName('');
  };

  // Apply saved segment
  const applySegment = (segment: Segment) => {
    setSelectedSegment(segment.id);
    setActiveFilters({
      companyType: segment.filters.companyType || '',
      seniority: segment.filters.seniority || '',
      department: segment.filters.department || '',
      emailStatus: segment.filters.emailStatus || ''
    });
  };

  // Get available columns from Excel preview
  const getExcelColumns = () => {
    if (excelData.length === 0) return [];
    return Object.keys(excelData[0]);
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
                fontSize: '13px',
                fontWeight: 600
              }}
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
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              <List size={16} />
            </button>
          </div>
          <button
            onClick={() => setShowColumnMapper(true)}
            style={{
              background: 'white',
              color: '#333333',
              border: '2px solid #333333',
              borderRadius: 0,
              padding: '12px 20px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px'
            }}
          >
            <Upload size={18} /> Import Excel
          </button>
          <button
            onClick={handleAddClick}
            style={{
              background: '#333333',
              color: 'white',
              border: '2px solid #333333',
              borderRadius: 0,
              padding: '12px 20px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px'
            }}
          >
            <Plus size={18} /> Add Lead
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      <div style={{ marginBottom: '24px', background: '#f9f9f9', border: '2px solid #333333', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <Filter size={18} style={{ fontWeight: 600 }} />
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Smart Segmentation</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#666', display: 'block', marginBottom: '4px' }}>
              Company Type
            </label>
            <select
              value={activeFilters.companyType}
              onChange={(e) => setActiveFilters({ ...activeFilters, companyType: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                border: '2px solid #333333',
                borderRadius: 0,
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            >
              <option value="">All Industries</option>
              {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#666', display: 'block', marginBottom: '4px' }}>
              Seniority
            </label>
            <select
              value={activeFilters.seniority}
              onChange={(e) => setActiveFilters({ ...activeFilters, seniority: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                border: '2px solid #333333',
                borderRadius: 0,
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            >
              <option value="">All Levels</option>
              {SENIORITY_LEVELS.map(sen => <option key={sen} value={sen}>{sen}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#666', display: 'block', marginBottom: '4px' }}>
              Department
            </label>
            <select
              value={activeFilters.department}
              onChange={(e) => setActiveFilters({ ...activeFilters, department: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                border: '2px solid #333333',
                borderRadius: 0,
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            >
              <option value="">All Departments</option>
              {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#666', display: 'block', marginBottom: '4px' }}>
              Email Status
            </label>
            <select
              value={activeFilters.emailStatus}
              onChange={(e) => setActiveFilters({ ...activeFilters, emailStatus: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                border: '2px solid #333333',
                borderRadius: 0,
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            >
              <option value="">All Statuses</option>
              <option value="valid">Valid</option>
              <option value="pending">Pending</option>
              <option value="bounce">Bounce</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={saveAsSegment}
            style={{
              background: '#333333',
              color: 'white',
              border: '2px solid #333333',
              borderRadius: 0,
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Save as Segment
          </button>
          {segments.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {segments.map(seg => (
                <button
                  key={seg.id}
                  onClick={() => applySegment(seg)}
                  style={{
                    background: selectedSegment === seg.id ? '#10b981' : 'white',
                    color: selectedSegment === seg.id ? 'white' : '#333333',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    padding: '6px 12px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  {seg.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results Info */}
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
          Showing {filteredLeads.length} of {leads.length} leads
          {selectedSegment && ` • Using segment`}
        </div>
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

      {/* Leads Display */}
      {viewMode === 'kanban' ? (
        <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px' }}>
          {stages.map((stage) => (
            <div key={stage} style={{ flex: '0 0 320px', background: '#f9f9f9', border: '2px solid #333333', borderRadius: 0 }}>
              <div style={{ background: stageColors[stage] || '#333333', color: 'white', padding: '16px', fontWeight: 600, fontSize: '14px' }}>
                {stage} ({filteredLeads.filter(l => l.stage === stage).length})
              </div>
              <div style={{ padding: '12px', minHeight: '500px' }}>
                {filteredLeads.filter(l => l.stage === stage).map((lead) => (
                  <div
                    key={lead.id}
                    style={{
                      background: 'white',
                      border: '2px solid #333333',
                      borderRadius: 0,
                      padding: '12px',
                      marginBottom: '8px'
                    }}
                  >
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 600 }}>{lead.fullName}</h4>
                    <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#666' }}>{lead.companyName}</p>
                    <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#999' }}>{lead.email}</p>
                    <div style={{ display: 'flex', gap: '4px', fontSize: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span style={{ background: '#e5e5e5', padding: '2px 6px' }}>{lead.seniority}</span>
                      <span style={{ background: '#e5e5e5', padding: '2px 6px' }}>{lead.department}</span>
                      <span style={{ background: lead.emailStatus === 'valid' ? '#d1fae5' : '#fee2e2', padding: '2px 6px', color: lead.emailStatus === 'valid' ? '#065f46' : '#7f1d1d' }}>
                        {lead.emailStatus}
                      </span>
                    </div>
                    <button
                      onClick={() => handleEdit(lead)}
                      style={{
                        width: '100%',
                        background: 'white',
                        color: '#333333',
                        border: '2px solid #333333',
                        borderRadius: 0,
                        padding: '4px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: 'white', border: '2px solid #333333', borderRadius: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #333333' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Name</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Company</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Position</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Industry</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Seniority</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Email Status</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id} style={{ borderBottom: '1px solid #e5e5e5' }}>
                  <td style={{ padding: '12px', fontWeight: 500 }}>{lead.fullName}</td>
                  <td style={{ padding: '12px', color: '#666' }}>{lead.companyName}</td>
                  <td style={{ padding: '12px', color: '#666' }}>{lead.position}</td>
                  <td style={{ padding: '12px', color: '#666' }}>{lead.companyType}</td>
                  <td style={{ padding: '12px', color: '#666' }}>{lead.seniority}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      background: lead.emailStatus === 'valid' ? '#d1fae5' : lead.emailStatus === 'pending' ? '#fef3c7' : '#fee2e2',
                      color: lead.emailStatus === 'valid' ? '#065f46' : lead.emailStatus === 'pending' ? '#92400e' : '#7f1d1d',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 600
                    }}>
                      {lead.emailStatus}
                    </span>
                  </td>
                  <td style={{ padding: '12px', display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleEdit(lead)}
                      style={{
                        background: 'white',
                        border: '2px solid #333333',
                        borderRadius: 0,
                        padding: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => setLeads(leads.filter(l => l.id !== lead.id))}
                      style={{
                        background: 'white',
                        border: '2px solid #333333',
                        borderRadius: 0,
                        padding: '4px',
                        cursor: 'pointer',
                        color: '#dc2626'
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Column Mapper Modal */}
      {showColumnMapper && (
        <ColumnMapperModal
          excelData={excelData}
          columnMapping={columnMapping}
          setColumnMapping={setColumnMapping}
          onConfirm={confirmImport}
          onCancel={() => {
            setShowColumnMapper(false);
            setExcelData([]);
            setColumnMapping({});
          }}
          mappingTemplates={mappingTemplates}
          onSaveTemplate={saveColumnTemplate}
        />
      )}

      {/* Edit Modal */}
      {editingId && editData && (
        <EditLeadModal
          lead={editData}
          setLead={setEditData}
          onSave={() => {
            setLeads(leads.map(l => l.id === editingId ? editData : l));
            setEditingId(null);
          }}
          onCancel={() => {
            setEditingId(null);
            setEditData(null);
          }}
        />
      )}

      {/* Add Lead Modal */}
      {isAdding && (
        <AddLeadModal
          lead={newLeadData as Lead}
          setLead={setNewLeadData}
          onSave={() => {
            const newId = Math.max(...leads.map(l => l.id), 0) + 1;
            setLeads([...leads, { id: newId, ...newLeadData } as Lead]);
            setIsAdding(false);
            setNewLeadData({});
          }}
          onCancel={() => {
            setIsAdding(false);
            setNewLeadData({});
          }}
        />
      )}
    </div>
  );

  function handleAddClick() {
    setIsAdding(true);
    setNewLeadData({
      fullName: '',
      email: '',
      phone: '',
      companyName: '',
      location: '',
      position: '',
      companyType: 'Other',
      seniority: 'Specialist/Individual',
      department: 'Other',
      emailStatus: 'pending'
    });
  }

  function handleEdit(lead: Lead) {
    setEditingId(lead.id);
    setEditData(lead);
  }
}

// Column Mapper Modal Component
function ColumnMapperModal({
  excelData,
  columnMapping,
  setColumnMapping,
  onConfirm,
  onCancel,
  mappingTemplates,
  onSaveTemplate
}: any) {
  const excelColumns = excelData.length > 0 ? Object.keys(excelData[0]) : [];
  const targetFields = [
    'fullName',
    'email',
    'phone',
    'companyName',
    'location',
    'position',
    'companyType',
    'seniority',
    'department'
  ];

  return (
    <div
      style={{
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
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'white',
          border: '2px solid #333333',
          borderRadius: 0,
          padding: '32px',
          maxWidth: '700px',
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Map Excel Columns</h2>
          <button
            onClick={onCancel}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px' }}
          >
            <X size={20} />
          </button>
        </div>

        {mappingTemplates.length > 0 && (
          <div style={{ marginBottom: '16px', padding: '12px', background: '#f9f9f9', border: '2px solid #333333' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 600 }}>Quick Apply Template:</p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {mappingTemplates.map((template: any) => (
                <button
                  key={template.name}
                  onClick={() => setColumnMapping(template.mapping)}
                  style={{
                    background: 'white',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    padding: '6px 12px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          {targetFields.map((field) => (
            <div key={field}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#333' }}>
                {field}
              </label>
              <select
                value={columnMapping[field] ? Object.entries(columnMapping).find(([v]) => v === field)?.[0] || '' : ''}
                onChange={(e) => {
                  const newMapping = { ...columnMapping };
                  Object.entries(columnMapping).forEach(([excelCol, targetField]) => {
                    if (targetField === field) delete newMapping[excelCol];
                  });
                  if (e.target.value) {
                    newMapping[e.target.value] = field;
                  }
                  setColumnMapping(newMapping);
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '2px solid #333333',
                  borderRadius: 0,
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">-- Skip this field --</option>
                {excelColumns.map((col: string) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: '24px', fontSize: '12px', color: '#666' }}>
          <strong>Preview:</strong> {excelData.length} rows found
          {excelData.length > 0 && (
            <div style={{ marginTop: '8px', padding: '12px', background: '#f9f9f9', border: '1px solid #ddd', maxHeight: '150px', overflowY: 'auto', fontSize: '11px' }}>
              {JSON.stringify(excelData[0], null, 2)}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onConfirm}
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
            Confirm & Import ({excelData.length} leads)
          </button>
          <button
            onClick={onSaveTemplate}
            style={{
              background: 'white',
              color: '#333333',
              border: '2px solid #333333',
              borderRadius: 0,
              padding: '12px 20px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Save Template
          </button>
          <button
            onClick={onCancel}
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
  );
}

// Edit Lead Modal
function EditLeadModal({ lead, setLead, onSave, onCancel }: any) {
  return (
    <div
      style={{
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
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'white',
          border: '2px solid #333333',
          borderRadius: 0,
          padding: '32px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: 700 }}>Edit Lead</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {['fullName', 'email', 'phone', 'companyName', 'location', 'position'].map((field) => (
            <div key={field}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#333' }}>
                {field.replace(/([A-Z])/g, ' $1').toUpperCase().trim()}
              </label>
              <input
                type="text"
                value={(lead as any)[field] || ''}
                onChange={(e) => setLead({ ...lead, [field]: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #333333',
                  borderRadius: 0,
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          ))}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#333' }}>
              Industry
            </label>
            <select
              value={lead.companyType}
              onChange={(e) => setLead({ ...lead, companyType: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                border: '2px solid #333333',
                borderRadius: 0,
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            >
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#333' }}>
              Seniority
            </label>
            <select
              value={lead.seniority}
              onChange={(e) => setLead({ ...lead, seniority: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                border: '2px solid #333333',
                borderRadius: 0,
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            >
              {SENIORITY_LEVELS.map((sen) => (
                <option key={sen} value={sen}>{sen}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#333' }}>
              Department
            </label>
            <select
              value={lead.department}
              onChange={(e) => setLead({ ...lead, department: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                border: '2px solid #333333',
                borderRadius: 0,
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button
              onClick={onSave}
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
              Save
            </button>
            <button
              onClick={onCancel}
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
  );
}

// Add Lead Modal
function AddLeadModal({ lead, setLead, onSave, onCancel }: any) {
  return (
    <div
      style={{
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
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'white',
          border: '2px solid #333333',
          borderRadius: 0,
          padding: '32px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: 700 }}>Add New Lead</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {['fullName', 'email', 'phone', 'companyName', 'location', 'position'].map((field) => (
            <div key={field}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#333' }}>
                {field.replace(/([A-Z])/g, ' $1').toUpperCase().trim()}
              </label>
              <input
                type="text"
                value={(lead as any)[field] || ''}
                onChange={(e) => setLead({ ...lead, [field]: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #333333',
                  borderRadius: 0,
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          ))}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#333' }}>
              Industry
            </label>
            <select
              value={lead.companyType || ''}
              onChange={(e) => setLead({ ...lead, companyType: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                border: '2px solid #333333',
                borderRadius: 0,
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            >
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#333' }}>
              Seniority
            </label>
            <select
              value={lead.seniority || ''}
              onChange={(e) => setLead({ ...lead, seniority: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                border: '2px solid #333333',
                borderRadius: 0,
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            >
              {SENIORITY_LEVELS.map((sen) => (
                <option key={sen} value={sen}>{sen}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#333' }}>
              Department
            </label>
            <select
              value={lead.department || ''}
              onChange={(e) => setLead({ ...lead, department: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                border: '2px solid #333333',
                borderRadius: 0,
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button
              onClick={onSave}
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
              onClick={onCancel}
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
  );
}
