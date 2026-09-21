import DatabaseApp from '../App.jsx';

export default function DatabaseOverviewPage({
  initialView = 'home',
  language,
  onLanguageChange,
  onNavigate,
}) {
  return (
    <DatabaseApp
      initialView={initialView}
      embedded
      language={language}
      onLanguageChange={onLanguageChange}
      onNavigate={onNavigate}
    />
  );
}
