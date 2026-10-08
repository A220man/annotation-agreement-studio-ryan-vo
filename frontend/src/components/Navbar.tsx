import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, User as UserIcon, LogOut } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { user, role, loginDemo, logout, isDemoMode } = useAuth();

  const tabs = [
    { id: 'tasks', label: 'Tasks' },
    { id: 'workbench', label: 'Workbench' },
    { id: 'agreement', label: 'Agreement' },
    { id: 'reconcile', label: 'Adjudication' },
    { id: 'evaluation', label: 'Evaluation' },
    { id: 'audit', label: 'Audit Log' },
  ];

  return (
    <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0.6rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ padding: '0.4rem', background: 'rgba(56,189,248,0.1)', borderRadius: '0.4rem', color: 'var(--primary)' }}>
            <Shield size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: '700' }}>Annotation Agreement Studio</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ryan Vo | AI &amp; Machine Learning</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {isDemoMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--bg-subtle)', padding: '0.2rem 0.4rem', borderRadius: '0.375rem', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Role:</span>
              {(['viewer', 'analyst', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => loginDemo(r)}
                  style={{
                    fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '0.2rem',
                    background: role === r ? 'var(--primary)' : 'transparent',
                    color: role === r ? '#0f172a' : 'var(--text-muted)',
                    fontWeight: role === r ? '600' : '400',
                  }}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className={`badge ${role === 'admin' ? 'badge-danger' : role === 'analyst' ? 'badge-primary' : 'badge-warning'}`}>
              <UserIcon size={12} style={{ marginRight: '3px' }} />{user?.name || role}
            </span>
            <button onClick={() => logout()} title="Logout" style={{ background: 'transparent', color: 'var(--text-muted)', padding: '0.3rem' }}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>

      <nav style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem', display: 'flex', gap: '0.4rem', overflowX: 'auto' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '0.5rem 0.85rem', fontSize: '0.85rem', fontWeight: '500',
              borderBottom: activeTab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === t.id ? 'var(--primary)' : 'var(--text-muted)', background: 'transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  );
};
