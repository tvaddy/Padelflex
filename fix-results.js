const fs = require('fs');
const files = ['components/TournamentView.tsx', 'components/StandaloneMatchView.tsx', 'components/LeaguesView.tsx', 'components/HistoryView.tsx'];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/import dynamic from 'next\/dynamic';\nconst ResultCardModal = dynamic\(\(\) => import\('\.\/ResultCardModal'\), \{ ssr: false \}\);/g, '');
  content = content.replace(/<ResultCardModal[^>]*>/g, '{/* ResultCardModal */}');
  fs.writeFileSync(file, content);
}
