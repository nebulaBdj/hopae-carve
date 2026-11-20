// 사각사각 깎는 소리: 걸러 낸 잡음을 칼 속도만큼 키운다 (파일 없이 Web Audio로 만든다)
// + 칼끝이 나무를 처음 물 때 낮고 짧은 '톡'
export class CarveSound {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private grainOsc: OscillatorNode | null = null;
  muted = false;

  // 첫 터치 때 켠다 (브라우저 자동재생 제한)
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2900;
    filter.Q.value = 1.2; // 대역을 조금 좁혀 넓게 퍼지는 부스럭 대신 또렷한 사각 소리로
    const soft = ctx.createBiquadFilter(); // 쉬익거리는 고역을 살짝 눌러 부스럭거림을 줄인다
    soft.type = "lowpass";
    soft.frequency.value = 7500;
    soft.Q.value = 0.5;
    // 사각사각 결: 소리 크기를 빠르게 살짝 오르내리게 한다 (0.8~1.2, 평균 음량은 그대로)
    const grain = ctx.createGain();
    grain.gain.value = 1;
    const grainOsc = ctx.createOscillator();
    grainOsc.frequency.value = 16;
    const grainDepth = ctx.createGain();
    grainDepth.gain.value = 0.2;
    grainOsc.connect(grainDepth).connect(grain.gain);
    grainOsc.start();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    noise.connect(filter).connect(soft).connect(grain).connect(gain).connect(ctx.destination);
    noise.start();
    this.ctx = ctx;
    this.gain = gain;
    this.filter = filter;
    this.grainOsc = grainOsc;
  }

  // speed: 텍스처 px/ms
  scrape(speed: number) {
    if (!this.ctx || !this.gain || !this.filter) return;
    const now = this.ctx.currentTime;
    const level = this.muted ? 0 : Math.min(0.3, speed * 0.21);
    this.gain.gain.setTargetAtTime(level, now, 0.03);
    // 결을 지날 때마다 소리가 살짝 떨리게 (떨림 폭·속도는 줄여 덜 부스럭거리게)
    this.filter.frequency.setTargetAtTime(2200 + Math.random() * 1200, now, 0.05);
    // 칼이 빠를수록 사각 결도 촘촘하게
    this.grainOsc?.frequency.setTargetAtTime(12 + Math.min(14, speed * 10), now, 0.08);
  }

  stop() {
    if (!this.ctx || !this.gain) return;
    this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
  }

  // 칼끝이 나무를 무는 '톡'
  bite() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const decay = 0.035;
    const len = Math.ceil(ctx.sampleRate * decay * 2);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * decay * 0.35));
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 700;
    f.Q.value = 3;
    const g = ctx.createGain();
    g.gain.value = 0.75;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start();
  }

  // 완성할 때 '톡'
  tock() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.18);
    g.gain.setValueAtTime(0.35, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }
}
