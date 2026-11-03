const fs = require('fs');
const files = ['components/TournamentView.tsx', 'components/StandaloneMatchView.tsx', 'components/LeaguesView.tsx', 'components/HistoryView.tsx'];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes("import ResultCardModal from './ResultCardModal';")) {
    content = content.replace("import ResultCardModal from './ResultCardModal';", `import dynamic from 'next/dynamic';\nconst ResultCardModal = dynamic(() => import('./ResultCardModal'), { ssr: false });`);
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
}
