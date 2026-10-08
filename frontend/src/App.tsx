import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { TaskCoordinator } from './components/TaskCoordinator';
import { AnnotationWorkbench } from './components/AnnotationWorkbench';
import { AgreementDashboard } from './components/AgreementDashboard';
import { ReconciliationQueue } from './components/ReconciliationQueue';
import { EvaluationSection } from './components/EvaluationSection';
import { AuditTrailView } from './components/AuditTrailView';
import { Task } from './types/api';

export const MainContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('tasks');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main style={{ flex: 1, paddingBottom: '3rem' }}>
        {activeTab === 'tasks' && (
          <TaskCoordinator
            selectedTaskId={selectedTask?.id || null}
            onSelectTask={(t) => {
              setSelectedTask(t);
            }}
          />
        )}
        {activeTab === 'workbench' && (
          <AnnotationWorkbench task={selectedTask} />
        )}
        {activeTab === 'agreement' && (
          <AgreementDashboard task={selectedTask} />
        )}
        {activeTab === 'reconcile' && (
          <ReconciliationQueue task={selectedTask} />
        )}
        {activeTab === 'evaluation' && (
          <EvaluationSection />
        )}
        {activeTab === 'audit' && (
          <AuditTrailView />
        )}
      </main>

      <footer style={{ borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', padding: '1rem 1.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Annotation Agreement Studio &bull; Developed by <strong>Ryan Vo</strong> (&lt;ryandtvo@gmail.com&gt;) &bull; NLP Agreement &amp; Adjudication Engine
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
};

export default App;
