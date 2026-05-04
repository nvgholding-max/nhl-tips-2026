const https = require('https');
const fs = require('fs');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function main() {
  const bracket = await get('https://api-web.nhle.com/v1/playoff-bracket/2026');
  const out = { rounds: [], lastUpdated: new Date().toISOString() };

  (bracket.rounds || []).forEach((round, ri) => {
    const series = (round.series || []).map(s => {
      const t1 = s.topSeedTeam?.commonName?.default || '?';
      const t2 = s.bottomSeedTeam?.commonName?.default || '?';
      const w1 = s.topSeedWins || 0;
      const w2 = s.bottomSeedWins || 0;
      const winner = w1 === 4 ? t1 : w2 === 4 ? t2 : null;
      const topSeed = s.topSeedTeam?.seed || null;
      const botSeed = s.bottomSeedTeam?.seed || null;
      return { t1, t2, w1, w2, winner, totalGames: w1 + w2, topSeed, botSeed };
    });
    out.rounds.push({ round: ri + 1, series });
  });

  fs.writeFileSync('data.json', JSON.stringify(out, null, 2));
  console.log('Done:', new Date().toISOString());
}

main().catch(e => { console.error(e); process.exit(1); });
