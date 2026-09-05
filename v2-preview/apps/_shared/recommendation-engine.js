(() => {
  'use strict';

  const DEFAULTS = Object.freeze({ priorGames:12, fullQualityGames:20, closeCallPp:2, onlineScope:'30', irlScope:'all-irl' });
  const usableName = value => globalThis.PTCGMetaField?.isUsableName?.(value) ?? (!!String(value || '').trim() && value !== 'Other' && value !== 'Unknown');
  const clamp = (min, max, value) => Math.min(max, Math.max(min, value));

  function evidenceRows(input) {
    if (Array.isArray(input)) return input;
    return Array.isArray(input?.matchups) ? input.matchups : [];
  }

  function evidenceIndex(rows) {
    const index = new Map();
    for (const row of evidenceRows(rows)) {
      const a=String(row?.a || '').trim(), b=String(row?.b || '').trim();
      if (!usableName(a) || !usableName(b)) continue;
      const key=`${a}\u0000${b}`;
      const current=index.get(key) || { a, b, wins:0, losses:0, ties:0 };
      current.wins += Math.max(0, Number(row.wins || 0));
      current.losses += Math.max(0, Number(row.losses || 0));
      current.ties += Math.max(0, Number(row.ties || 0));
      index.set(key, current);
    }
    return index;
  }

  function lookup(index, candidate, opponent) {
    const direct=index.get(`${candidate}\u0000${opponent}`);
    if (direct) return { ...direct, games:direct.wins + direct.losses + direct.ties, reversed:false };
    const reverse=index.get(`${opponent}\u0000${candidate}`);
    if (!reverse) return null;
    return { a:candidate, b:opponent, wins:reverse.losses, losses:reverse.wins, ties:reverse.ties, games:reverse.wins + reverse.losses + reverse.ties, reversed:true };
  }

  function combineMatches(matches, candidate, opponent) {
    const valid=matches.filter(Boolean);
    if (!valid.length) return null;
    return valid.reduce((out, row) => ({
      ...out,
      wins:out.wins + row.wins,
      losses:out.losses + row.losses,
      ties:out.ties + row.ties,
      games:out.games + row.games,
    }), { a:candidate, b:opponent, wins:0, losses:0, ties:0, games:0 });
  }

  function adjustedRate(match, priorGames = DEFAULTS.priorGames) {
    const decisive=Number(match?.wins || 0) + Number(match?.losses || 0);
    if (!match || decisive <= 0) return null;
    return 100 * (Number(match.wins || 0) + priorGames / 2) / (decisive + priorGames);
  }

  function sourceProfile(candidate, field, index, options) {
    let weighted=0, coverage=0, quality=0, decisiveGames=0;
    for (const opponent of field) {
      const match=lookup(index, candidate, opponent.name);
      const decisive=Number(match?.wins || 0) + Number(match?.losses || 0);
      if (!match || decisive <= 0) continue;
      const estimate=adjustedRate(match, options.priorGames);
      coverage += opponent.share;
      weighted += opponent.share * estimate;
      quality += opponent.share * Math.min(1, decisive / options.fullQualityGames);
      decisiveGames += decisive;
    }
    return { estimate:coverage ? weighted / coverage : null, coverage, quality, decisiveGames };
  }

  function evidenceLevel(coverage, quality) {
    if (coverage < 0.5 || quality < 0.25) return { key:'insufficient', label:'Insufficient evidence', decisionReady:false };
    if (coverage >= 0.85 && quality >= 0.70) return { key:'strong', label:'Strong evidence', decisionReady:true };
    if (coverage >= 0.70 && quality >= 0.45) return { key:'moderate', label:'Moderate evidence', decisionReady:true };
    return { key:'weak', label:'Weak evidence', decisionReady:false };
  }

  function candidateNames(candidates, evidence) {
    const names=new Set();
    for (const candidate of candidates || []) {
      const name=String(typeof candidate === 'string' ? candidate : candidate?.name || '').trim();
      if (usableName(name)) names.add(name);
    }
    if (!names.size) {
      for (const source of ['online', 'irl']) for (const row of evidenceRows(evidence?.[source])) if (usableName(row?.a)) names.add(row.a);
    }
    return [...names];
  }

  function analyseCandidate(name, field, indexes, matchupSource, options, candidateInfo) {
    const matchups=[];
    let weighted=0, coverage=0, quality=0, decisiveGames=0, ties=0, favourableExposure=0, badExposure=0;
    for (const opponent of field) {
      const online=lookup(indexes.online, name, opponent.name);
      const irl=lookup(indexes.irl, name, opponent.name);
      const selected=matchupSource === 'online' ? online : matchupSource === 'irl' ? irl : combineMatches([online, irl], name, opponent.name);
      const decisive=Number(selected?.wins || 0) + Number(selected?.losses || 0);
      if (!selected || decisive <= 0) {
        matchups.push({ opponent:opponent.name, share:opponent.share, known:false, estimate:null, observed:null, decisiveGames:0, ties:Number(selected?.ties || 0), quality:0, contribution:null, sources:{ online, irl } });
        continue;
      }
      const estimate=adjustedRate(selected, options.priorGames);
      const observed=100 * selected.wins / decisive;
      const sampleQuality=Math.min(1, decisive / options.fullQualityGames);
      coverage += opponent.share;
      quality += opponent.share * sampleQuality;
      weighted += opponent.share * estimate;
      decisiveGames += decisive;
      ties += Number(selected.ties || 0);
      if (estimate >= 55) favourableExposure += opponent.share;
      if (estimate <= 45) badExposure += opponent.share;
      matchups.push({ opponent:opponent.name, share:opponent.share, known:true, estimate, observed, decisiveGames:decisive, ties:Number(selected.ties || 0), quality:sampleQuality, contribution:null, sources:{ online, irl } });
    }
    const expectedWR=coverage ? weighted / coverage : null;
    for (const matchup of matchups) if (matchup.known) matchup.contribution=(matchup.share / coverage) * (matchup.estimate - 50);
    const helpers=matchups.filter(row => row.known && row.contribution > 0).sort((a,b) => b.contribution-a.contribution).slice(0,3);
    const hurts=matchups.filter(row => row.known && row.contribution < 0).sort((a,b) => a.contribution-b.contribution).slice(0,3);
    const unknownShare=clamp(0, 1, 1-coverage);
    const level=evidenceLevel(coverage, quality);
    const onlineProfile=sourceProfile(name, field, indexes.online, options);
    const irlProfile=sourceProfile(name, field, indexes.irl, options);
    const split=Number.isFinite(onlineProfile.estimate) && Number.isFinite(irlProfile.estimate) ? Math.abs(onlineProfile.estimate-irlProfile.estimate) : null;
    const sourceDisagreement=matchupSource === 'combined' && onlineProfile.coverage >= 0.5 && irlProfile.coverage >= 0.5 && Number.isFinite(split) && split >= 5;
    return {
      ...(candidateInfo || {}), name, expectedWR, coverage, unknownShare, evidenceQuality:quality,
      evidenceLevel:level.key, evidenceLabel:level.label, decisionReady:level.decisionReady,
      decisiveGames, ties, favourableExposure, badExposure,
      polarised:favourableExposure >= 0.15 && badExposure >= 0.15,
      sourceDisagreement, sourceGap:Number.isFinite(split) ? split : null,
      sourceProfiles:{ online:onlineProfile, irl:irlProfile }, matchups, helpers, hurts,
    };
  }

  function analyse(input = {}) {
    const options={ ...DEFAULTS, ...(input.options || {}) };
    const field=globalThis.PTCGMetaField?.normalizeRows?.(input.fieldRows || []) || [];
    const evidence=input.evidence || {};
    const indexes={ online:evidenceIndex(evidence.online), irl:evidenceIndex(evidence.irl) };
    const matchupSource=['online','irl','combined'].includes(input.matchupSource) ? input.matchupSource : 'combined';
    const byName=new Map((input.candidates || []).filter(row => typeof row === 'object').map(row => [String(row.name || '').trim(), row]));
    const all=candidateNames(input.candidates, evidence)
      .map(name => analyseCandidate(name, field, indexes, matchupSource, options, byName.get(name)))
      .filter(row => Number.isFinite(row.expectedWR))
      .sort((a,b) => b.expectedWR-a.expectedWR || b.coverage-a.coverage || b.evidenceQuality-a.evidenceQuality || a.name.localeCompare(b.name));
    const ranked=all.filter(row => row.decisionReady);
    ranked.forEach((row, index) => { row.rank=index+1; row.gapFromLeader=index ? ranked[0].expectedWR-row.expectedWR : 0; });
    const lowerEvidence=all.filter(row => !row.decisionReady);
    const top=ranked[0] || null, runnerUp=ranked[1] || null;
    const gap=top && runnerUp ? top.expectedWR-runnerUp.expectedWR : null;
    const closeCall=Number.isFinite(gap) && gap < options.closeCallPp;
    let state='insufficient';
    if (top) state=closeCall ? 'close' : runnerUp && top.evidenceLevel === 'strong' && !top.sourceDisagreement ? 'strong' : 'leading';
    else if (lowerEvidence.some(row => row.evidenceLevel === 'weak')) state='promising';
    return { field, matchupSource, ranked, lowerEvidence, all, top, runnerUp, gap, closeCall, state, options };
  }

  globalThis.PTCGRecommendation = { DEFAULTS, evidenceIndex, lookup, adjustedRate, evidenceLevel, analyse };
})();
