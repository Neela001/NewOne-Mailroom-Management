import { getDeviceName, getOrCreateDeviceId } from './device.util';

describe('device.util', () => {
  const originalUserAgent = navigator.userAgent;

  function setUserAgent(ua: string): void {
    Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
  }

  afterEach(() => {
    setUserAgent(originalUserAgent);
    localStorage.clear();
  });

  describe('getDeviceName', () => {
    it('reports OS + browser, not a fabricated form factor like "Laptop"', () => {
      setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      expect(getDeviceName()).toBe('Windows - Chrome');
    });

    it('distinguishes Edge from Chrome despite Edge UA containing "Chrome"', () => {
      setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0');
      expect(getDeviceName()).toBe('Windows - Edge');
    });

    it('identifies Android + Chrome correctly', () => {
      setUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
      expect(getDeviceName()).toBe('Android - Chrome');
    });

    it('identifies macOS + Safari correctly', () => {
      setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15');
      expect(getDeviceName()).toBe('macOS - Safari');
    });
  });

  describe('getOrCreateDeviceId', () => {
    it('generates a value and persists it in localStorage', () => {
      const id = getOrCreateDeviceId();
      expect(id).toBeTruthy();
      expect(localStorage.getItem('mailroom.deviceId')).toBe(id);
    });

    it('returns the SAME id on a later call (stable per browser profile)', () => {
      const first = getOrCreateDeviceId();
      const second = getOrCreateDeviceId();
      expect(second).toBe(first);
    });
  });
});
