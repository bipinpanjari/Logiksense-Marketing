import React, { useEffect, useMemo, useState } from 'react';
import { Settings, Mail, Check, X, AlertCircle } from 'lucide-react';
import { getValidAccessToken } from '../auth/session';

interface EmailConfig {
  senderEmail: string;
  senderName: string;
  smtpHost: string;
  smtpPort: string; // keep string for input; we convert on save
  smtpUser: string;
  smtpPassword: string;
  emailsPerHour: number;
  dkimVerified: boolean;
  spfVerified: boolean;
}

type SaveState = 'idle' | 'saving' | 'success' | 'error';

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

  const [hasStoredPassword, setHasStoredPassword] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [smtpTestMessage, setSmtpTestMessage] = useState<string>('');
  const [smtpTestState, setSmtpTestState] = useState<SaveState>('idle');

  const [validationStatus, setValidationStatus] = useState<{
    dkim?: 'checking' | 'valid' | 'invalid';
    spf?: 'checking' | 'valid' | 'invalid';
  }>({});

  const [saveMessage, setSaveMessage] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [activeTab, setActiveTab] = useState<'smtp' | 'validation' | 'rate'>('smtp');
  const [dkimSelector, setDkimSelector] = useState('logik');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

  const domainFromSender = useMemo(() => {
    const parts = config.senderEmail.trim().toLowerCase().split('@');
    return parts.length === 2 ? parts[1] : '';
  }, [config.senderEmail]);

  const handleInputChange = (field: keyof EmailConfig, value: any) => {
    setConfig({ ...config, [field]: value });
  };

  async function authedFetch(path: string, init?: RequestInit) {
    const token = await getValidAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Request failed (${res.status})`);
    }
    return res.json();
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authedFetch('/email/config', { method: 'GET' });
        if (cancelled || !data) return;

        setConfig((prev) => ({
          ...prev,
          senderEmail: data.sendingEmail || '',
          senderName: data.smtpFromName || '',
          smtpHost: data.smtpHost || '',
          smtpPort: data.smtpPort ? String(data.smtpPort) : '587',
          smtpUser: data.smtpUser || '',
          smtpPassword: '',
          emailsPerHour: data.hourlySendLimit || prev.emailsPerHour || 25,
          dkimVerified: Boolean(data.dkimValid),
          spfVerified: Boolean(data.spfValid),
        }));
        setHasStoredPassword(Boolean(data.hasPassword));
      } catch {
        // no-op: page can still be used to save config
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaveState('saving');
    setSaveMessage('');
    try {
      const smtpPortNumber = Number(config.smtpPort);
      const payload: any = {
        sendingEmail: config.senderEmail,
        domain: domainFromSender,
        smtpHost: config.smtpHost,
        smtpPort: Number.isFinite(smtpPortNumber) ? smtpPortNumber : 587,
        smtpUser: config.smtpUser || undefined,
        smtpFromName: config.senderName || undefined,
        hourlySendLimit: config.emailsPerHour,
        isActive: true,
        emailProvider: undefined,
      };
      if (config.smtpPassword.trim().length > 0) {
        payload.smtpPassword = config.smtpPassword;
      }

      const saved = await authedFetch('/email/config', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setHasStoredPassword(Boolean(saved?.hasPassword) || hasStoredPassword || config.smtpPassword.trim().length > 0);
      setConfig((prev) => ({ ...prev, smtpPassword: '' }));
      setSaveState('success');
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (e: any) {
      setSaveState('error');
      setSaveMessage(e?.message || 'Failed to save settings');
      setTimeout(() => setSaveMessage(''), 5000);
    }
  };

  const testSMTPConnection = async () => {
    setSmtpTestState('saving');
    setSmtpTestMessage('');
    try {
      const result = await authedFetch('/email/test-connection', { method: 'POST' });
      setSmtpTestState('success');
      setSmtpTestMessage(result?.message || 'SMTP connection verified');
    } catch (e: any) {
      setSmtpTestState('error');
      setSmtpTestMessage(e?.message || 'SMTP test failed');
    }
  };

  const sendTestEmail = async () => {
    setSmtpTestState('saving');
    setSmtpTestMessage('');
    try {
      const result = await authedFetch('/email/send-test', {
        method: 'POST',
        body: JSON.stringify({ to: testRecipient }),
      });
      setSmtpTestState('success');
      setSmtpTestMessage(result?.message || 'Test email sent');
    } catch (e: any) {
      setSmtpTestState('error');
      setSmtpTestMessage(e?.message || 'Failed to send test email');
    }
  };

  const validateDKIM = async () => {
    setValidationStatus((s) => ({ ...s, dkim: 'checking' }));
    try {
      const result = await authedFetch('/email/validate-dkim', {
        method: 'POST',
        body: JSON.stringify({ domain: domainFromSender, selector: dkimSelector }),
      });
      const ok = Boolean(result?.ok);
      setValidationStatus((s) => ({ ...s, dkim: ok ? 'valid' : 'invalid' }));
      setConfig((prev) => ({ ...prev, dkimVerified: ok }));
    } catch {
      setValidationStatus((s) => ({ ...s, dkim: 'invalid' }));
      setConfig((prev) => ({ ...prev, dkimVerified: false }));
    }
  };

  const validateSPF = async () => {
    setValidationStatus((s) => ({ ...s, spf: 'checking' }));
    try {
      const result = await authedFetch('/email/validate-spf', {
        method: 'POST',
        body: JSON.stringify({ domain: domainFromSender }),
      });
      const ok = Boolean(result?.ok);
      setValidationStatus((s) => ({ ...s, spf: ok ? 'valid' : 'invalid' }));
      setConfig((prev) => ({ ...prev, spfVerified: ok }));
    } catch {
      setValidationStatus((s) => ({ ...s, spf: 'invalid' }));
      setConfig((prev) => ({ ...prev, spfVerified: false }));
    }
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
          background: saveState === 'error' ? '#fee2e2' : '#d1fae5',
          border: `2px solid ${saveState === 'error' ? '#ef4444' : '#10b981'}`,
          borderRadius: 0,
          padding: '12px 16px',
          marginBottom: '24px',
          color: saveState === 'error' ? '#991b1b' : '#065f46',
          fontWeight: 600,
          fontSize: '13px'
        }}>
          {saveState === 'error' ? '✗ ' : '✓ '}
          {saveMessage}
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
                  placeholder={hasStoredPassword ? '•••••••• (saved)' : '••••••••'}
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

              {smtpTestMessage && (
                <div style={{
                  background: smtpTestState === 'error' ? '#fee2e2' : '#d1fae5',
                  border: `2px solid ${smtpTestState === 'error' ? '#ef4444' : '#10b981'}`,
                  padding: '12px 16px',
                  color: smtpTestState === 'error' ? '#991b1b' : '#065f46',
                  fontWeight: 600,
                  fontSize: '13px',
                }}>
                  {smtpTestState === 'error' ? '✗ ' : '✓ '}
                  {smtpTestMessage}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333' }}>
                    Send Test Email To
                  </label>
                  <input
                    type="email"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder="you@yourcompany.com"
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
                <button
                  onClick={sendTestEmail}
                  disabled={!testRecipient.trim()}
                  style={{
                    background: !testRecipient.trim() ? '#e5e7eb' : 'white',
                    color: '#333333',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    padding: '12px',
                    fontWeight: 600,
                    cursor: !testRecipient.trim() ? 'not-allowed' : 'pointer'
                  }}
                >
                  Send Test Email
                </button>
                <button
                  onClick={testSMTPConnection}
                  style={{
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
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                  onClick={handleSave}
                  disabled={saveState === 'saving'}
                  style={{
                    flex: 1,
                    background: '#333333',
                    color: 'white',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    padding: '12px',
                    fontWeight: 600,
                    cursor: saveState === 'saving' ? 'not-allowed' : 'pointer',
                    opacity: saveState === 'saving' ? 0.7 : 1
                  }}
                >
                  {saveState === 'saving' ? 'Saving...' : 'Save Configuration'}
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
              DKIM is validated by checking DNS TXT for <strong>{dkimSelector}._domainkey.{domainFromSender || 'yourdomain.com'}</strong>.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333' }}>
                  Domain
                </label>
                <input
                  type="text"
                  value={domainFromSender}
                  readOnly
                  placeholder="example.com"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    background: '#f3f4f6'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333' }}>
                  DKIM Selector
                </label>
                <input
                  type="text"
                  value={dkimSelector}
                  onChange={(e) => setDkimSelector(e.target.value)}
                  placeholder="logik"
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
            <button
              onClick={validateDKIM}
              disabled={!domainFromSender}
              style={{
                background: validationStatus.dkim === 'valid' ? '#d1fae5' : validationStatus.dkim === 'invalid' ? '#fee2e2' : 'white',
                border: '2px solid #333333',
                borderRadius: 0,
                padding: '10px 16px',
                fontWeight: 600,
                cursor: !domainFromSender ? 'not-allowed' : 'pointer',
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
              SPF is validated by checking DNS TXT records for <strong>{domainFromSender || 'yourdomain.com'}</strong>.
            </p>
            <button
              onClick={validateSPF}
              disabled={!domainFromSender}
              style={{
                background: validationStatus.spf === 'valid' ? '#d1fae5' : validationStatus.spf === 'invalid' ? '#fee2e2' : 'white',
                border: '2px solid #333333',
                borderRadius: 0,
                padding: '10px 16px',
                fontWeight: 600,
                cursor: !domainFromSender ? 'not-allowed' : 'pointer',
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
              disabled={saveState === 'saving'}
              style={{
                marginTop: '24px',
                width: '100%',
                background: '#333333',
                color: 'white',
                border: '2px solid #333333',
                borderRadius: 0,
                padding: '12px',
                fontWeight: 600,
                cursor: saveState === 'saving' ? 'not-allowed' : 'pointer',
                opacity: saveState === 'saving' ? 0.7 : 1
              }}
            >
              {saveState === 'saving' ? 'Saving...' : 'Save Rate Limit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
