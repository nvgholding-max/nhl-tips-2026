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
  // Log top-level keys so we can debug structure
  const bracket = await get('https://api-web.nhle.com/v1/playoff-bracket/2026');
  console.log('Top-level keys:', Object.keys(bracket));
  console.log('Full response (first 1000 chars):', JSON.stringify(bracket).slice(0, 1000));

  const out = { rounds: [], lastUpdated: new Date().toISOString() };

  // Try different possible structures
  let roundsData = bracket.rounds || bracket.series || bracket.bracket || [];

  // If it's an object keyed by round number, convert to array
  if (!Array.isArray(roundsData) && typeof roundsData === 'object') {
    roundsData = Object.values(roundsData);
  }

  // Also try top-level series array (flat structure)
  if (!roundsData.length && bracket.series) {
    // Group by round
    const byRound = {};
    (bracket.series || []).forEach(s => {
      const r = s.round || s.roundNumber || 1;
      if (!byRound[r]) byRound[r] = [];
      byRound[r].push(s);
    });
    roundsData = Object.keys(byRound).sort().map(r => ({ round: +r, series: byRound[r] }));
  }

  roundsData.forEach((round, ri) => {
    const seriesList = round.series || round.matchups || (Array.isArray(round) ? round : []);
    const series = seriesList.map(s => {
      // Try multiple field name patterns
      const t1 = s.topSeedTeam?.commonName?.default
               || s.team1?.commonName?.default
               || s.homeTeam?.commonName?.default
               || s.topSeedTeam?.name?.default
               || s.team1?.name || '?';
      const t2 = s.bottomSeedTeam?.commonName?.default
               || s.team2?.commonName?.default
               || s.awayTeam?.commonName?.default
               || s.bottomSeedTeam?.name?.default
               || s.team2?.name || '?';
      const w1 = s.topSeedWins ?? s.team1Wins ?? s.homeWins ?? 0;
      const w2 = s.bottomSeedWins ?? s.team2Wins ?? s.awayWins ?? 0;
      const winner = w1 === 4 ? t1 : w2 === 4 ? t2 : null;
      return { t1, t2, w1, w2, winner, totalGames: w1 + w2 };
    });
    out.rounds.push({ round: ri + 1, series });
  });

  console.log('Parsed rounds:', out.rounds.length);
  fs.writeFileSync('data.json', JSON.stringify(out, null, 2));
  console.log('Done:', new Date().toISOString());
}

main().catch(e => { console.error(e); process.exit(1); });
