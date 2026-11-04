let results;
const byId = (id) => document.getElementById(id);
function render() {
  const metric = byId('metric').value;
  byId('chart').replaceChildren();
  const rows = results.rows.filter((r) => r.policyLeaves === 3);
  const max = Math.max(
    ...rows.map((r) => r[`abe${metric}`].meanMs),
    ...rows.map((r) => r[`baseline${metric}`].meanMs),
  );
  for (const row of rows) {
    const section = document.createElement('div');
    section.className = 'chart-row';
    for (const [mode, name] of [
      ['baseline', 'Normal'],
      ['abe', 'ABE'],
    ]) {
      const label = document.createElement('p');
      label.className = 'bar-label';
      const value = row[`${mode}${metric}`].meanMs;
      label.textContent = `${row.inputBytes / 1024} KB · ${name}: ${value.toFixed(3)} ms`;
      const bar = document.createElement('div');
      bar.className = `bar ${mode === 'abe' ? 'abe' : 'normal'}`;
      bar.style.width = `${Math.max(0.3, (value / max) * 100)}%`;
      section.append(label, bar);
    }
    byId('chart').append(section);
  }
}
(async () => {
  try {
    const response = await fetch('/results/benchmark.json');
    if (!response.ok) throw Error('Run npm run benchmark to generate measurements.');
    results = await response.json();
    byId('measurement').textContent =
      `Measured ${new Date(results.measuredAt).toLocaleString()} · ${results.os}/${results.architecture} · ${results.runtime} · ${results.repetitions} repetitions after ${results.warmups} warmups.`;
    for (const r of results.rows) {
      const tr = document.createElement('tr');
      for (const value of [
        `${r.inputBytes / 1024} KB`,
        r.policyLeaves,
        ...['baselineEncrypt', 'abeEncrypt', 'baselineDecrypt', 'abeDecrypt'].map(
          (k) => `${r[k].meanMs.toFixed(3)} ms`,
        ),
        `${r.baselineStoredBytes} / ${r.abeStoredBytes}`,
      ]) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.append(td);
      }
      byId('results').append(tr);
    }
    render();
    byId('metric').onchange = render;
  } catch (e) {
    byId('measurement').textContent = e.message;
  }
})();
