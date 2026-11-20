// 사각사각 깎는 소리: 걸러 낸 잡음을 칼 속도만큼 키운다 (파일 없이 Web Audio로 만든다)
export class CarveSound {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
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
    filter.frequency.value = 2600;
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start();
    this.ctx = ctx;
    this.gain = gain;
    this.filter = filter;
  }

  // speed: 텍스처 px/ms
  scrape(speed: number) {
    if (!this.ctx || !this.gain || !this.filter) return;
    const now = this.ctx.currentTime;
    const level = this.muted ? 0 : Math.min(0.32, speed * 0.22);
    this.gain.gain.setTargetAtTime(level, now, 0.02);
    // 결을 지날 때마다 소리가 살짝 떨리게
    this.filter.frequency.setTargetAtTime(2000 + Math.random() * 1600, now, 0.03);
  }

  stop() {
    if (!this.ctx || !this.gain) return;
    this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
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
