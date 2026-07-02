import '@testing-library/jest-dom/vitest';

class TestStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new TestStorage(),
  configurable: true,
});

Object.defineProperty(globalThis, 'sessionStorage', {
  value: new TestStorage(),
  configurable: true,
});

const noop = () => undefined;

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: function getContext(this: HTMLCanvasElement) {
    return {
      arc: noop,
      beginPath: noop,
      clearRect: noop,
      closePath: noop,
      drawImage: noop,
      fill: noop,
      fillRect: noop,
      fillText: noop,
      lineTo: noop,
      measureText: (text: string) => ({ width: text.length * 8 }),
      moveTo: noop,
      restore: noop,
      save: noop,
      setLineDash: noop,
      stroke: noop,
      strokeRect: noop,
      canvas: this,
      fillStyle: '',
      font: '',
      globalCompositeOperation: 'source-over',
      lineCap: 'round',
      lineJoin: 'round',
      lineWidth: 1,
      strokeStyle: '',
      textBaseline: 'top',
    } as unknown as CanvasRenderingContext2D;
  },
  configurable: true,
});

HTMLCanvasElement.prototype.setPointerCapture = noop;
HTMLCanvasElement.prototype.releasePointerCapture = noop;

class TestResizeObserver implements ResizeObserver {
  observe = noop;
  unobserve = noop;
  disconnect = noop;
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  value: TestResizeObserver,
  configurable: true,
});
