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
    <header className="navbar">
      <div className="navbar-inner">
        <div className="navbar-brand">
          <div className="navbar-logo">
            <Shield size={20} />
          </div>
          <div>
            <h1 className="navbar-title">Annotation Agreement Studio</h1>
            <p className="navbar-subtitle">Ryan Vo | AI &amp; Machine Learning</p>
          </div>
        </div>

        <div className="navbar-actions">
          {isDemoMode && (
            <div className="role-selector">
              <span className="role-label">Role:</span>
              {(['viewer', 'analyst', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => loginDemo(r)}
                  className={`role-btn ${role === r ? 'role-btn-active' : 'role-btn-inactive'}`}
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
            <button onClick={() => logout()} title="Logout" className="logout-btn">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>

      <nav className="tab-nav">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`tab-btn ${activeTab === t.id ? 'tab-btn-active' : 'tab-btn-inactive'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  );
};
