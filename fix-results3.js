const fs = require('fs');
const files = ['components/TournamentView.tsx', 'components/StandaloneMatchView.tsx', 'components/LeaguesView.tsx', 'components/HistoryView.tsx'];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\{resultCard[^]*?\(\s*\{[^]*?ResultCardModal[^]*?\/>\s*\)\}/g, '');
  fs.writeFileSync(file, content);
}
