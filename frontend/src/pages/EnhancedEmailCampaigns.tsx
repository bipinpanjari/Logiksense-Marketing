import React, { useState } from 'react';
import { Plus, X, Mail, Clock, CheckCircle2, TrendingUp, AlertCircle } from 'lucide-react';

// Campaign Templates by Industry + Seniority
const CAMPAIGN_TEMPLATES = {
  Healthcare: {
    'C-Level (CEO/CTO/CFO)': [
      {
        id: 'hc-c-1',
        subject: 'Healthcare IT Transformation Meeting',
        body: 'Hi {{firstName}},\n\nWe help {{companyName}} optimize patient data management and HIPAA compliance.\n\nWould you have 15 minutes next week to explore how we\'ve helped similar healthcare systems?\n\nBest regards,\n{{senderName}}'
      }
    ],
    'Director/VP': [
      {
        id: 'hc-d-1',
        subject: 'Improve Care Delivery Efficiency',
        body: 'Hi {{firstName}},\n\nOur solutions have helped {{industry}} organizations reduce administrative burden by 40%.\n\nLet\'s discuss quick wins for {{companyName}}.\n\nBest regards,\n{{senderName}}'
      }
    ]
  },
  Technology: {
    'C-Level (CEO/CTO/CFO)': [
      {
        id: 'tech-c-1',
        subject: 'Tech Stack Optimization Opportunity',
        body: 'Hi {{firstName}},\n\nWe help tech companies streamline their {{department}} operations.\n\nWould a 20-minute call work to discuss potential improvements?\n\nBest regards,\n{{senderName}}'
      }
    ],
    'Director/VP': [
      {
        id: 'tech-d-1',
        subject: 'Scale Your {{department}} Without Scaling Costs',
        body: 'Hi {{firstName}},\n\nLeading tech companies in {{location}} are reducing operational costs by 35%.\n\nLet\'s explore options for {{companyName}}.\n\nBest regards,\n{{senderName}}'
      }
    ]
  },
  Finance: {
    'C-Level (CEO/CTO/CFO)': [
      {
        id: 'fin-c-1',
        subject: 'Financial Process Automation Strategy',
        body: 'Hi {{firstName}},\n\nOur financial automation platform helps {{companyType}} companies improve accuracy and reduce costs.\n\nWould you be open to a quick conversation?\n\nBest regards,\n{{senderName}}'
      }
    ],
    'Director/VP': [
      {
        id: 'fin-d-1',
        subject: '{{companyName}} - Financial Closing Cycle Opportunity',
        body: 'Hi {{firstName}},\n\nWe\'ve helped {{industry}} firms close their books 5 days faster.\n\nWould a brief chat be valuable?\n\nBest regards,\n{{senderName}}'
      }
    ]
  }
};

interface Campaign {
  id: string;
  name: string;
  industry: string;
  targetSeniority: string;
  templateId: string;
  status: 'draft' | 'scheduled' | 'sending' | 'completed';
  emailsQueued: number;
  emailsSent: number;
  emailsDelivered: number;
  emailsOpened: number;
  createdAt: string;
}

interface EmailQueue {
  id: string;
  campaignId: string;
  recipientEmail: string;
  recipientName: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  scheduledTime: Date;
  sentTime?: Date;
}

