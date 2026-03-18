import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';

export default function SequenceBuilder({ onSave }: any) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState([]);

  const addStep = () => {
    setSteps([
      ...steps,
      {
        id: Date.now(),
        name: `Step ${steps.length + 1}`,
        delayHours: 0,
        templateId: '',
        condition: 'none',
      },
    ]);
  };

  const updateStep = (id: number, field: string, value: any) => {
    setSteps(
      steps.map((step: any) =>
        step.id === id ? { ...step, [field]: value } : step
      )
    );
  };

  const removeStep = (id: number) => {
    setSteps(steps.filter((step: any) => step.id !== id));
  };

  const handleSave = () => {
    if (!name || steps.length === 0) {
      alert('Please enter a name and add at least one step');
      return;
    }

    const newSequence = {
      id: Date.now().toString(),
      name,
      description,
      steps,
      status: 'draft',
      activeLeads: 0,
      createdAt: new Date().toISOString(),
    };

    // In a real app, this would post to the API
    console.log('New sequence:', newSequence);
    alert('Sequence created! (Local storage only - API integration needed)');
    setName('');
    setDescription('');
    setSteps([]);
    onSave?.();
  };

  return (
    <div className="email-card">
      <div className="email-card-header">
        <h3 className="email-card-title">Build a New Sequence</h3>
      </div>

      <div className="email-card-body">
        {/* Basic Info */}
        <div style={{ paddingBottom: '24px', borderBottom: '1px solid #e2e8f0', marginBottom: '24px' }}>
          <div className="form-group">
            <label className="form-label">Sequence Name *</label>
            <input
              type="text"
              placeholder="Enter sequence name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
            />
          </div>
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label">Description (optional)</label>
            <textarea
              placeholder="Describe what this sequence does..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="form-textarea"
            />
          </div>
        </div>

        {/* Steps */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 className="email-card-subtitle">Email Steps</h4>
            <button onClick={addStep} className="btn btn-primary btn-small">
              <Plus size={14} style={{ marginRight: '4px' }} /> Add Step
            </button>
          </div>

          {steps.length === 0 ? (
            <div className="empty-state" style={{ textAlign: 'center', padding: '32px 16px' }}>
              <div className="empty-state-icon">📋</div>
              <p className="empty-state-title">No Steps Yet</p>
              <p className="empty-state-text">Click "Add Step" to create your sequence flow</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {steps.map((step: any, index: number) => (
                <div key={step.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label">Step {index + 1} Name</label>
                      <input
                        type="text"
                        value={step.name}
                        onChange={(e) => updateStep(step.id, 'name', e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Delay (hours)</label>
                      <input
                        type="number"
                        min="0"
                        value={step.delayHours}
                        onChange={(e) => updateStep(step.id, 'delayHours', parseInt(e.target.value))}
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Template</label>
                      <input
                        type="text"
                        placeholder="Template ID"
                        value={step.templateId}
                        onChange={(e) => updateStep(step.id, 'templateId', e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Condition</label>
                      <select
                        value={step.condition}
                        onChange={(e) => updateStep(step.id, 'condition', e.target.value)}
                        className="form-select"
                      >
                        <option value="none">None (Always)</option>
                        <option value="opened">After Email Opened</option>
                        <option value="clicked">After Link Clicked</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => removeStep(step.id)}
                    className="btn btn-icon"
                    style={{ color: '#dc2626', marginTop: '12px' }}
                  >
                    <Trash2 size={16} /> Remove Step
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '24px', marginTop: '24px' }}>
          <button onClick={handleSave} className="btn btn-primary" style={{ flex: 1 }}>
            Create Sequence
          </button>
          <button
            onClick={() => {
              setName('');
              setDescription('');
              setSteps([]);
            }}
            className="btn btn-secondary"
            style={{ flex: 1 }}
          >
            Clear
          </button>
        </div>

        {/* Help Text */}
        <div className="alert alert-info" style={{ marginTop: '24px' }}>
          <p style={{ fontWeight: 600, marginBottom: '8px' }}>💡 Tips for Building Great Sequences:</p>
          <ul style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <li>• Start with an immediate welcome email (0 hour delay)</li>
            <li>• Space out follow-ups by 24-48 hours for best engagement</li>
            <li>• Use conditions to segment your audience based on behavior</li>
            <li>• Keep sequences to 5-7 emails for optimal results</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
