import ShimadzuAnalysisPage from '../components/shimadzu/ShimadzuAnalysisPage.jsx';

export default function DataProcessingPage({ language, theme, onNavigate }) {
  return (
    <ShimadzuAnalysisPage
      embedded
      language={language}
      theme={theme}
      onNavigate={onNavigate}
    />
  );
}
