const HISTORY_WINDOWS = 10;
const BASELINE_WINDOW_MS = 60_000;
const THRESHOLD_MULTIPLIER = 2.5;
const MIN_SAMPLES = 3;

class SlowBurnDetector {
  constructor() {
    this.histories = new Map();
  }

  _key(prefix, id) {
    return `${prefix}:${id}`;
  }

  record(prefix, id, now = Date.now()) {
    const key = this._key(prefix, id);
    let history = this.histories.get(key);
    if (!history) {
      history = { slots: [], updatedAt: now };
      this.histories.set(key, history);
    }

    const slot = Math.floor(now / BASELINE_WINDOW_MS);
    const existing = history.slots.find(s => s.slot === slot);
    if (existing) {
      existing.count += 1;
    } else {
      history.slots.push({ slot, count: 1 });
    }
    history.updatedAt = now;

    const cutoff = slot - HISTORY_WINDOWS;
    history.slots = history.slots.filter(s => s.slot >= cutoff);
  }

  check(prefix, id, now = Date.now()) {
    const key = this._key(prefix, id);
    const history = this.histories.get(key);
    if (!history || history.slots.length < MIN_SAMPLES) return { flagged: false, reason: null };

    const slot = Math.floor(now / BASELINE_WINDOW_MS);
    const recent = history.slots.filter(s => s.slot >= slot - 2);
    const baseline = history.slots.filter(s => s.slot < slot - 2);

    if (recent.length === 0 || baseline.length < MIN_SAMPLES) return { flagged: false, reason: null };

    const recentAvg = recent.reduce((a, s) => a + s.count, 0) / recent.length;
    const baselineAvg = baseline.reduce((a, s) => a + s.count, 0) / baseline.length;

    if (baselineAvg < 1) return { flagged: false, reason: null };

    const ratio = recentAvg / baselineAvg;
    if (ratio >= THRESHOLD_MULTIPLIER) {
      return { flagged: true, reason: `slow-burn detected: recent ${recentAvg.toFixed(1)} vs baseline ${baselineAvg.toFixed(1)} (ratio ${ratio.toFixed(2)})` };
    }

    return { flagged: false, reason: null };
  }

  sweep(now = Date.now()) {
    const cutoff = now - HISTORY_WINDOWS * BASELINE_WINDOW_MS;
    for (const [key, history] of this.histories) {
      if (history.updatedAt < cutoff) {
        this.histories.delete(key);
      }
    }
  }
}

module.exports = SlowBurnDetector;
