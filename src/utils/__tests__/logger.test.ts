// Mock env module before importing logger
vi.mock('../../config/env', () => ({
  isDevEnvironment: vi.fn(() => true),
}));

import { Logger, logger } from '../logger';
import { isDevEnvironment } from '../../config/env';

const mockedIsDev = vi.mocked(isDevEnvironment);

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'time').mockImplementation(() => {});
    vi.spyOn(console, 'timeEnd').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});
    vi.spyOn(console, 'group').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('in development', () => {
    it('logs all levels', () => {
      mockedIsDev.mockReturnValue(true);
      const dev = new Logger();

      dev.log('msg');
      dev.debug('msg');
      dev.info('msg');
      dev.warn('msg');
      dev.error('msg');

      expect(console.log).toHaveBeenCalled();
      expect(console.debug).toHaveBeenCalled();
      expect(console.info).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('in production', () => {
    it('suppresses log/debug/info but keeps warn/error', () => {
      mockedIsDev.mockReturnValue(false);
      const prod = new Logger();

      prod.log('msg');
      prod.debug('msg');
      prod.info('msg');
      prod.warn('msg');
      prod.error('msg');

      expect(console.log).not.toHaveBeenCalled();
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('formatMessage', () => {
    it('includes prefix', () => {
      mockedIsDev.mockReturnValue(true);
      const l = new Logger({ prefix: '[TEST]' });
      l.log('hello');
      expect(console.log).toHaveBeenCalledWith('[TEST]', 'hello');
    });

    it('includes context object', () => {
      mockedIsDev.mockReturnValue(true);
      const l = new Logger();
      l.log('msg', { key: 'val' });
      expect(console.log).toHaveBeenCalledWith(
        expect.anything(),
        'msg',
        '\n Context:',
        { key: 'val' }
      );
    });
  });

  describe('error with Error object', () => {
    it('logs error message and stack in context', () => {
      mockedIsDev.mockReturnValue(true);
      const l = new Logger();
      const err = new Error('boom');
      l.error('failed', err);

      expect(console.error).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('failed'),
        '\n Context:',
        expect.objectContaining({ message: 'boom' })
      );
    });
  });

  describe('utility methods', () => {
    it('time / timeEnd in dev', () => {
      mockedIsDev.mockReturnValue(true);
      const l = new Logger();
      l.time('op');
      l.timeEnd('op');

      expect(console.time).toHaveBeenCalled();
      expect(console.timeEnd).toHaveBeenCalled();
    });

    it('table in dev', () => {
      mockedIsDev.mockReturnValue(true);
      const l = new Logger();
      l.table([{ a: 1 }]);
      expect(console.table).toHaveBeenCalled();
    });

    it('group / groupEnd in dev', () => {
      mockedIsDev.mockReturnValue(true);
      const l = new Logger();
      l.group('section');
      l.groupEnd();
      expect(console.group).toHaveBeenCalled();
      expect(console.groupEnd).toHaveBeenCalled();
    });
  });

  it('singleton logger is an instance of Logger', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.log).toBe('function');
    expect(typeof logger.warn).toBe('function');
  });
});
