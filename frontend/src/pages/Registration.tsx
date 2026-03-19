import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, CheckCircle, AlertCircle, Info, ChevronRight, Copy } from 'lucide-react';

interface RegistrationStep {
  step: number;
  title: string;
  description: string;
}

interface ValidationResult {
  emailValid: boolean;
  dkimValid: boolean;
  spfValid: boolean;
  errors: string[];
  warnings: string[];
}

const Registration: React.FC = () => {
  const navigate = useNavigate();
  // Step 1: Company Info
  const [step, setStep] = useState(1);
  const [sessionId, setSessionId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [staffName, setStaffName] = useState('');
  const [numberOfEmployees, setNumberOfEmployees] = useState(10);
  const [email, setEmail] = useState('');

  // Step 2: Email Verification
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);

  // Step 3: Outbound Email
  const [sendingEmail, setSendingEmail] = useState('');
  const [domain, setDomain] = useState('');
  const [dkimSelector, setDkimSelector] = useState('logik');
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  // Step 4: DNS Configuration
  const [selectedProvider, setSelectedProvider] = useState('namecheap');
  const [dnsGuide, setDnsGuide] = useState('');

  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

  const steps: RegistrationStep[] = [
    { step: 1, title: 'Company Info', description: 'Basic company information' },
    { step: 2, title: 'Email Verification', description: 'Verify your email address' },
    { step: 3, title: 'Outbound Email', description: 'Configure your sending email' },
    { step: 4, title: 'DNS Configuration', description: 'Set up DKIM & SPF records' },
  ];

  // ==================== STEP 1: Company Info ====================
  const handleStartRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/auth/registration/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          staffName,
          numberOfEmployees,
          email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to start registration');
      }

      setSessionId(data.sessionId);
      setSuccess('Company information saved!');
      setStep(2);

      // Automatically send verification email
      setTimeout(() => handleSendVerification(data.sessionId), 500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== STEP 2: Email Verification ====================
  const handleSendVerification = async (sid: string = sessionId) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/auth/registration/send-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send verification email');
      }

      setVerificationSent(true);
      setSuccess('Verification email sent! Check your inbox.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/auth/registration/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, verificationCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Invalid verification code');
      }

      setSuccess('Email verified successfully!');
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== STEP 3: Outbound Email Configuration ====================
  const handleConfigureEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/auth/registration/configure-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sendingEmail,
          domain,
          dkimSelector,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to configure email');
      }

      setValidation(data.validation);
      setSuccess(data.message);

      setStep(4);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== STEP 4: DNS Configuration ====================
  const handleGetDNSGuide = async (provider: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/auth/registration/dns-guide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, provider }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error('Failed to get DNS guide');
      }

      setDnsGuide(data.guide);
      setSelectedProvider(provider);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryValidation = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/auth/registration/retry-validation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sendingEmail,
          domain,
          dkimSelector,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Validation failed');
      }

      setValidation(data.validation);
      setSuccess(data.message);

      if (data.allValid) {
        setSuccess('All validations passed. You can continue to dashboard.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinishOnboarding = () => {
    navigate('/dashboard');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard!');
  };

  // ==================== RENDER ====================
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '700px', background: 'white', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: '#f9fafb', padding: '30px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px', color: '#1f2937' }}>Workspace Onboarding</div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>Configure company and outbound email settings</div>
        </div>

        {/* Progress Indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 30px', borderBottom: '1px solid #e5e7eb', overflow: 'auto', background: 'white' }}>
          {steps.map((s) => (
            <div
              key={s.step}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
                opacity: step >= s.step ? 1 : 0.5,
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: step === s.step ? '#2563eb' : step > s.step ? '#10b981' : '#e5e7eb',
                  color: step >= s.step ? 'white' : '#999',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  marginBottom: '8px',
                  border: step === s.step ? '2px solid #1e40af' : 'none',
                }}
              >
                {step > s.step ? '✓' : s.step}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  color: step >= s.step ? '#1f2937' : '#999',
                }}
              >
                {s.title}
              </div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '40px' }}>
          {/* Alerts */}
          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '12px', color: '#991b1b' }}>
              <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{error}</div>
            </div>
          )}

          {success && (
            <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '12px', color: '#166534' }}>
              <CheckCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{success}</div>
            </div>
          )}

          {/* STEP 1: Company Info */}
          {step === 1 && (
            <form onSubmit={handleStartRegistration}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: '#1f2937' }}>Company Information</h2>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g., Acme Corporation"
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>Your Name (Staff)</label>
                <input
                  type="text"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="e.g., John Smith"
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>Number of Employees</label>
                <select
                  value={numberOfEmployees}
                  onChange={(e) => setNumberOfEmployees(Number(e.target.value))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                >
                  <option value={10}>1-10</option>
                  <option value={50}>11-50</option>
                  <option value={100}>51-100</option>
                  <option value={500}>101-500</option>
                  <option value={1000}>500+</option>
                </select>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>Work Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !companyName || !staffName || !email}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: error ? '#000000' : (loading || !companyName || !staffName || !email ? '#d1d5db' : '#2563eb'),
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading || !companyName || !staffName || !email ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.3s ease',
                }}
              >
                {loading ? 'Processing...' : 'Continue'} {!loading && <ChevronRight size={20} />}
              </button>
            </form>
          )}

          {/* STEP 2: Email Verification */}
          {step === 2 && (
            <form onSubmit={handleVerifyEmail}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: '#1f2937' }}>Verify Your Email</h2>

              {!verificationSent ? (
                <>
                  <p style={{ color: '#6b7280', marginBottom: '24px' }}>We'll send a verification code to {email}</p>
                  <button
                    type="button"
                    onClick={() => handleSendVerification()}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: loading ? '#d1d5db' : '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <Mail size={20} />
                    {loading ? 'Sending...' : 'Send Verification Code'}
                  </button>
                </>
              ) : (
                <>
                  <p style={{ color: '#6b7280', marginBottom: '20px' }}>Enter the verification code sent to {email}</p>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>Verification Code</label>
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="Enter 6-digit code"
                      required
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', letterSpacing: '2px' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !verificationCode}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: error ? '#000000' : (loading || !verificationCode ? '#d1d5db' : '#2563eb'),
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: loading || !verificationCode ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    {loading ? 'Verifying...' : 'Verify Email'} {!loading && <ChevronRight size={20} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setVerificationSent(false)}
                    style={{
                      width: '100%',
                      marginTop: '12px',
                      padding: '10px 16px',
                      background: 'transparent',
                      color: '#2563eb',
                      border: '1px solid #2563eb',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    Resend Code
                  </button>
                </>
              )}
            </form>
          )}

          {/* STEP 3: Outbound Email Configuration */}
          {step === 3 && (
            <form onSubmit={handleConfigureEmail}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', color: '#1f2937' }}>Configure Outbound Email</h2>
              <p style={{ color: '#6b7280', marginBottom: '24px' }}>Set up your sending email address and domain for campaigns</p>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>Sending Email Address</label>
                <input
                  type="email"
                  value={sendingEmail}
                  onChange={(e) => setSendingEmail(e.target.value)}
                  placeholder="campaigns@yourcompany.com"
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>Domain</label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="yourcompany.com"
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>DKIM Selector</label>
                <input
                  type="text"
                  value={dkimSelector}
                  onChange={(e) => setDkimSelector(e.target.value)}
                  placeholder="logik"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              {validation && (
                <div style={{ marginBottom: '24px', padding: '16px', background: '#f3f4f6', borderRadius: '8px', border: `2px solid ${validation.dkimValid && validation.spfValid ? '#10b981' : '#f59e0b'}` }}>
                  <h3 style={{ fontWeight: '600', marginBottom: '12px', color: '#1f2937' }}>Validation Results</h3>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: validation.emailValid ? '#10b981' : '#ef4444' }}>
                    {validation.emailValid ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    <span>Email Domain: {validation.emailValid ? 'Valid' : 'Invalid'}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: validation.dkimValid ? '#10b981' : '#f59e0b' }}>
                    {validation.dkimValid ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    <span>DKIM: {validation.dkimValid ? 'Configured' : 'Not configured'}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: validation.spfValid ? '#10b981' : '#f59e0b' }}>
                    {validation.spfValid ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    <span>SPF: {validation.spfValid ? 'Configured' : 'Not configured'}</span>
                  </div>

                  {validation.warnings.length > 0 && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                      <p style={{ fontSize: '13px', fontWeight: '500', color: '#92400e', marginBottom: '8px' }}>⚠ Warnings:</p>
                      {validation.warnings.map((w, i) => (
                        <div key={i} style={{ fontSize: '13px', color: '#b45309', marginBottom: '4px' }}>• {w}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !sendingEmail || !domain}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: error ? '#000000' : (loading || !sendingEmail || !domain ? '#d1d5db' : '#2563eb'),
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading || !sendingEmail || !domain ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {loading ? 'Testing...' : 'Test Configuration'} {!loading && <ChevronRight size={20} />}
              </button>
            </form>
          )}

          {/* STEP 4: DNS Configuration Guide */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', color: '#1f2937' }}>DNS Configuration Required</h2>
              <p style={{ color: '#6b7280', marginBottom: '24px' }}>Complete DKIM and SPF setup in your DNS provider</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                {['namecheap', 'godaddy', 'route53', 'cloudflare', 'generic'].map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => handleGetDNSGuide(provider)}
                    style={{
                      padding: '12px 16px',
                      background: selectedProvider === provider ? '#2563eb' : '#f3f4f6',
                      color: selectedProvider === provider ? 'white' : '#1f2937',
                      border: '1px solid ' + (selectedProvider === provider ? '#1e40af' : '#e5e7eb'),
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {provider}
                  </button>
                ))}
              </div>

              {dnsGuide && (
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', marginBottom: '24px', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.6', maxHeight: '400px', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {dnsGuide}
                </div>
              )}

              <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', display: 'flex', gap: '12px' }}>
                <Info size={20} style={{ flexShrink: 0, color: '#0284c7', marginTop: '2px' }} />
                <div style={{ color: '#0c4a6e' }}>
                  <strong>After updating DNS:</strong> Click "Retry Validation" to verify the changes. This may take a few minutes to propagate.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  type="button"
                  onClick={handleRetryValidation}
                  disabled={loading}
                  style={{
                    padding: '12px 16px',
                    background: loading ? '#d1d5db' : '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Testing...' : 'Retry Validation'}
                </button>
                <button
                  type="button"
                  onClick={handleFinishOnboarding}
                  style={{
                    padding: '12px 16px',
                    background: '#f3f4f6',
                    color: '#1f2937',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Continue to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
    </div>
    </div>
  );
};

export default Registration;
