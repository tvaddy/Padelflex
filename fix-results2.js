const fs = require('fs');
const files = ['components/TournamentView.tsx', 'components/StandaloneMatchView.tsx', 'components/LeaguesView.tsx', 'components/HistoryView.tsx'];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\{\/\* ResultCardModal \*\/\} [^\/]+\/>/g, '');
  content = content.replace(/\{\/\* ResultCardModal \*\/\} .*?\/>/gs, '');
  fs.writeFileSync(file, content);
}
