import React, { useState, useEffect } from 'react';
import { appIntegration } from '../services/appIntegration';

interface IntegrationPanelProps {
  projectId: string;
  onStatusChange?: (status: any) => void;
}

const IntegrationPanel: React.FC<IntegrationPanelProps> = ({ projectId, onStatusChange }) => {
  const [status, setStatus] = useState<any>(null);
  const [services, setServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 3000);
    return () => clearInterval(interval);
  }, [projectId]);

  const loadStatus = async () => {
    try {
      const newStatus = await appIntegration.getStatus(projectId);
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    } catch (error) {
      console.error('Status load failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const svcs = appIntegration.getServices();
    setServices(svcs);
  }, []);

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  }

  const progressPercent = status?.progress || 0;

  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px',
      fontFamily: 'monospace',
      fontSize: '12px',
    }}>
      <div style={{ marginBottom: '12px', fontWeight: 'bold', color: '#00ff41' }}>
        ⚙️ INTEGRATION STATUS
      </div>
      <div style={{ marginBottom: '8px', color: '#aaa' }}>
        Status: <span style={{ color: '#00ff41' }}>{status?.status?.toUpperCase()}</span>
      </div>
      <div style={{
        backgroundColor: '#222',
        border: '1px solid #333',
        borderRadius: '4px',
        height: '24px',
        marginBottom: '8px',
        overflow: 'hidden',
      }}>
        <div style={{
          backgroundColor: '#00ff41',
          width: `${progressPercent}%`,
          height: '100%',
          transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ marginBottom: '8px', color: '#aaa' }}>
        Phase: <span style={{ color: '#0ff' }}>{status?.currentPhase}</span>
      </div>
      <div style={{ marginBottom: '12px', paddingTop: '8px', borderTop: '1px solid #333' }}>
        <div style={{ marginBottom: '6px', color: '#00ff41' }}>SERVICES ({services.length})</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          {services.map(s => (
            <div key={s} style={{ fontSize: '10px', color: '#0f0', padding: '4px' }}>✓ {s}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IntegrationPanel;
