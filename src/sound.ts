// 나무 깎는 소리 (파일 없이 Web Audio로 만든다)
// - 사각사각: 나무 섬유가 끊기는 짧은 '틱' 알갱이를 불규칙하게 뿌린 소리. 칼이 빠를수록 촘촘하고 크다
// - 슥: 칼날이 결을 밀고 가는 낮고 건조한 마찰음
// - 톡: 칼끝이 나무를 처음 물 때
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
    crackleSource.buffer = crackleBuffer(ctx);
    crackleSource.loop = true;
    const crackleHp = ctx.createBiquadFilter();
    crackleHp.type = "highpass";
    crackleHp.frequency.value = 900;
    const crackleBody = ctx.createBiquadFilter(); // 나무 울림
    crackleBody.type = "peaking";
    crackleBody.frequency.value = 1800;
    crackleBody.Q.value = 1.2;
    crackleBody.gain.value = 6;
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
    this.crackle.gain.gain.setTargetAtTime(on * Math.min(0.9, 0.25 + s * 0.5), now, 0.015);
    this.crackle.source.playbackRate.setTargetAtTime(0.75 + s * 0.6, now, 0.03); // 빠를수록 촘촘하게
    this.shave.gain.gain.setTargetAtTime(on * Math.min(0.5, s * 0.35), now, 0.03);
    this.shave.filter.frequency.setTargetAtTime(500 + s * 300 + Math.random() * 120, now, 0.05);
  }

  stop() {
    if (!this.ctx || !this.crackle || !this.shave) return;
    const now = this.ctx.currentTime;
    this.crackle.gain.gain.setTargetAtTime(0, now, 0.03);
    this.shave.gain.gain.setTargetAtTime(0, now, 0.05);
  }

  // 칼끝이 나무를 무는 '톡'
  bite() {
    if (!this.ctx || this.muted) return;
    this.hit(1400, 0.5, 0.05);
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

// 2초짜리 '사각사각' 반복 소리: 길이·세기가 제각각인 짧은 틱을 불규칙한 간격으로 뿌린다
function crackleBuffer(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, rate * 2, rate);
  const d = buffer.getChannelData(0);
  let t = 0;
  while (t < d.length) {
    // 섬유 몇 가닥이 연달아 끊기는 무리와 그 사이 틈
    const cluster = 1 + Math.floor(Math.random() * 4);
    for (let c = 0; c < cluster && t < d.length; c++) {
      const len = Math.floor(rate * (0.0015 + Math.random() * 0.006));
      const amp = 0.25 + Math.pow(Math.random(), 2) * 0.75;
      const tau = len * (0.25 + Math.random() * 0.3);
      let lp = 0;
      const bright = 0.35 + Math.random() * 0.5; // 틱마다 음색이 조금씩 다르게
      for (let i = 0; i < len && t + i < d.length; i++) {
        lp += bright * ((Math.random() * 2 - 1) - lp);
        d[t + i] += lp * amp * Math.exp(-i / tau);
      }
      t += len + Math.floor(rate * (0.002 + Math.random() * 0.01));
    }
    t += Math.floor(rate * (0.008 + Math.random() * 0.035));
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
