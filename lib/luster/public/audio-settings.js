export const PRESETS = Object.freeze({
  natural: Object.freeze({
    focus: 48, warmth: 0, clarity: 0, air: 0, punch: 0, width: 0, drive: 0,
    eqBass: 0, eqLowMid: 0, eqMid: 0, eqPresence: 0, eqAir: 0,
    targetLufs: -12, truePeak: -1,
  }),
  loud: Object.freeze({
    focus: 55, warmth: 8, clarity: 4, air: 2, punch: 30, width: 4, drive: 18,
    eqBass: 0, eqLowMid: 0, eqMid: 0, eqPresence: 0, eqAir: 0,
    targetLufs: -9, truePeak: -1,
  }),
  clear: Object.freeze({
    focus: 58, warmth: 0, clarity: 22, air: 18, punch: 4, width: 12, drive: 2,
    eqBass: 0, eqLowMid: 0, eqMid: 0, eqPresence: 0, eqAir: 0,
    targetLufs: -13, truePeak: -1,
  }),
});

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizedAmount(value) {
  const number = Number(value);
  return clamp(Number.isFinite(number) ? number : 0, 0, 100) / 100;
}

export function toneParameters(settings = {}) {
  const warmth = normalizedAmount(settings.warmth);
  const clarity = normalizedAmount(settings.clarity);
  const air = normalizedAmount(settings.air);
  return {
    warmthGain: 1.5 * warmth,
    bodyCut: -0.5 * clarity,
    presenceGain: 1.3 * clarity,
    airGain: 1.0 * air,
    exciterAmount: Math.max(0, (air - 0.5) / 0.5) * 0.4,
  };
}

// Web Audio DynamicsCompressorNodeが内部で掛ける自動メイクアップゲイン（WebKit/Blink共通実装の移植）。
// しきい値が帯域ごとに違うとメイクアップ差が静的なEQティルトになるため、逆数のゲインで打ち消すために使う。
export function dynamicsCompressorMakeupGain(thresholdDb, kneeDb, ratio) {
  const dbToLin = (db) => 10 ** (db / 20);
  const linToDb = (lin) => 20 * Math.log10(lin);
  const linearThreshold = dbToLin(thresholdDb);
  const kneeThresholdDb = thresholdDb + kneeDb;
  const kneeThreshold = dbToLin(kneeThresholdDb);
  const slope = 1 / ratio;
  const kneeCurve = (x, k) => {
    if (x < linearThreshold) return x;
    return linearThreshold + (1 - Math.exp(-k * (x - linearThreshold))) / k;
  };
  const slopeAt = (x, k) => {
    if (x < linearThreshold) return 1;
    const x2 = x * 1.001;
    return (linToDb(kneeCurve(x2, k)) - linToDb(kneeCurve(x, k))) / (linToDb(x2) - linToDb(x));
  };
  let minK = 0.1;
  let maxK = 10000;
  let k = 5;
  for (let i = 0; i < 15; i += 1) {
    k = Math.sqrt(minK * maxK);
    if (slopeAt(kneeThreshold, k) < slope) maxK = k;
    else minK = k;
  }
  const ykneeThresholdDb = linToDb(kneeCurve(kneeThreshold, k));
  const saturate = (x) => (x < kneeThreshold
    ? kneeCurve(x, k)
    : dbToLin(ykneeThresholdDb + slope * (linToDb(x) - kneeThresholdDb)));
  return (1 / saturate(1)) ** 0.6;
}

export function loudnessPreviewParameters(rawTargetLufs, rawInputLufs) {
  const requestedTarget = Number(rawTargetLufs);
  const targetLufs = clamp(Number.isFinite(requestedTarget) ? requestedTarget : -12, -14, -8);
  if (rawInputLufs === null || rawInputLufs === undefined || rawInputLufs === '') {
    return { targetLufs, inputLufs: null, requestedDb: 0, gainDb: 0, gain: 1 };
  }
  const requestedInput = Number(rawInputLufs);
  if (!Number.isFinite(requestedInput)) {
    return { targetLufs, inputLufs: null, requestedDb: 0, gainDb: 0, gain: 1 };
  }

  const inputLufs = clamp(requestedInput, -40, -5);
  const requestedDb = targetLufs - inputLufs;
  const gainDb = clamp(requestedDb, -12, 12);
  return {
    targetLufs,
    inputLufs,
    requestedDb,
    gainDb,
    gain: 10 ** (gainDb / 20),
  };
}
