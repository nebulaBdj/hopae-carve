// 나무 깎는 소리 (파일 없이 Web Audio로 만든다). 우드카빙 ASMR처럼 '틱' 없이 부드럽게 이어지게
// - 스윽: 칼날이 결을 따라 미끄러지는 결 소리. 짧은 소리 알갱이를 서서히 켜고 끄며 겹쳐 딸깍이는 소리가 없다
// - 슥: 칼날이 나무를 밀고 가는 낮은 마찰음
// - 툭: 칼끝이 나무를 처음 물 때 (낮고 짧게)
export class CarveSound {
  private ctx: AudioContext | null = null;
  private crackle: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private shave: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  muted = false;

  // 첫 터치 때 켠다 (브라우저 자동재생 제한)
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    const out = ctx.createDynamicsCompressor();
    out.connect(ctx.destination);

    // 사각사각
    const crackleSource = ctx.createBufferSource();
    crackleSource.buffer = sliceBuffer(ctx);
    crackleSource.loop = true;
    const crackleHp = ctx.createBiquadFilter();
    crackleHp.type = "highpass";
    crackleHp.frequency.value = 500;
    const crackleBody = ctx.createBiquadFilter(); // 쇳소리 없이 건조한 고역을 눌러 둔다
    crackleBody.type = "lowpass";
    crackleBody.frequency.value = 4200;
    crackleBody.Q.value = 0.5;
    const crackleGain = ctx.createGain();
    crackleGain.gain.value = 0;
    crackleSource.connect(crackleHp).connect(crackleBody).connect(crackleGain).connect(out);
    crackleSource.start();

    // 슥
    const shaveSource = ctx.createBufferSource();
    shaveSource.buffer = brownNoise(ctx);
    shaveSource.loop = true;
    const shaveFilter = ctx.createBiquadFilter();
    shaveFilter.type = "bandpass";
    shaveFilter.frequency.value = 650;
    shaveFilter.Q.value = 1.4;
    const shaveGain = ctx.createGain();
    shaveGain.gain.value = 0;
    shaveSource.connect(shaveFilter).connect(shaveGain).connect(out);
    shaveSource.start();

    this.ctx = ctx;
    this.crackle = { source: crackleSource, gain: crackleGain };
    this.shave = { gain: shaveGain, filter: shaveFilter };
  }

  // speed: 텍스처 px/ms
  scrape(speed: number) {
    if (!this.ctx || !this.crackle || !this.shave) return;
    const now = this.ctx.currentTime;
    const s = Math.min(1.5, speed);
    const on = this.muted ? 0 : 1;
    this.crackle.gain.gain.setTargetAtTime(on * Math.min(0.75, 0.2 + s * 0.45), now, 0.06);
    this.crackle.source.playbackRate.setTargetAtTime(0.85 + s * 0.3, now, 0.08); // 빠를수록 조금 밝게
    this.shave.gain.gain.setTargetAtTime(on * Math.min(0.45, 0.08 + s * 0.3), now, 0.06);
    this.shave.filter.frequency.setTargetAtTime(500 + s * 300 + Math.random() * 120, now, 0.05);
  }

  stop() {
    if (!this.ctx || !this.crackle || !this.shave) return;
    const now = this.ctx.currentTime;
    this.crackle.gain.gain.setTargetAtTime(0, now, 0.08);
    this.shave.gain.gain.setTargetAtTime(0, now, 0.1);
  }

  // 칼끝이 나무를 무는 '톡'
  bite() {
    if (!this.ctx || this.muted) return;
    this.hit(700, 0.25, 0.035);
  }

  // 완성할 때 '탁'
  tock() {
    if (!this.ctx || this.muted) return;
    this.hit(520, 0.7, 0.18);
  }

  // 짧은 잡음을 대역 필터로 걸러 나무를 두드린 소리를 낸다
  private hit(freq: number, level: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.ceil(ctx.sampleRate * decay * 2);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * decay * 0.35));
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = 3;
    const g = ctx.createGain();
    g.gain.value = level * 3;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start();
  }
}

// 2초짜리 '스윽' 반복 소리: 10~40ms 소리 알갱이를 서서히 켜고 끄며(한 창) 겹쳐 뿌린다.
// 알갱이마다 세기·밝기가 달라 결을 지나는 느낌이 나고, 시작이 부드러워 '틱'이 생기지 않는다
function sliceBuffer(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, rate * 2, rate);
  const d = buffer.getChannelData(0);
  const end = d.length;
  let t = 0;
  while (t < end) {
    const len = Math.floor(rate * (0.01 + Math.random() * 0.03));
    const amp = 0.35 + Math.random() * 0.65;
    const bright = 0.15 + Math.random() * 0.35; // 작을수록 둔하고 낮은 소리
    let lp = 0;
    for (let i = 0; i < len; i++) {
      lp += bright * (Math.random() * 2 - 1 - lp);
      const win = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / len);
      d[(t + i) % end] += lp * amp * win * 1.6; // 끝을 처음과 겹쳐 반복 이음새도 매끈하게
    }
    t += Math.floor(len * (0.35 + Math.random() * 0.4));
  }
  return buffer;
}

// 낮게 깔리는 마찰음용 갈색 잡음
function brownNoise(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return buffer;
}
