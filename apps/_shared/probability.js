// Shared probability helpers for PTCG Tools (hypergeometric)
(function () {
  function logFactorial(n) {
    // Stirling approximation not needed for small n (<= 60), do exact sum.
    let s = 0;
    for (let i = 2; i <= n; i++) s += Math.log(i);
    return s;
  }

  function logChoose(n, k) {
    if (k < 0 || k > n) return -Infinity;
    return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
  }

  function hypergeomPMF(N, K, n, k) {
    if (N <= 0 || K < 0 || n < 0) return 0;
    if (k < 0 || k > K || k > n) return 0;
    if (n > N) return 0;
    const logP = logChoose(K, k) + logChoose(N - K, n - k) - logChoose(N, n);
    return Math.exp(logP);
  }

  function distribution(N, K, n) {
    const maxK = Math.min(K, n);
    const out = [];
    for (let k = 0; k <= maxK; k++) out.push({ k, p: hypergeomPMF(N, K, n, k) });
    // Normalize (floating error safety)
    const sum = out.reduce((a, r) => a + r.p, 0);
    if (sum > 0) out.forEach(r => r.p = r.p / sum);
    return out;
  }

  function pAtLeastOne(N, K, n) {
    return 1 - hypergeomPMF(N, K, n, 0);
  }

  function expected(N, K, n) {
    if (N <= 0) return 0;
    return n * (K / N);
  }

  window.PTCGProb = { hypergeomPMF, distribution, pAtLeastOne, expected };
})();