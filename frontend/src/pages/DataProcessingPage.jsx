import ShimadzuAnalysisPage from '../components/shimadzu/ShimadzuAnalysisPage.jsx';

export default function DataProcessingPage({ language, theme, onNavigate, processingView = 'new', selectedTaskId = '', onProcessingNavigate }) {
  return (
    <ShimadzuAnalysisPage
      embedded
      language={language}
      theme={theme}
      onNavigate={onNavigate}
      processingView={processingView}
      selectedTaskId={selectedTaskId}
      onProcessingNavigate={onProcessingNavigate}
    />
  );
}
