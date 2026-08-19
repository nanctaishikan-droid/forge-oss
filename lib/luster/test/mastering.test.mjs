import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { dynamicsCompressorMakeupGain, loudnessPreviewParameters, toneParameters } from '../public/audio-settings.js';
import {
  PRESETS,
  analyzeLoudness,
  buildFocusFilter,
  buildToneChain,
  focusParameters,
  linearFallbackGainDb,
  loudnessRangeTarget,
  normalizeSettings,
  parseNormalizationType,
  probeAudio,
  renderMaster,
} from '../mastering.mjs';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr)));
  });
}

test('settings are clamped and the tone chain is safe for mono', () => {
  const settings = normalizeSettings({ focus: 999, warmth: 999, eqMid: 99, targetLufs: -99, truePeak: 2 });
  assert.equal(settings.focus, 100);
  assert.equal(settings.warmth, 100);
  assert.equal(settings.eqMid, 6);
  assert.equal(settings.targetLufs, -14);
  assert.equal(settings.truePeak, -0.5);
  const chain = buildToneChain(settings, { channels: 1 });
  assert.match(chain, /highpass/);
  assert.match(chain, /equalizer=f=1000:t=q:w=0.9:g=6/);
  assert.doesNotMatch(chain, /extrastereo/);
  assert.doesNotMatch(chain, /stereotools/);
});

test('Natural is neutral apart from gentle focus and target loudness', () => {
  assert.deepEqual(normalizeSettings(), PRESETS.natural);
  assert.deepEqual(PRESETS.natural, {
    focus: 48,
    warmth: 0,
    clarity: 0,
    air: 0,
    punch: 0,
    width: 0,
    drive: 0,
    eqBass: 0,
    eqLowMid: 0,
    eqMid: 0,
    eqPresence: 0,
    eqAir: 0,
    targetLufs: -12,
    truePeak: -1,
  });
  for (const preset of Object.values(PRESETS)) {
    assert.deepEqual(
      [preset.eqBass, preset.eqLowMid, preset.eqMid, preset.eqPresence, preset.eqAir],
      [0, 0, 0, 0, 0],
    );
  }
});

test('zero tone and character settings are a true bypass', () => {
  assert.deepEqual(toneParameters({ warmth: 0, clarity: 0, air: 0 }), {
    warmthGain: 0,
    bodyCut: -0,
    presenceGain: 0,
    airGain: 0,
    exciterAmount: 0,
  });
  const chain = buildToneChain({
    focus: 0, warmth: 0, clarity: 0, air: 0, punch: 0, width: 0, drive: 0,
    eqBass: 0, eqLowMid: 0, eqMid: 0, eqPresence: 0, eqAir: 0,
  }, { channels: 2 });
  assert.match(chain, /bass=g=0:f=155/);
  assert.match(chain, /equalizer=f=2850:t=q:w=0.9:g=0/);
  assert.match(chain, /treble=g=0:f=8500/);
  assert.doesNotMatch(chain, /adrc=|aexciter=|acompressor=|extrastereo=|asoftclip=/);
});

test('live loudness preview follows the target with a safe gain limit', () => {
  const plusTwo = loudnessPreviewParameters(-12, -14);
  assert.equal(plusTwo.gainDb, 2);
  assert.ok(Math.abs(plusTwo.gain - 1.258925) < 0.00001);
  assert.equal(loudnessPreviewParameters(-14, -9).gainDb, -5);
  assert.equal(loudnessPreviewParameters(-8, -30).gainDb, 12);
  assert.equal(loudnessPreviewParameters(-12, Number.NaN).gainDb, 0);
  assert.equal(loudnessPreviewParameters(-12, null).inputLufs, null);
  assert.equal(loudnessPreviewParameters(0, -14).targetLufs, -8);
});

