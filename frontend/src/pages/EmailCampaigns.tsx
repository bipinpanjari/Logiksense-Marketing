import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Send, Eye, BarChart3, Copy, Settings, TrendingUp } from 'lucide-react';

interface EmailStatus {
  leadId: string;
  leadName: string;
  status: 'pending' | 'sent' | 'delivered' | 'read'; // pending, sent (1 tick), delivered (2 grey), read (2 blue)
  sentTime?: string;
  deliveredTime?: string;
  readTime?: string;
}

interface Email {
  id: number;
  day: number;
  subject: string;
  body: string;
  abVariant?: string;
  pdfFile?: {
    name: string;
    size: number;
    data: string;
  };
  sentTo?: EmailStatus[];
}

interface MonthlyMetric {
  month: string;
  sent: number;
  delivered: number;
  opens: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

interface Campaign {
  id: number;
  name: string;
  service: string;
  industry: string;
  tone: string;
  cta: string;
  stage: string;
  emails: Email[];
  status: 'draft' | 'active' | 'archived';
  created: string;
  opens: number;
  clicks: number;
  replies: number;
  template: 'prebuilt' | 'custom';
  sent: number;
  delivered: number;
  conversions: number;
  revenue: number;
  monthlyMetrics: MonthlyMetric[];
}

const emailTemplates: { [key: string]: { [key: string]: Email[] } } = {
  'Awareness': {
    'Professional': [
      {
        id: 1,
        day: 0,
        subject: 'Quick Question About {{CompanyName}}',
        body: 'Hi {{FirstName}},\n\nI noticed {{CompanyName}} operates in {{Industry}}. Many similar companies are struggling with [key pain point].\n\nWe help businesses improve [benefit] by [solution approach].\n\nWould a quick 15-min chat to explore options be helpful?\n\nBest regards'
      },
      {
        id: 2,
        day: 3,
        subject: 'Still interested in exploring options?',
        body: 'Hi {{FirstName}},\n\nQuick follow-up - wanted to make sure you saw my previous message.\n\nOur clients typically see [metric] improvement in [timeframe].\n\nHappy to share a brief case study if you\'d like?\n\nCheers'
      },
      {
        id: 3,
        day: 7,
        subject: 'Last chance: {{FirstName}}, here\'s what you\'re missing',
        body: 'Hi {{FirstName}},\n\nJust wanted to reach out one more time.\n\n[Key insight about industry]\n\nIf you\'d like to learn how we\'re helping [similar companies], I\'ll send over a quick resource.\n\nTalk soon'
      }
    ],
    'Casual': [
      {
        id: 1,
        day: 0,
        subject: 'Hey {{FirstName}} - quick thought',
        body: 'Hey {{FirstName}}!\n\nWas looking at {{CompanyName}} and thought of you.\n\nWe\'re helping {{Industry}} businesses with [key challenge]. Seen some pretty cool results.\n\nFree to grab coffee ☕ or a quick call this week?\n\nCheers'
      },
      {
        id: 2,
        day: 2,
        subject: 'Following up - {{FirstName}}',
        body: 'Hey!\n\nDidn\'t hear back from you - totally cool if you\'re slammed 🙌\n\nJust wanted to check in. Really think you\'d find this interesting.\n\nLet me know!'
      }
    ]
  },
  'Consideration': {
    'Professional': [
      {
        id: 1,
        day: 0,
        subject: 'Case Study: How {{CompanyType}} Increased {{Metric}} by {{Percentage}}',
        body: 'Hi {{FirstName}},\n\nThought you\'d find this interesting:\n\n{{CompanyName}} faced [challenge]. Using our solution, they achieved:\n- {{Metric}} improvement\n- {{ROI}} ROI\n- [Benefit]\n\nWould you like to see their approach?\n\nBest'
      },
      {
        id: 2,
        day: 4,
        subject: 'How we do this differently',
        body: 'Hi {{FirstName}},\n\nMany companies try [common approach] but struggle with [limitation].\n\nHere\'s what makes our approach different:\n\n1. [Unique benefit 1]\n2. [Unique benefit 2]\n3. [Unique benefit 3]\n\nWorth a conversation?\n\nBest'
      }
    ]
  },
  'Decision': {
    'Professional': [
      {
        id: 1,
        day: 0,
        subject: 'Special pricing for {{FirstName}} - expires [DATE]',
        body: 'Hi {{FirstName}},\n\nWanted to make this easy.\n\nSpecial offer just for you:\n- [Service 1]\n- [Service 2]\n- [Bonus/Discount]\n\nThis pricing expires on [DATE].\n\nReady to get started?\n\nLink: [CTA]\n\nBest'
      },
      {
        id: 2,
        day: 2,
        subject: 'One last thing - {{FirstName}}',
        body: 'Hi {{FirstName}},\n\nJust confirming - you still interested in learning more?\n\nI\'ve reserved [offer] for you through [DATE].\n\nReply with any questions!\n\nCheers'
      }
    ]
  }
};

export default function EmailCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([
    {
      id: 1,
      name: 'SaaS Product Launch',
      service: 'SaaS Platform',
      industry: 'Tech',
      tone: 'Professional',
      cta: 'Demo',
      stage: 'Awareness',
      emails: emailTemplates['Awareness']['Professional'].map(e => ({
        ...e,
        sentTo: [
          { leadId: '1', leadName: 'John Smith', status: 'read', sentTime: '2h ago', deliveredTime: '2h ago', readTime: '1h ago' },
          { leadId: '2', leadName: 'Sarah Johnson', status: 'delivered', sentTime: '2h ago', deliveredTime: '1.5h ago' },
          { leadId: '3', leadName: 'Mike Chen', status: 'sent', sentTime: '2h ago' },
          { leadId: '4', leadName: 'Emily Davis', status: 'read', sentTime: '1h ago', deliveredTime: '1h ago', readTime: '30m ago' }
        ]
      })),
      status: 'active',
      created: '2 days ago',
      opens: 156,
      clicks: 42,
      replies: 8,
      sent: 250,
      delivered: 235,
      conversions: 8,
      revenue: 12000,
      template: 'prebuilt',
      monthlyMetrics: [
        { month: 'January', sent: 100, delivered: 95, opens: 48, clicks: 12, conversions: 2, revenue: 4000 },
        { month: 'February', sent: 120, delivered: 115, opens: 72, clicks: 18, conversions: 4, revenue: 6800 },
        { month: 'March', sent: 250, delivered: 235, opens: 156, clicks: 42, conversions: 8, revenue: 12000 }
      ]
    }
  ]);

  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignView, setCampaignView] = useState<'details' | 'analytics' | 'delivery'>('details');
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingEmail, setEditingEmail] = useState<Email | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    service: '',
    industry: '',
    tone: 'Professional',
    cta: 'Demo',
    stage: 'Awareness',
    templateType: 'prebuilt',
    pdfFile: null as File | null
  });

  const services = ['SaaS Platform', 'Marketing Agency', 'Consulting', 'E-commerce', 'Digital Product', 'B2B Service'];
  const industries = ['Tech', 'Finance', 'Healthcare', 'E-commerce', 'Real Estate', 'Manufacturing'];
  const tones = ['Professional', 'Casual', 'Aggressive', 'Friendly'];
  const ctas = ['Demo', 'Call', 'Free Trial', 'Download', 'Meeting'];
  const stages = ['Awareness', 'Consideration', 'Decision'];

  const handleCreateCampaign = () => {
    if (formData.name && formData.service && formData.industry) {
      let emails: Email[] = [];

      if (formData.templateType === 'custom' && formData.pdfFile) {
        // Read PDF file as base64
        const reader = new FileReader();
        reader.onload = (e) => {
          const pdfData = e.target?.result as string;
          const email: Email = {
            id: 1,
            day: 0,
            subject: `Check out this custom sequence - {{CompanyName}}`,
            body: `Hi {{FirstName}},\n\nI've prepared something specifically for {{CompanyName}}. Check the attached PDF for details.\n\nLooking forward to your thoughts!\n\nBest`,
            pdfFile: {
              name: formData.pdfFile!.name,
              size: formData.pdfFile!.size,
              data: pdfData
            }
          };

          const newCampaign: Campaign = {
            id: Math.max(...campaigns.map(c => c.id), 0) + 1,
            name: formData.name,
            service: formData.service,
            industry: formData.industry,
            tone: formData.tone,
            cta: formData.cta,
            stage: formData.stage,
            emails: [email],
            status: 'draft',
            created: 'just now',
            opens: 0,
            clicks: 0,
            replies: 0,
            template: 'custom',
            sent: 0,
            delivered: 0,
            conversions: 0,
            revenue: 0,
            monthlyMetrics: []
          };

          setCampaigns([...campaigns, newCampaign]);
          setFormData({ name: '', service: '', industry: '', tone: 'Professional', cta: 'Demo', stage: 'Awareness', templateType: 'prebuilt', pdfFile: null });
          setIsCreating(false);
        };
        reader.readAsDataURL(formData.pdfFile);
      } else {
        // Use prebuilt templates
        const templates = emailTemplates[formData.stage]?.[formData.tone] || emailTemplates[formData.stage]['Professional'];
        emails = templates.map((e, i) => ({ ...e, id: i + 1 }));

        const newCampaign: Campaign = {
          id: Math.max(...campaigns.map(c => c.id), 0) + 1,
          name: formData.name,
          service: formData.service,
          industry: formData.industry,
          tone: formData.tone,
          cta: formData.cta,
          stage: formData.stage,
          emails: emails,
          status: 'draft',
          created: 'just now',
          opens: 0,
          clicks: 0,
          replies: 0,
          template: 'prebuilt',
          sent: 0,
          delivered: 0,
          conversions: 0,
          revenue: 0,
          monthlyMetrics: []
        };

        setCampaigns([...campaigns, newCampaign]);
        setFormData({ name: '', service: '', industry: '', tone: 'Professional', cta: 'Demo', stage: 'Awareness', templateType: 'prebuilt', pdfFile: null });
        setIsCreating(false);
      }
    }
  };

  const handleUpdateEmail = (campaignId: number, emailId: number, updatedEmail: Email) => {
    setCampaigns(campaigns.map(c => 
      c.id === campaignId ? {
        ...c,
        emails: c.emails.map(e => e.id === emailId ? updatedEmail : e)
      } : c
    ));
  };

  const handleDeleteCampaign = (id: number) => {
    setCampaigns(campaigns.filter(c => c.id !== id));
    setSelectedCampaign(null);
  };

  const getVariableExamples = () => {
    return [
      '{{FirstName}} - Recipient first name',
      '{{LastName}} - Recipient last name',
      '{{CompanyName}} - Company name',
      '{{Industry}} - Industry',
      '{{Title}} - Job title',
      '{{Metric}} - Custom metric',
      '{{Percentage}} - Custom percentage'
    ];
  };

  const renderStatusTicks = (status: string) => {
    switch (status) {
      case 'pending':
        return <span style={{ color: '#999', fontSize: '14px' }}>⏱️</span>;
      case 'sent':
        return <span style={{ color: '#666', fontSize: '12px' }}>✓</span>;
      case 'delivered':
        return <span style={{ color: '#999', fontSize: '12px' }}>✓✓</span>;
      case 'read':
        return <span style={{ color: '#3b82f6', fontSize: '12px', fontWeight: 700 }}>✓✓</span>;
      default:
        return null;
    }
  };

  const getOpenRate = (campaign: Campaign) => {
    if (campaign.sent === 0) return 0;
    return Math.round((campaign.opens / campaign.sent) * 100);
  };

  const getClickRate = (campaign: Campaign) => {
    if (campaign.opens === 0) return 0;
    return Math.round((campaign.clicks / campaign.opens) * 100);
  };

  const getConversionRate = (campaign: Campaign) => {
    if (campaign.clicks === 0) return 0;
    return Math.round((campaign.conversions / campaign.clicks) * 100);
  };

  return (
    <div style={{ padding: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#333333', margin: 0 }}>Email Campaigns</h1>
        <button onClick={() => setIsCreating(true)} style={{
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
          <Plus size={18} /> New Campaign
        </button>
      </div>

      {selectedCampaign ? (
        // Campaign Details View
        <div>
          <button 
            onClick={() => setSelectedCampaign(null)}
            style={{
              background: 'white',
              color: '#333333',
              border: '2px solid #333333',
              borderRadius: 0,
              padding: '8px 16px',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: '24px'
            }}
          >
            ← Back to Campaigns
          </button>

          {/* View Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid #e5e5e5', paddingBottom: '12px' }}>
            <button
              onClick={() => setCampaignView('details')}
              style={{
                background: campaignView === 'details' ? '#333333' : 'white',
                color: campaignView === 'details' ? 'white' : '#333333',
                border: '2px solid #333333',
                borderRadius: 0,
                padding: '10px 16px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              📧 Emails
            </button>
            <button
              onClick={() => setCampaignView('analytics')}
              style={{
                background: campaignView === 'analytics' ? '#333333' : 'white',
                color: campaignView === 'analytics' ? 'white' : '#333333',
                border: '2px solid #333333',
                borderRadius: 0,
                padding: '10px 16px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              📊 Analytics
            </button>
            <button
              onClick={() => setCampaignView('delivery')}
              style={{
                background: campaignView === 'delivery' ? '#333333' : 'white',
                color: campaignView === 'delivery' ? 'white' : '#333333',
                border: '2px solid #333333',
                borderRadius: 0,
                padding: '10px 16px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              ✓✓ Delivery Status
            </button>
          </div>

          {campaignView === 'details' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'white', border: '2px solid #333333', borderRadius: 0, padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#666', fontWeight: 600, marginBottom: '8px' }}>SENT</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#333333' }}>{selectedCampaign.sent}</div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>Total sent</div>
                </div>
                <div style={{ background: 'white', border: '2px solid #333333', borderRadius: 0, padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#666', fontWeight: 600, marginBottom: '8px' }}>DELIVERED</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#333333' }}>{selectedCampaign.delivered}</div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>{Math.round((selectedCampaign.delivered/selectedCampaign.sent)*100)}% delivery</div>
                </div>
                <div style={{ background: 'white', border: '2px solid #333333', borderRadius: 0, padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#666', fontWeight: 600, marginBottom: '8px' }}>OPENS</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#333333' }}>{selectedCampaign.opens}</div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>{getOpenRate(selectedCampaign)}% open rate</div>
                </div>
                <div style={{ background: 'white', border: '2px solid #333333', borderRadius: 0, padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#666', fontWeight: 600, marginBottom: '8px' }}>CONVERSIONS</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#333333' }}>{selectedCampaign.conversions}</div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>${(selectedCampaign.revenue / 1000).toFixed(1)}K revenue</div>
                </div>
              </div>

              {/* Campaign Info */}
              <div style={{ background: 'white', border: '2px solid #333333', borderRadius: 0, padding: '20px', marginBottom: '24px' }}>
                <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: '#333333' }}>{selectedCampaign.name}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#666', fontWeight: 600 }}>Service:</span>
                    <span style={{ color: '#333333', marginLeft: '8px' }}>{selectedCampaign.service}</span>
                  </div>
                  <div>
                    <span style={{ color: '#666', fontWeight: 600 }}>Industry:</span>
                    <span style={{ color: '#333333', marginLeft: '8px' }}>{selectedCampaign.industry}</span>
                  </div>
                  <div>
                    <span style={{ color: '#666', fontWeight: 600 }}>Stage:</span>
                    <span style={{ color: '#333333', marginLeft: '8px' }}>{selectedCampaign.stage}</span>
                  </div>
                  <div>
                <span style={{ color: '#666', fontWeight: 600 }}>Created:</span>
                <span style={{ color: '#333333', marginLeft: '8px' }}>{selectedCampaign.created}</span>
              </div>
            </div>
          </div>

          {/* Emails in Sequence */}
          <div style={{ background: 'white', border: '2px solid #333333', borderRadius: 0, padding: '20px' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 700, color: '#333333' }}>Email Sequence ({selectedCampaign.emails.length} emails)</h3>
            
            {selectedCampaign.emails.map((email, index) => (
              <div key={email.id} style={{ 
                background: '#f9f9f9', 
                border: '2px solid #333333', 
                borderRadius: 0, 
                padding: '16px', 
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ 
                      background: '#333333', 
                      color: 'white', 
                      width: '28px', 
                      height: '28px', 
                      borderRadius: '50%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: '12px'
                    }}>
                      {index + 1}
                    </span>
                    <span style={{ color: '#666', fontSize: '12px' }}>Send on Day {email.day}</span>
                    {email.pdfFile && (
                      <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: 600, marginLeft: 'auto' }}>📎 PDF Attached</span>
                    )}
                  </div>
                  <h4 style={{ margin: '8px 0', fontSize: '14px', fontWeight: 600, color: '#333333' }}>
                    {email.subject}
                  </h4>
                  <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#666', lineHeight: '1.5', maxHeight: '60px', overflow: 'hidden' }}>
                    {email.body.substring(0, 150)}...
                  </p>
                  {email.pdfFile && (
                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
                      📄 {email.pdfFile.name} ({(email.pdfFile.size / 1024).toFixed(2)} KB)
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginLeft: '16px', flexShrink: 0 }}>
                  <button
                    onClick={() => {
                      setEditingEmail(email);
                      setIsEditing(true);
                    }}
                    style={{
                      background: 'white',
                      border: '2px solid #333333',
                      borderRadius: 0,
                      padding: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    style={{
                      background: 'white',
                      border: '2px solid #333333',
                      borderRadius: 0,
                      padding: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <Eye size={14} />
                  </button>
                </div>
              </div>
            ))}
            </div>
            </>
          )}

          {campaignView === 'analytics' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'white', border: '2px solid #333333', borderRadius: 0, padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#666', fontWeight: 600, marginBottom: '8px' }}>CONVERSION RATE</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#10b981' }}>{getConversionRate(selectedCampaign)}%</div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>{selectedCampaign.conversions} conversions</div>
                </div>
                <div style={{ background: 'white', border: '2px solid #333333', borderRadius: 0, padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#666', fontWeight: 600, marginBottom: '8px' }}>CLICK-THROUGH RATE</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#3b82f6' }}>{getClickRate(selectedCampaign)}%</div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>{selectedCampaign.clicks} clicks</div>
                </div>
                <div style={{ background: 'white', border: '2px solid #333333', borderRadius: 0, padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#666', fontWeight: 600, marginBottom: '8px' }}>TOTAL REVENUE</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#333333' }}>${selectedCampaign.revenue.toLocaleString()}</div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>From {selectedCampaign.conversions} conversions</div>
                </div>
              </div>

              <div style={{ background: 'white', border: '2px solid #333333', borderRadius: 0, padding: '20px' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 700, color: '#333333' }}>📈 Monthly Performance</h3>
                {selectedCampaign.monthlyMetrics.map((metric, idx) => (
                  <div key={idx} style={{ borderBottom: idx !== selectedCampaign.monthlyMetrics.length - 1 ? '1px solid #e5e5e5' : 'none', paddingBottom: '16px', marginBottom: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#999', fontWeight: 600 }}>MONTH</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#333333' }}>{metric.month}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#999', fontWeight: 600 }}>SENT</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#333333' }}>{metric.sent}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#999', fontWeight: 600 }}>DELIVERED</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#333333' }}>{metric.delivered}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#999', fontWeight: 600 }}>OPENS</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#333333' }}>{metric.opens}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#999', fontWeight: 600 }}>CONVERSIONS</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>{metric.conversions}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#999', fontWeight: 600 }}>REVENUE</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#333333' }}>${metric.revenue.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {campaignView === 'delivery' && (
            <div>
              {selectedCampaign.emails.map((email, emailIdx) => (
                <div key={email.id} style={{ background: 'white', border: '2px solid #333333', borderRadius: 0, padding: '20px', marginBottom: '20px' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 700, color: '#333333' }}>
                    Email {emailIdx + 1}: {email.subject}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                    {email.sentTo && email.sentTo.map((recipient, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f9f9f9', border: '1px solid #e5e5e5' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#333333' }}>{recipient.leadName}</div>
                          <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                            Sent: {recipient.sentTime}
                            {recipient.deliveredTime && ` • Delivered: ${recipient.deliveredTime}`}
                            {recipient.readTime && ` • Read: ${recipient.readTime}`}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '16px' }}>
                          <span style={{ fontSize: '12px', color: '#666', fontWeight: 600 }}>
                            {recipient.status === 'pending' && '⏱️ Pending'}
                            {recipient.status === 'sent' && '✓ Sent'}
                            {recipient.status === 'delivered' && '✓✓ Delivered'}
                            {recipient.status === 'read' && '✓✓ Read'}
                          </span>
                          {renderStatusTicks(recipient.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : isCreating ? (
        // Campaign Creation Wizard
        <div style={{ background: 'white', border: '2px solid #333333', borderRadius: 0, padding: '32px', maxWidth: '600px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#333333' }}>Create New Campaign</h2>
            <button
              onClick={() => setIsCreating(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px' }}
            >
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333333' }}>
                Campaign Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Q1 SaaS Product Launch"
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

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333333' }}>
                What service do you offer?
              </label>
              <select
                value={formData.service}
                onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #333333',
                  borderRadius: 0,
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">Select service...</option>
                {services.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333333' }}>
                Target Industry
              </label>
              <select
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #333333',
                  borderRadius: 0,
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">Select industry...</option>
                {industries.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333333' }}>
                  Tone
                </label>
                <select
                  value={formData.tone}
                  onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  {tones.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333333' }}>
                  Call to Action
                </label>
                <select
                  value={formData.cta}
                  onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  {ctas.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333333' }}>
                Pipeline Stage
              </label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #333333',
                  borderRadius: 0,
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              >
                {stages.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div style={{ borderTop: '2px solid #e5e5e5', paddingTop: '16px', marginTop: '8px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: '#333333' }}>
                Sequence Type
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  onClick={() => setFormData({ ...formData, templateType: 'prebuilt', pdfFile: null })}
                  style={{
                    padding: '12px',
                    border: formData.templateType === 'prebuilt' ? '2px solid #333333' : '2px solid #e5e5e5',
                    background: formData.templateType === 'prebuilt' ? '#f0f0f0' : 'white',
                    borderRadius: 0,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: '#333333',
                    transition: 'all 0.2s'
                  }}
                >
                  📧 Pre-built Template
                </button>
                <button
                  onClick={() => setFormData({ ...formData, templateType: 'custom' })}
                  style={{
                    padding: '12px',
                    border: formData.templateType === 'custom' ? '2px solid #333333' : '2px solid #e5e5e5',
                    background: formData.templateType === 'custom' ? '#f0f0f0' : 'white',
                    borderRadius: 0,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: '#333333',
                    transition: 'all 0.2s'
                  }}
                >
                  📄 Upload PDF
                </button>
              </div>
            </div>

            {formData.templateType === 'custom' && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333333' }}>
                  Upload Your Custom Email PDF
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setFormData({ ...formData, pdfFile: e.target.files?.[0] || null })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #333333',
                    borderRadius: 0,
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    cursor: 'pointer'
                  }}
                />
                {formData.pdfFile && (
                  <div style={{ fontSize: '12px', color: '#10b981', marginTop: '6px', fontWeight: 600 }}>
                    ✓ {formData.pdfFile.name} ({(formData.pdfFile.size / 1024).toFixed(2)} KB)
                  </div>
                )}
              </div>
            )}

            {formData.templateType === 'prebuilt' && (
              <div style={{ background: '#f9f9f9', border: '2px solid #e5e5e5', borderRadius: 0, padding: '12px', fontSize: '12px', color: '#666' }}>
                <div style={{ fontWeight: 600, marginBottom: '8px', color: '#333333' }}>Available Variables:</div>
                {getVariableExamples().map((v, i) => (
                  <div key={i} style={{ color: '#666', fontSize: '11px', marginBottom: '4px' }}>• {v}</div>
                ))}
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
                onClick={() => setIsCreating(false)}
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
      ) : (
        // Campaigns List
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {campaigns.map(campaign => (
              <div key={campaign.id} style={{
                background: 'white',
                border: '2px solid #333333',
                borderRadius: 0,
                padding: '20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700, color: '#333333' }}>
                      {campaign.name}
                    </h3>
                    <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>
                      {campaign.stage} • {campaign.emails.length} emails
                    </p>
                  </div>
                  <span style={{
                    background: campaign.status === 'active' ? '#10b981' : campaign.status === 'draft' ? '#f59e0b' : '#e5e5e5',
                    color: campaign.status === 'active' ? 'white' : campaign.status === 'draft' ? 'white' : '#666',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 600
                  }}>
                    {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px', fontSize: '12px' }}>
                  <div style={{ textAlign: 'center', padding: '8px', background: '#f9f9f9', border: '1px solid #e5e5e5' }}>
                    <div style={{ fontWeight: 600, color: '#333333' }}>{campaign.opens}</div>
                    <div style={{ color: '#666', fontSize: '11px' }}>Opens</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px', background: '#f9f9f9', border: '1px solid #e5e5e5' }}>
                    <div style={{ fontWeight: 600, color: '#333333' }}>{campaign.clicks}</div>
                    <div style={{ color: '#666', fontSize: '11px' }}>Clicks</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px', background: '#f9f9f9', border: '1px solid #e5e5e5' }}>
                    <div style={{ fontWeight: 600, color: '#333333' }}>{campaign.replies}</div>
                    <div style={{ color: '#666', fontSize: '11px' }}>Replies</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setSelectedCampaign(campaign)}
                    style={{
                      flex: 1,
                      background: 'white',
                      color: '#333333',
                      border: '2px solid #333333',
                      borderRadius: 0,
                      padding: '8px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '12px'
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteCampaign(campaign.id)}
                    style={{
                      background: 'white',
                      color: '#dc2626',
                      border: '2px solid #333333',
                      borderRadius: 0,
                      padding: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {campaigns.length === 0 && (
            <div style={{ textAlign: 'center', color: '#999', padding: '64px 32px' }}>
              <p style={{ fontSize: '16px', margin: '0 0 16px 0' }}>No campaigns yet</p>
              <p style={{ fontSize: '14px', margin: 0 }}>Create your first email campaign to get started</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
