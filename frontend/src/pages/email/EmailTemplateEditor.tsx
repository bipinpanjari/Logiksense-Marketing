import React, { useState } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';

export default function EmailTemplateEditor({ templates, setTemplates }: any) {
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    subjectLine: '',
    htmlContent: '',
    textContent: '',
    category: 'general',
  });

  const handleCreate = () => {
    if (formData.name && formData.subjectLine && formData.htmlContent) {
      const newTemplate = {
        id: Date.now().toString(),
        ...formData,
        createdAt: new Date().toISOString(),
      };
      setTemplates([...templates, newTemplate]);
      setFormData({
        name: '',
        subjectLine: '',
        htmlContent: '',
        textContent: '',
        category: 'general',
      });
      setIsCreating(false);
      alert('✅ Template created successfully!');
    } else {
      alert('⚠️ Please fill in all required fields');
    }
  };

  const handleDelete = (id: string) => {
    setTemplates(templates.filter((t: any) => t.id !== id));
    if (selectedTemplate?.id === id) {
      setSelectedTemplate(null);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Template List */}
      <div className="email-card" style={{ gridColumn: 1 }}>
        <div className="email-card-header">
          <h3 className="email-card-title">Templates ({templates.length})</h3>
          <button
            onClick={() => setIsCreating(true)}
            className="btn btn-primary btn-small"
          >
            <Plus size={16} /> New
          </button>
        </div>
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {templates.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px', border: 'none' }}>
              <p style={{ color: '#94a3b8', fontSize: '14px' }}>No templates yet</p>
            </div>
          ) : (
            templates.map((template: any) => (
              <div
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid #f1f5f9',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  background: selectedTemplate?.id === template.id ? '#f0f4ff' : 'transparent',
                  marginBottom: '4px',
                  transition: 'all 0.2s ease',
                }}
              >
                <p style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b', margin: '0 0 4px 0' }}>
                  {template.name}
                </p>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                  {template.category}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="email-card" style={{ gridColumn: '2 / 4' }}>
        {isCreating || selectedTemplate ? (
          <div className="email-form">
            <div className="email-card-header">
              <h3 className="email-card-title">
                {isCreating ? 'Create New Template' : 'Edit Template'}
              </h3>
            </div>

            <div className="form-group">
              <label className="form-label">Template Name *</label>
              <input
                type="text"
                placeholder="E.g., Welcome Email"
                value={formData.name || selectedTemplate?.name || ''}
                onChange={(e) =>
                  isCreating
                    ? setFormData({ ...formData, name: e.target.value })
                    : null
                }
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Subject Line *</label>
              <input
                type="text"
                placeholder="E.g., Welcome to {{company}}!"
                value={formData.subjectLine || selectedTemplate?.subjectLine || ''}
                onChange={(e) =>
                  isCreating
                    ? setFormData({ ...formData, subjectLine: e.target.value })
                    : null
                }
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                value={formData.category || selectedTemplate?.category || ''}
                onChange={(e) =>
                  isCreating
                    ? setFormData({ ...formData, category: e.target.value })
                    : null
                }
                className="form-select"
              >
                <option value="general">General</option>
                <option value="welcome">Welcome</option>
                <option value="nurture">Nurture</option>
                <option value="promotional">Promotional</option>
                <option value="follow-up">Follow-up</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">HTML Content *</label>
              <textarea
                placeholder="Enter HTML content here..."
                value={formData.htmlContent || selectedTemplate?.htmlContent || ''}
                onChange={(e) =>
                  isCreating
                    ? setFormData({ ...formData, htmlContent: e.target.value })
                    : null
                }
                className="form-textarea"
                style={{ minHeight: '150px' }}
              />
              <small style={{ color: '#94a3b8', fontSize: '12px' }}>
                💡 Tip: Use variables like firstName or company for personalization
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">Plain Text Content (Optional)</label>
              <textarea
                placeholder="Plain text version of the email"
                value={formData.textContent || selectedTemplate?.textContent || ''}
                onChange={(e) =>
                  isCreating
                    ? setFormData({ ...formData, textContent: e.target.value })
                    : null
                }
                className="form-textarea"
                style={{ minHeight: '100px' }}
              />
            </div>

            {isCreating && (
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button onClick={handleCreate} className="btn btn-primary" style={{ flex: 1 }}>
                  Create Template
                </button>
                <button
                  onClick={() => setIsCreating(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📧</div>
            <p className="empty-state-title">No Template Selected</p>
            <p className="empty-state-text">Select a template from the list or create a new one</p>
          </div>
        )}
      </div>
    </div>
  );
}
