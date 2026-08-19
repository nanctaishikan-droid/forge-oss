import { spawn } from 'node:child_process';
import { PRESETS, toneParameters } from './public/audio-settings.js';

export { PRESETS };

const SETTING_RANGES = Object.freeze({
  focus: [0, 100],
  warmth: [0, 100],
  clarity: [0, 100],
  air: [0, 100],
  punch: [0, 100],
  width: [0, 100],
  drive: [0, 100],
  eqBass: [-6, 6],
  eqLowMid: [-6, 6],
  eqMid: [-6, 6],
  eqPresence: [-6, 6],
  eqAir: [-6, 6],
  targetLufs: [-14, -8],
  truePeak: [-2, -0.5],
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function fixed(value, digits = 3) {
  return Number(value).toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

export function normalizeSettings(input = {}) {
  const base = PRESETS.natural;
  return Object.fromEntries(Object.entries(SETTING_RANGES).map(([key, [min, max]]) => {
    const candidate = Number(input[key]);
    const value = Number.isFinite(candidate) ? candidate : base[key];
    return [key, clamp(value, min, max)];
  }));
}

export function focusParameters(
  rawFocus = PRESETS.natural.focus,
  { inputLufs = -14, strengthScale = 1 } = {},
) {
  const focus = clamp(Number(rawFocus) || 0, 0, 100);
  const strength = (focus / 100) * clamp(Number(strengthScale) || 0, 0, 1);
  const sourceLufs = clamp(Number.isFinite(Number(inputLufs)) ? Number(inputLufs) : -14, -40, -5);
  return {
    focus,
    strength,
    sourceLufs,
    ratio: 1.1 + strength * 0.6,
    spectralCapDb: 0.4 + strength * 2.6,
    attackMs: 45 - strength * 20,
    releaseMs: 75 - strength * 30,
    baseThresholdDb: sourceLufs - (18 + strength * 8),
  };
}

export function buildFocusFilter(rawFocus, options = {}) {
  const parameters = focusParameters(rawFocus, options);
  if (parameters.focus <= 0) return '';

  const threshold = `${fixed(parameters.baseThresholdDb)}-3*log(max(f,100)/100)/log(2)`;
  const compressed = `${threshold}+(p-(${threshold}))/${fixed(parameters.ratio)}`;
  const transfer = [
    'if(between(f,90,16000)',
    `if(gt(p,${threshold})`,
    `max(p-${fixed(parameters.spectralCapDb)},${compressed})`,
    'p)',
    'p)',
  ].join(',');
  const channels = options.channels ? `:channels=${options.channels}` : '';

  return `adrc=transfer='${transfer}':attack=${fixed(parameters.attackMs)}:release=${fixed(parameters.releaseMs)}${channels}`;
}

export function buildToneChain(rawSettings, { channels = 2, inputLufs = -14 } = {}) {
  const settings = normalizeSettings(rawSettings);
  const { warmthGain, bodyCut, presenceGain, airGain, exciterAmount } = toneParameters(settings);
  const punchStrength = settings.punch / 100;
  const compressorThresholdDb = -10 - punchStrength * 4;
  const compressorThreshold = Math.pow(10, compressorThresholdDb / 20);
  const compressorRatio = 1 + punchStrength * 0.55;
  const compressorAttack = 35 - punchStrength * 8;
  const compressorRelease = 210 - punchStrength * 60;
  const compressorMix = 0.2 + punchStrength * 0.25;
  const clipThreshold = 1 - (settings.drive / 100) * 0.16;
  const clipParam = 0.9 + (settings.drive / 100) * 0.65;
  const filters = [
    'highpass=f=25:p=2',
    `bass=g=${fixed(warmthGain)}:f=155:w=0.65`,
    `equalizer=f=360:t=q:w=0.8:g=${fixed(bodyCut)}`,
    `equalizer=f=2850:t=q:w=0.9:g=${fixed(presenceGain)}`,
    `treble=g=${fixed(airGain)}:f=8500:w=0.55`,
    `bass=g=${fixed(settings.eqBass)}:f=80:w=0.7`,
    `equalizer=f=250:t=q:w=0.8:g=${fixed(settings.eqLowMid)}`,
    `equalizer=f=1000:t=q:w=0.9:g=${fixed(settings.eqMid)}`,
    `equalizer=f=4000:t=q:w=0.9:g=${fixed(settings.eqPresence)}`,
    `treble=g=${fixed(settings.eqAir)}:f=12000:w=0.6`,
  ];

  if (settings.focus > 0 && channels === 2) {
    filters.push(
      'stereotools=mode=lr>ms',
      buildFocusFilter(settings.focus, { inputLufs, channels: 'FL' }),
      buildFocusFilter(settings.focus, { inputLufs, channels: 'FR', strengthScale: 0.62 }),
      'stereotools=mode=ms>lr',
    );
  } else {
    const focusFilter = buildFocusFilter(settings.focus, { inputLufs });
    if (focusFilter) filters.push(focusFilter);
  }

  if (exciterAmount > 0.05) {
    filters.push(`aexciter=amount=${fixed(exciterAmount)}:drive=3.2:blend=0.16:freq=6500:ceil=18000`);
  }

  if (settings.punch > 0) {
    filters.push(
      `acompressor=threshold=${fixed(compressorThreshold, 6)}:ratio=${fixed(compressorRatio)}:attack=${fixed(compressorAttack)}:release=${fixed(compressorRelease)}:makeup=1:knee=3:link=maximum:detection=rms:mix=${fixed(compressorMix)}`,
    );
  }

  if (channels === 2 && settings.width > 0) {
    const widthMultiplier = 1 + (settings.width / 100) * 0.36;
    filters.push(`extrastereo=m=${fixed(widthMultiplier)}:c=0`);
  }

  if (settings.drive > 2) {
    filters.push(`asoftclip=type=tanh:threshold=${fixed(clipThreshold)}:output=0.98:param=${fixed(clipParam)}:oversample=4`);
  }

  filters.push('aresample=osr=48000:filter_size=64:phase_shift=10:cutoff=0.97:dither_method=triangular_hp');
  return filters.join(',');
}

export function parseLoudnormJson(stderr) {
  const matches = String(stderr).match(/\{\s*"input_i"[\s\S]*?\}/g);
  if (!matches?.length) throw new Error('ラウドネス解析結果を読み取れませんでした。');
  return JSON.parse(matches.at(-1));
}

function run(command, args, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.length > 2_000_000) stderr = stderr.slice(-1_000_000);
      onProgress?.(chunk);
    });
    child.on('error', (error) => reject(new Error(`${command} を起動できません: ${error.message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve({ stderr });
      else reject(new Error(`${command} が終了コード ${code} で停止しました。\n${stderr.slice(-2400)}`));
    });
  });
}

export async function probeAudio(inputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_name,sample_rate,channels,channel_layout,bit_rate:format=duration,bit_rate,format_name',
      '-of', 'json',
      inputPath,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`音声情報を取得できません。${stderr}`));
      try {
        const data = JSON.parse(stdout);
        const stream = data.streams?.[0];
        if (!stream) return reject(new Error('音声トラックが見つかりません。'));
        resolve({
          codec: stream.codec_name || 'unknown',
          sampleRate: Number(stream.sample_rate) || null,
          channels: Number(stream.channels) || 1,
          channelLayout: stream.channel_layout || '',
          bitRate: Number(stream.bit_rate || data.format?.bit_rate) || null,
          duration: Number(data.format?.duration) || 0,
          format: data.format?.format_name || '',
        });
      } catch (error) {
        reject(new Error(`音声情報の解析に失敗しました: ${error.message}`));
      }
    });
  });
}

export async function analyzeLoudness(inputPath) {
  const { stderr } = await run('ffmpeg', [
    '-hide_banner', '-nostats', '-i', inputPath,
    '-map', '0:a:0',
    '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json',
    '-f', 'null', '-',
  ]);
  const values = parseLoudnormJson(stderr);
  return {
    integratedLufs: Number(values.input_i),
    truePeakDb: Number(values.input_tp),
    loudnessRange: Number(values.input_lra),
    threshold: Number(values.input_thresh),
  };
}

function loudnormAnalysisFilter(settings) {
  return `loudnorm=I=${fixed(settings.targetLufs)}:TP=${fixed(settings.truePeak)}:LRA=8:print_format=json`;
}

// loudnormは目標LRAが実測LRAより小さいと linear=true を無視して動的モードに落ち、
// 音色・ダイナミクスが大きく変わる。目標LRAは実測+1へ追従させる（フィルタ上限20でクランプ）。
export function loudnessRangeTarget(measuredLra) {
  const lra = Number(measuredLra);
  if (!Number.isFinite(lra)) return 8;
  return clamp(Math.ceil(lra) + 1, 8, 20);
}

function loudnormRenderFilter(settings, measured) {
  const finite = ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset']
    .every((key) => Number.isFinite(Number(measured[key])));
  if (!finite) throw new Error('入力音源が無音、またはラウドネスを測定できませんでした。');
  return [
    `loudnorm=I=${fixed(settings.targetLufs)}`,
    `TP=${fixed(settings.truePeak)}`,
    `LRA=${fixed(loudnessRangeTarget(measured.input_lra))}`,
    `measured_I=${measured.input_i}`,
    `measured_TP=${measured.input_tp}`,
    `measured_LRA=${measured.input_lra}`,
    `measured_thresh=${measured.input_thresh}`,
    `offset=${measured.target_offset}`,
    'linear=true',
    'print_format=summary',
  ].join(':');
}

export function parseNormalizationType(stderr) {
  const match = String(stderr).match(/Normalization Type:\s*(\w+)/i);
  return match ? match[1].toLowerCase() : null;
}

// 動的モードへ落ちた場合の保険: 定数ゲインだけの正規化（linearモードと同じ意味論）。
// 目標LUFSとTrue Peak余裕の小さい方までしか上げないので、リミッターなしでTPを守れる。
export function linearFallbackGainDb(settings, measured) {
  const gainToTarget = settings.targetLufs - Number(measured.input_i);
  const gainToTruePeak = settings.truePeak - Number(measured.input_tp);
  return Math.min(gainToTarget, gainToTruePeak);
}

export async function renderMaster({
  inputPath,
  wavPath,
  settings: rawSettings,
  metadata,
  inputLufs = -14,
}) {
  const settings = normalizeSettings(rawSettings);
  const toneChain = buildToneChain(settings, { ...metadata, inputLufs });
  const firstPass = await run('ffmpeg', [
    '-hide_banner', '-nostats', '-i', inputPath,
    '-map', '0:a:0',
    '-af', `${toneChain},${loudnormAnalysisFilter(settings)}`,
    '-f', 'null', '-',
  ]);
  const measured = parseLoudnormJson(firstPass.stderr);

  const secondPass = await run('ffmpeg', [
    '-hide_banner', '-nostats', '-y', '-i', inputPath,
    '-map', '0:a:0', '-vn',
    '-af', `${toneChain},${loudnormRenderFilter(settings, measured)}`,
    '-ar', '48000', '-c:a', 'pcm_s24le',
    wavPath,
  ]);

  // linear=true指定でもLRAやTrue Peakの都合で動的モードへ落ちることがある。
  // その場合は音色が変わるため、定数ゲインのみで作り直す（0=ニュートラル契約の担保）。
  let normalization = parseNormalizationType(secondPass.stderr) || 'linear';
  if (normalization === 'dynamic') {
    const gainDb = linearFallbackGainDb(settings, measured);
    await run('ffmpeg', [
      '-hide_banner', '-nostats', '-y', '-i', inputPath,
      '-map', '0:a:0', '-vn',
      '-af', `${toneChain},volume=${fixed(gainDb)}dB`,
      '-ar', '48000', '-c:a', 'pcm_s24le',
      wavPath,
    ]);
    normalization = 'linear-gain';
  }

  return { settings, measured, normalization };
}
