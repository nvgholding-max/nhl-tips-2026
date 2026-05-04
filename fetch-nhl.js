const https = require('https');
const fs = require('fs');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' } }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('JSON parse failed: ' + data.slice(0,200))); }
      });
    }).on('error', reject);
  });
}

async function main() {
  const bracket = await get('https://api-web.nhle.com/v1/playoff-bracket/2026');

  // API returns flat series array with playoffRound field — group by round
  const allSeries = bracket.series || [];
  const byRound = {};
  allSeries.forEach(s => {
    const r = s.playoffRound || 1;
    if (!byRound[r]) byRound[r] = [];
    byRound[r].push(s);
  });

  const out = { rounds: [], lastUpdated: new Date().toISOString() };

  [1, 2, 3, 4].forEach(r => {
    const seriesList = byRound[r] || [];
    const series = seriesList.map(s => {
      const t1 = s.topSeedTeam?.commonName?.default || '?';
      const t2 = s.bottomSeedTeam?.commonName?.default || '?';
      const w1 = s.topSeedWins || 0;
      const w2 = s.bottomSeedWins || 0;
      const winner = w1 === 4 ? t1 : w2 === 4 ? t2 : null;
      return { t1, t2, w1, w2, winner, totalGames: w1 + w2 };
    });
    out.rounds.push({ round: r, series });
  });

  console.log('Rounds parsed:', out.rounds.map((r,i) => `R${i+1}: ${r.series.length} series`).join(', '));
  out.rounds.forEach((r, ri) => {
    r.series.forEach(s => {
      console.log(`  R${ri+1}: ${s.t1} ${s.w1}-${s.w2} ${s.t2}${s.winner ? ' → ' + s.winner : ''}`);
    });
  });

  fs.writeFileSync('data.json', JSON.stringify(out, null, 2));
  console.log('Done:', new Date().toISOString());
}

main().catch(e => { console.error(e); process.exit(1); });