export default function EnhancedEmailCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [emailQueue, setEmailQueue] = useState<EmailQueue[]>([]);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [selectedSeniority, setSelectedSeniority] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [emailsPerHour, setEmailsPerHour] = useState(25);
  const [recipientCount, setRecipientCount] = useState(0);
  const [showQueuePreview, setShowQueuePreview] = useState(false);

  const industries = Object.keys(CAMPAIGN_TEMPLATES);

  const handleCreateCampaign = () => {
    if (!selectedIndustry || !selectedSeniority || !campaignName) {
      alert('Please fill in all fields');
      return;
    }

    const template = CAMPAIGN_TEMPLATES[selectedIndustry as keyof typeof CAMPAIGN_TEMPLATES]?.[selectedSeniority as any]?.[0];
    if (!template) {
      alert('No template available for this combination');
      return;
    }

    const newCampaign: Campaign = {
      id: `campaign-${Date.now()}`,
      name: campaignName,
      industry: selectedIndustry,
      targetSeniority: selectedSeniority,
      templateId: template.id,
      status: 'draft',
      emailsQueued: recipientCount,
      emailsSent: 0,
      emailsDelivered: 0,
      emailsOpened: 0,
      createdAt: new Date().toISOString()
    };

    setCampaigns([...campaigns, newCampaign]);

    // Simulate creating queue items
    const queueItems: EmailQueue[] = [];
    for (let i = 0; i < recipientCount; i++) {
      const hours = Math.floor(i / emailsPerHour);
      queueItems.push({
        id: `email-${newCampaign.id}-${i}`,
        campaignId: newCampaign.id,
        recipientEmail: `recipient${i}@example.com`,
        recipientName: `Contact ${i + 1}`,
        status: 'pending',
        scheduledTime: new Date(Date.now() + hours * 3600000)
      });
    }

    setEmailQueue([...emailQueue, ...queueItems]);
    setShowNewCampaign(false);
    setCampaignName('');
    setRecipientCount(0);
  };

  const startSendingCampaign = (campaignId: string) => {
    setCampaigns(campaigns.map(c =>
      c.id === campaignId ? { ...c, status: 'sending' } : c
    ));
  };

  const getTemplate = (templateId: string) => {
    for (const industry of Object.keys(CAMPAIGN_TEMPLATES)) {
      for (const seniority of Object.keys((CAMPAIGN_TEMPLATES as any)[industry])) {
        const template = (CAMPAIGN_TEMPLATES as any)[industry][seniority].find((t: any) => t.id === templateId);
        if (template) return template;
      }
    }
    return null;
  };

  const estimatedSendTime = (emailCount: number, perHour: number) => {
    return Math.ceil(emailCount / perHour);
  };

  return (
    <div style={{ padding: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#333333', margin: 0 }}>Email Campaigns</h1>
        <button
          onClick={() => setShowNewCampaign(true)}
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
          <Plus size={18} /> New Campaign
        </button>
      </div>

      {/* Active Campaigns */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#333333' }}>
          Active Campaigns ({campaigns.length})
        </h2>

        {campaigns.length === 0 ? (
          <div style={{
            background: '#f9f9f9',
            border: '2px solid #ddd',
            borderRadius: 0,
            padding: '32px',
            textAlign: 'center',
            color: '#999'
          }}>
            No campaigns yet. Create your first campaign to get started!
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                style={{
                  background: 'white',
                  border: '2px solid #333333',
                  borderRadius: 0,
                  padding: '20px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600 }}>{campaign.name}</h3>
                    <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                      {campaign.industry} • {campaign.targetSeniority}
                    </p>
                  </div>
                  <span style={{
                    background: campaign.status === 'sending' ? '#fef3c7' : campaign.status === 'draft' ? '#e5e5e5' : '#d1fae5',
                    color: campaign.status === 'sending' ? '#92400e' : campaign.status === 'draft' ? '#666' : '#065f46',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 600
                  }}>
                    {campaign.status.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '12px' }}>
                  <div>
                    <p style={{ margin: '0 0 4px 0', color: '#666' }}>Queued</p>
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#333' }}>{campaign.emailsQueued}</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 4px 0', color: '#666' }}>Sent</p>
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#3b82f6' }}>{campaign.emailsSent}</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 4px 0', color: '#666' }}>Delivered</p>
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#10b981' }}>{campaign.emailsDelivered}</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 4px 0', color: '#666' }}>Opened</p>
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#8b5cf6' }}>{campaign.emailsOpened}</p>
                  </div>
                </div>

                <div style={{ padding: '12px', background: '#f9f9f9', border: '1px solid #ddd', marginBottom: '16px', fontSize: '12px' }}>
                  <p style={{ margin: '0 0 4px 0', color: '#666' }}>📊 Estimated send time at 25 emails/hour:</p>
                  <p style={{ margin: 0, fontWeight: 600 }}>{estimatedSendTime(campaign.emailsQueued, 25)} hours (~{Math.ceil(estimatedSendTime(campaign.emailsQueued, 25) / 24)} days)</p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {campaign.status === 'draft' && (
                    <>
                      <button
                        onClick={() => startSendingCampaign(campaign.id)}
                        style={{
                          flex: 1,
                          background: '#10b981',
                          color: 'white',
                          border: '2px solid #10b981',
                          borderRadius: 0,
                          padding: '10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <Mail size={14} style={{ display: 'inline', marginRight: '6px' }} />
                        Start Sending
                      </button>
                      <button
                        onClick={() => setShowQueuePreview(true)}
                        style={{
                          flex: 1,
                          background: 'white',
                          color: '#333333',
                          border: '2px solid #333333',
                          borderRadius: 0,
                          padding: '10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Preview Queue
                      </button>
                    </>
                  )}
                  {campaign.status === 'sending' && (
                    <div style={{ width: '100%', fontSize: '12px', color: '#666' }}>
                      <p style={{ margin: '0 0 8px 0' }}>⏳ Sending in progress...</p>
                      <div style={{ width: '100%', height: '8px', background: '#e5e5e5', border: '1px solid #999', position: 'relative', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            background: '#10b981',
                            width: `${(campaign.emailsSent / campaign.emailsQueued) * 100}%`,
                            transition: 'width 0.3s'
                          }}
                        />
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '11px' }}>
                        {campaign.emailsSent} / {campaign.emailsQueued} sent
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Campaign Modal */}
      {showNewCampaign && (
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
          onClick={() => setShowNewCampaign(false)}
        >
          <div
            style={{
              background: 'white',
              border: '2px solid #333333',
              borderRadius: 0,
              padding: '32px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: 700 }}>Create New Campaign</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333' }}>
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g., Q2 Healthcare CTOs"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333' }}>
                  Target Industry
                </label>
                <select
                  value={selectedIndustry}
                  onChange={(e) => setSelectedIndustry(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">-- Select Industry --</option>
                  {industries.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333' }}>
                  Target Seniority Level
                </label>
                <select
                  value={selectedSeniority}
                  onChange={(e) => setSelectedSeniority(e.target.value)}
                  disabled={!selectedIndustry}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    opacity: !selectedIndustry ? 0.6 : 1,
                    cursor: !selectedIndustry ? 'not-allowed' : 'pointer'
                  }}
                >
                  <option value="">-- Select Seniority --</option>
                  {selectedIndustry && Object.keys((CAMPAIGN_TEMPLATES as any)[selectedIndustry]).map((sen) => (
                    <option key={sen} value={sen}>{sen}</option>
                  ))}
                </select>
              </div>

              {selectedIndustry && selectedSeniority && (
                <div style={{
                  background: '#f9f9f9',
                  border: '2px solid #ddd',
                  padding: '16px',
                  borderRadius: 0
                }}>
                  <p style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: 600 }}>📧 Template Preview:</p>
                  {getTemplate(
                    (CAMPAIGN_TEMPLATES as any)[selectedIndustry][selectedSeniority][0]?.id
                  ) && (
                    <>
                      <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#666' }}>
                        <strong>Subject:</strong> {getTemplate(
                          (CAMPAIGN_TEMPLATES as any)[selectedIndustry][selectedSeniority][0]?.id
                        )?.subject}
                      </p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#666', whiteSpace: 'pre-wrap' }}>
                        <strong>Body:</strong> {getTemplate(
                          (CAMPAIGN_TEMPLATES as any)[selectedIndustry][selectedSeniority][0]?.id
                        )?.body.substring(0, 100)}...
                      </p>
                    </>
                  )}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333' }}>
                  Number of Recipients
                </label>
                <input
                  type="number"
                  value={recipientCount}
                  onChange={(e) => setRecipientCount(parseInt(e.target.value) || 0)}
                  placeholder="e.g., 500"
                  min="1"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333' }}>
                  Send Rate: {emailsPerHour} emails/hour
                </label>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={emailsPerHour}
                  onChange={(e) => setEmailsPerHour(parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    height: '8px',
                    background: '#ddd'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#666', marginTop: '6px' }}>
                  <span>5/hour (Safe)</span>
                  <span>100/hour (Aggressive)</span>
                </div>
              </div>

              {recipientCount > 0 && (
                <div style={{
                  background: '#e5f7ff',
                  border: '2px solid #3b82f6',
                  padding: '12px',
                  borderRadius: 0,
                  fontSize: '12px',
                  color: '#1e40af'
                }}>
                  <p style={{ margin: 0 }}>
                    <Clock size={14} style={{ display: 'inline', marginRight: '6px' }} />
                    Estimated send time: <strong>~{estimatedSendTime(recipientCount, emailsPerHour)} hours</strong> ({Math.ceil(estimatedSendTime(recipientCount, emailsPerHour) / 24)} days)
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                  onClick={handleCreateCampaign}
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
                  Create Campaign
                </button>
                <button
                  onClick={() => setShowNewCampaign(false)}
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

      {/* Queue Preview Modal */}
      {showQueuePreview && (
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
          onClick={() => setShowQueuePreview(false)}
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
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Email Queue Preview</h2>
              <button
                onClick={() => setShowQueuePreview(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#666' }}>
              Next 20 items in queue (showing staggered sends):
            </p>

            <div style={{ marginBottom: '24px', maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #333333' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>#</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Email</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Scheduled Time</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {emailQueue.slice(0, 20).map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #e5e5e5' }}>
                      <td style={{ padding: '8px' }}>{idx + 1}</td>
                      <td style={{ padding: '8px' }}>{item.recipientEmail}</td>
                      <td style={{ padding: '8px', fontSize: '11px', color: '#666' }}>
                        {item.scheduledTime.toLocaleTimeString()}
                      </td>
                      <td style={{ padding: '8px' }}>
                        <span style={{
                          background: '#fef3c7',
                          color: '#92400e',
                          padding: '2px 6px',
                          fontSize: '10px',
                          fontWeight: 600
                        }}>
                          Pending
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{
              background: '#f9f9f9',
              border: '2px solid #ddd',
              padding: '16px',
              borderRadius: 0,
              fontSize: '12px',
              color: '#666'
            }}>
              <p style={{ margin: 0 }}>
                ✓ Emails are spaced throughout defined hours to avoid spam filters
              </p>
              <p style={{ margin: '6px 0 0 0' }}>
                Each batch maintains consistent spacing for optimal deliverability
              </p>
            </div>

            <button
              onClick={() => setShowQueuePreview(false)}
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
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
