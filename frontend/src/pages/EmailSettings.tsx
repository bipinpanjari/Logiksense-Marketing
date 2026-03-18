import React, { useState } from 'react';
import { Settings, Mail, Check, X, AlertCircle } from 'lucide-react';

interface EmailConfig {
  senderEmail: string;
  senderName: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  emailsPerHour: number;
  dkimRecord?: string;
  spfRecord?: string;
  dkimVerified: boolean;
  spfVerified: boolean;
}

export default function EmailSettings() {
  const [config, setConfig] = useState<EmailConfig>({
    senderEmail: '',
    senderName: '',
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    emailsPerHour: 25,
    dkimVerified: false,
    spfVerified: false
  });

  const [validationStatus, setValidationStatus] = useState<{
    dkim?: 'checking' | 'valid' | 'invalid';
    spf?: 'checking' | 'valid' | 'invalid';
  }>({});

  const [saveMessage, setSaveMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'smtp' | 'validation' | 'rate'>('smtp');

  const handleInputChange = (field: keyof EmailConfig, value: any) => {
    setConfig({ ...config, [field]: value });
  };

  // Mock DKIM/SPF validation - in production, this would call backend
  const validateDKIM = async () => {
    setValidationStatus({ ...validationStatus, dkim: 'checking' });
    
    // Simulate API call
    setTimeout(() => {
      const isValid = config.dkimRecord && config.dkimRecord.length > 10;
      setValidationStatus({ ...validationStatus, dkim: isValid ? 'valid' : 'invalid' });
      setConfig({ ...config, dkimVerified: isValid });
    }, 1500);
  };

  const validateSPF = async () => {
    setValidationStatus({ ...validationStatus, spf: 'checking' });
    
    // Simulate API call
    setTimeout(() => {
      const isValid = config.spfRecord && config.spfRecord.includes('include:');
      setValidationStatus({ ...validationStatus, spf: isValid ? 'valid' : 'invalid' });
      setConfig({ ...config, spfVerified: isValid });
    }, 1500);
  };

  const handleSave = () => {
    localStorage.setItem('emailConfig', JSON.stringify(config));
    setSaveMessage('Settings saved successfully!');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const testSMTPConnection = () => {
    alert('Testing SMTP connection...\n\nIn production, this would verify:\n- Host: ' + config.smtpHost + '\n- Port: ' + config.smtpPort + '\n- Credentials validity');
  };

  return (
    <div style={{ padding: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <Settings size={28} />
        <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#333333', margin: 0 }}>Email Settings</h1>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', borderBottom: '2px solid #333333', paddingBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('smtp')}
          style={{
            background: activeTab === 'smtp' ? '#333333' : 'transparent',
            color: activeTab === 'smtp' ? 'white' : '#333333',
            border: '2px solid #333333',
            borderRadius: 0,
            padding: '12px 24px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Mail size={16} style={{ display: 'inline', marginRight: '8px' }} />
          SMTP Configuration
        </button>
        <button
          onClick={() => setActiveTab('validation')}
          style={{
            background: activeTab === 'validation' ? '#333333' : 'transparent',
            color: activeTab === 'validation' ? 'white' : '#333333',
            border: '2px solid #333333',
            borderRadius: 0,
            padding: '12px 24px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Check size={16} style={{ display: 'inline', marginRight: '8px' }} />
          DKIM/SPF Validation
        </button>
        <button
          onClick={() => setActiveTab('rate')}
          style={{
            background: activeTab === 'rate' ? '#333333' : 'transparent',
            color: activeTab === 'rate' ? 'white' : '#333333',
            border: '2px solid #333333',
            borderRadius: 0,
            padding: '12px 24px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <AlertCircle size={16} style={{ display: 'inline', marginRight: '8px' }} />
          Rate Limits
        </button>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div style={{
          background: '#d1fae5',
          border: '2px solid #10b981',
          borderRadius: 0,
          padding: '12px 16px',
          marginBottom: '24px',
          color: '#065f46',
          fontWeight: 600,
          fontSize: '13px'
        }}>
          ✓ {saveMessage}
        </div>
      )}

      {/* SMTP Configuration Tab */}
      {activeTab === 'smtp' && (
        <div style={{ maxWidth: '600px' }}>
          <div style={{ background: '#f9f9f9', border: '2px solid #333333', padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 600 }}>SMTP Server Details</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333' }}>
                  Sender Email *
                </label>
                <input
                  type="email"
                  value={config.senderEmail}
                  onChange={(e) => handleInputChange('senderEmail', e.target.value)}
                  placeholder="noreply@yourdomain.com"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333' }}>
                  Sender Name
                </label>
                <input
                  type="text"
                  value={config.senderName}
                  onChange={(e) => handleInputChange('senderName', e.target.value)}
                  placeholder="Your Company Name"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333' }}>
                  SMTP Host *
                </label>
                <input
                  type="text"
                  value={config.smtpHost}
                  onChange={(e) => handleInputChange('smtpHost', e.target.value)}
                  placeholder="smtp.gmail.com or smtp.sendgrid.net"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333' }}>
                    SMTP Port *
                  </label>
                  <input
                    type="text"
                    value={config.smtpPort}
                    onChange={(e) => handleInputChange('smtpPort', e.target.value)}
                    placeholder="587 or 465"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #333333',
                      borderRadius: 0,
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333' }}>
                  SMTP Username
                </label>
                <input
                  type="text"
                  value={config.smtpUser}
                  onChange={(e) => handleInputChange('smtpUser', e.target.value)}
                  placeholder="your-email@gmail.com"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333' }}>
                  SMTP Password
                </label>
                <input
                  type="password"
                  value={config.smtpPassword}
                  onChange={(e) => handleInputChange('smtpPassword', e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
                <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#666' }}>
                  ⚠️ For Gmail: Use <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc' }}>App Passwords</a>
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                  onClick={testSMTPConnection}
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
                  Test Connection
                </button>
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
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DKIM/SPF Validation Tab */}
      {activeTab === 'validation' && (
        <div style={{ maxWidth: '700px' }}>
          <div style={{ background: '#fff8dc', border: '2px solid #f59e0b', borderRadius: 0, padding: '16px', marginBottom: '24px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#92400e' }}>
              <strong>⚠️ Important:</strong> Proper DKIM and SPF records prevent your emails from going to spam.
            </p>
          </div>

          <div style={{ background: '#f9f9f9', border: '2px solid #333333', padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 600 }}>DKIM Record</h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#666' }}>
              Add this DKIM record to your DNS configuration:
            </p>
            <textarea
              value={config.dkimRecord || ''}
              onChange={(e) => handleInputChange('dkimRecord', e.target.value)}
              placeholder="v=DKIM1; k=rsa; p=MIGfMA0GCS..."
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #333333',
                borderRadius: 0,
                fontSize: '12px',
                fontFamily: 'monospace',
                minHeight: '100px',
                boxSizing: 'border-box',
                marginBottom: '12px'
              }}
            />
            <button
              onClick={validateDKIM}
              style={{
                background: validationStatus.dkim === 'valid' ? '#d1fae5' : validationStatus.dkim === 'invalid' ? '#fee2e2' : 'white',
                border: '2px solid #333333',
                borderRadius: 0,
                padding: '10px 16px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {validationStatus.dkim === 'checking' ? (
                <>⏳ Checking...</>
              ) : validationStatus.dkim === 'valid' ? (
                <><Check size={16} /> DKIM Valid</>
              ) : validationStatus.dkim === 'invalid' ? (
                <><X size={16} /> DKIM Invalid</>
              ) : (
                <>Check DKIM Record</>
              )}
            </button>
          </div>

          <div style={{ background: '#f9f9f9', border: '2px solid #333333', padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 600 }}>SPF Record</h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#666' }}>
              Add this SPF record to your DNS TXT records:
            </p>
            <textarea
              value={config.spfRecord || ''}
              onChange={(e) => handleInputChange('spfRecord', e.target.value)}
              placeholder="v=spf1 include:sendgrid.net ~all"
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #333333',
                borderRadius: 0,
                fontSize: '12px',
                fontFamily: 'monospace',
                minHeight: '80px',
                boxSizing: 'border-box',
                marginBottom: '12px'
              }}
            />
            <button
              onClick={validateSPF}
              style={{
                background: validationStatus.spf === 'valid' ? '#d1fae5' : validationStatus.spf === 'invalid' ? '#fee2e2' : 'white',
                border: '2px solid #333333',
                borderRadius: 0,
                padding: '10px 16px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {validationStatus.spf === 'checking' ? (
                <>⏳ Checking...</>
              ) : validationStatus.spf === 'valid' ? (
                <><Check size={16} /> SPF Valid</>
              ) : validationStatus.spf === 'invalid' ? (
                <><X size={16} /> SPF Invalid</>
              ) : (
                <>Check SPF Record</>
              )}
            </button>
          </div>

          {config.dkimVerified && config.spfVerified && (
            <div style={{
              background: '#d1fae5',
              border: '2px solid #10b981',
              borderRadius: 0,
              padding: '16px'
            }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#065f46', fontWeight: 600 }}>
                ✓ Both DKIM and SPF records are verified! Your emails are ready to send.
              </p>
            </div>
          )}

          <button
            onClick={handleSave}
            style={{
              marginTop: '24px',
              width: '100%',
              background: '#333333',
              color: 'white',
              border: '2px solid #333333',
              borderRadius: 0,
              padding: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Save DNS Records
          </button>
        </div>
      )}

      {/* Rate Limits Tab */}
      {activeTab === 'rate' && (
        <div style={{ maxWidth: '600px' }}>
          <div style={{ background: '#f9f9f9', border: '2px solid #333333', padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 600 }}>Email Send Rate</h3>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: '#333' }}>
                Emails Per Hour: <strong>{config.emailsPerHour}</strong>
              </label>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={config.emailsPerHour}
                onChange={(e) => handleInputChange('emailsPerHour', parseInt(e.target.value))}
                style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: 0,
                  background: '#ddd',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginTop: '8px' }}>
                <span>5/hour (Safe)</span>
                <span>100/hour (Aggressive)</span>
              </div>
            </div>

            <div style={{ marginTop: '24px', padding: '16px', background: 'white', border: '2px solid #333333' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600 }}>📊 Send Time Calculation:</p>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#666' }}>
                Current rate: <strong>{config.emailsPerHour} emails/hour</strong>
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                To send 5000 leads: <strong>~{Math.ceil(5000 / config.emailsPerHour)} hours</strong>
              </p>
              <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#999' }}>
                ✓ Recommended: 20-30/hour to avoid spam folders
              </p>
            </div>

            <div style={{ marginTop: '24px', padding: '16px', background: '#fff8dc', border: '2px solid #f59e0b', borderRadius: 0 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#92400e' }}>
                <strong>💡 Tip:</strong> Sending too many emails at once increases spam folder risk. Spreading sends over time improves deliverability.
              </p>
            </div>

            <button
              onClick={handleSave}
              style={{
                marginTop: '24px',
                width: '100%',
                background: '#333333',
                color: 'white',
                border: '2px solid #333333',
                borderRadius: 0,
                padding: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Save Rate Limit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