test('focus follows source loudness, caps attenuation, and can be bypassed', () => {
  assert.equal(buildFocusFilter(0), '');
  const parameters = focusParameters(100, { inputLufs: -12 });
  const filter = buildFocusFilter(100, { inputLufs: -12 });
  assert.ok(Math.abs(parameters.ratio - 1.7) < 1e-9);
  assert.equal(parameters.spectralCapDb, 3);
  assert.equal(parameters.baseThresholdDb, -38);
  assert.match(filter, /^adrc=/);
  assert.match(filter, /between\(f,90,16000\)/);
  assert.match(filter, /log\(max\(f,100\)\/100\)\/log\(2\)/);
  assert.match(filter, /max\(p-3,/);
  assert.match(filter, /attack=25:release=45$/);
});

test('stereo focus works in mid-side and treats the side more gently', () => {
  const chain = buildToneChain({ focus: 70 }, { channels: 2, inputLufs: -11 });
  assert.match(chain, /stereotools=mode=lr>ms/);
  assert.match(chain, /channels=FL/);
  assert.match(chain, /channels=FR/);
  assert.match(chain, /stereotools=mode=ms>lr/);
  assert.equal((chain.match(/adrc=/g) || []).length, 2);
});

test('compressor auto makeup model matches WebKit behaviour and cancels the focus tilt', () => {
  // ratio=1（focus 0相当）はメイクアップほぼゼロ
  const unity = dynamicsCompressorMakeupGain(-14, 16, 1);
  assert.ok(Math.abs(20 * Math.log10(unity)) < 0.2, `unity makeup was ${unity}`);
  // しきい値が低い帯域ほどメイクアップが大きい＝補正しないと高域が持ち上がる
  const low = dynamicsCompressorMakeupGain(-14, 16, 1.388);
  const air = dynamicsCompressorMakeupGain(-28, 16, 1.388);
  assert.ok(low > 1 && air > low, `makeup was low=${low} air=${air}`);
  // peakGuard(-1dB, knee 0, ratio 20)は約+0.57dB
  const guardDb = 20 * Math.log10(dynamicsCompressorMakeupGain(-1, 0, 20));
  assert.ok(Math.abs(guardDb - 0.57) < 0.06, `guard makeup was ${guardDb}`);
});

test('loudnorm stays linear: adaptive LRA target and dynamic-mode fallback plan', () => {
  assert.equal(loudnessRangeTarget(4.2), 8);
  assert.equal(loudnessRangeTarget(11.6), 13);
  assert.equal(loudnessRangeTarget(30), 20);
  assert.equal(loudnessRangeTarget(Number.NaN), 8);
  assert.equal(parseNormalizationType('...\nNormalization Type:   Dynamic\n'), 'dynamic');
  assert.equal(parseNormalizationType('Normalization Type: Linear'), 'linear');
  assert.equal(parseNormalizationType('no summary'), null);
  const settings = normalizeSettings({ targetLufs: -12, truePeak: -1 });
  assert.equal(linearFallbackGainDb(settings, { input_i: -20, input_tp: -10 }), 8);
  assert.equal(linearFallbackGainDb(settings, { input_i: -20, input_tp: -4 }), 3);
});

test('a high-LRA track is normalized without falling into dynamic loudnorm', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'suno-master-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const inputPath = path.join(dir, 'input.wav');
  const wavPath = path.join(dir, 'master.wav');
  // 静→轟の2段構成でLRAを大きくする（現行実装が動的モードへ落ちていた再現ケース）
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'anoisesrc=color=pink:seed=11:duration=12:sample_rate=44100',
    '-f', 'lavfi', '-i', 'anoisesrc=color=pink:seed=22:duration=12:sample_rate=44100',
    '-filter_complex',
    "[0:a]volume='if(lt(t,6),0.03,0.35)':eval=frame[l];[1:a]volume='if(lt(t,6),0.03,0.35)':eval=frame[r];[l][r]join=inputs=2:channel_layout=stereo",
    '-c:a', 'pcm_s16le', inputPath,
  ]);
  const metadata = await probeAudio(inputPath);
  const originalLoudness = await analyzeLoudness(inputPath);
  const result = await renderMaster({
    inputPath,
    wavPath,
    settings: {
      targetLufs: -12, truePeak: -1,
      focus: 0, warmth: 0, clarity: 0, air: 0, punch: 0, width: 0, drive: 0,
      eqBass: 0, eqLowMid: 0, eqMid: 0, eqPresence: 0, eqAir: 0,
    },
    metadata,
    inputLufs: originalLoudness.integratedLufs,
  });
  assert.ok(['linear', 'linear-gain'].includes(result.normalization), `normalization was ${result.normalization}`);
  const loudness = await analyzeLoudness(wavPath);
  assert.ok(loudness.truePeakDb <= -0.7, `true peak was ${loudness.truePeakDb}`);
});

test('a synthetic stereo track can be mastered to 48kHz 24-bit near its target LUFS', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'suno-master-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const inputPath = path.join(dir, 'input.wav');
  const wavPath = path.join(dir, 'master.wav');
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'sine=frequency=110:duration=3:sample_rate=44100',
    '-f', 'lavfi', '-i', 'sine=frequency=880:duration=3:sample_rate=44100',
    '-filter_complex', '[0:a]volume=0.18[a0];[1:a]volume=0.06[a1];[a0][a1]amix=inputs=2,pan=stereo|c0=c0|c1=0.92*c0',
    '-c:a', 'pcm_s16le', inputPath,
  ]);
  const metadata = await probeAudio(inputPath);
  const originalLoudness = await analyzeLoudness(inputPath);
  await renderMaster({
    inputPath,
    wavPath,
    settings: {
      targetLufs: -12, truePeak: -1,
      focus: 48, warmth: 52, clarity: 54, air: 30, punch: 42, width: 22, drive: 18,
      eqBass: 1, eqLowMid: -0.5, eqMid: 0.5, eqPresence: 1, eqAir: 0.5,
    },
    metadata,
    inputLufs: originalLoudness.integratedLufs,
  });
  const output = await probeAudio(wavPath);
  const loudness = await analyzeLoudness(wavPath);
  assert.equal(output.sampleRate, 48000);
  assert.equal(output.codec, 'pcm_s24le');
  assert.ok(Math.abs(loudness.integratedLufs - (-12)) < 0.7, `LUFS was ${loudness.integratedLufs}`);
  assert.ok(loudness.truePeakDb <= -0.7, `true peak was ${loudness.truePeakDb}`);
});
