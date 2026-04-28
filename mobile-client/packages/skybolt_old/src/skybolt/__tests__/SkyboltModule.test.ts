import type {NativeUploadEvent} from '../../../specs/NativeSkybolt';

const mockOnUploadEvent = jest.fn();
const mockConfigure = jest.fn().mockResolvedValue(undefined);
const mockInitializeSession = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../specs/NativeSkybolt', () => ({
  __esModule: true,
  default: {
    configure: mockConfigure,
    initializeSession: mockInitializeSession,
    startSession: jest.fn().mockResolvedValue(undefined),
    pauseSession: jest.fn().mockResolvedValue(undefined),
    resumeSession: jest.fn().mockResolvedValue(undefined),
    cancelSession: jest.fn().mockResolvedValue(undefined),
    getSessionProgress: jest.fn().mockResolvedValue(null),
    listActiveSessions: jest.fn().mockResolvedValue([]),
    listPendingSessions: jest.fn().mockResolvedValue([]),
    resumeAllPending: jest.fn().mockResolvedValue(0),
    notifyAuthRefreshed: jest.fn().mockResolvedValue(undefined),
    setAuthTokens: jest.fn().mockResolvedValue(undefined),
    getValidAccessToken: jest.fn().mockResolvedValue(null),
    clearAuthTokens: jest.fn().mockResolvedValue(undefined),
    purgeCompletedSessions: jest.fn().mockResolvedValue(0),
    cleanupTempFiles: jest.fn().mockResolvedValue(0),
    extractMD5FromFiles: jest.fn().mockResolvedValue([]),
    onUploadEvent: mockOnUploadEvent,
  },
}));

describe('Skybolt Turbo wrapper', () => {
  const SkyboltModule = require('../SkyboltModule');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('serializes record fields to key/value pairs in configure', async () => {
    const {configure: configureSkybolt} = SkyboltModule;

    await configureSkybolt({
      version: '1',
      environment: 'dev',
      backend: {
        baseUrl: 'https://example.com',
        defaultHeaders: {Authorization: 'Bearer token'},
        endpoints: {sasBatchPath: '/sas/batch', sasRefreshPath: '/sas/refresh'},
        auth: {
          tokenEndpoint: 'https://example.com/token',
          clientId: 'cid',
          scope: 'openid',
        },
      },
      azure: {
        serviceVersion: '2023-11-03',
        sendBlockMd5: true,
        defaultChunkBytes: 4 * 1024 * 1024,
      },
    });

    expect(mockConfigure).toHaveBeenCalledTimes(1);
    expect(mockConfigure.mock.calls[0][0].backend.defaultHeaders).toEqual([
      {key: 'Authorization', value: 'Bearer token'},
    ]);
  });

  it('serializes item metadata for initializeSession', async () => {
    const {initializeSession: init} = SkyboltModule;

    await init({
      sessionId: 's1',
      items: [
        {
          clientItemId: 'i1',
          localUri: 'file:///tmp/a.jpg',
          blobName: 'uploads/a.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 12,
          metadata: {originalName: 'a.jpg'},
        },
      ],
    });

    expect(mockInitializeSession).toHaveBeenCalledTimes(1);
    expect(mockInitializeSession.mock.calls[0][0].items[0].metadata).toEqual([
      {key: 'originalName', value: 'a.jpg'},
    ]);
  });

  it('uses onUploadEvent Turbo emitter subscription', async () => {
    const subscription = {remove: jest.fn()};
    mockOnUploadEvent.mockReturnValue(subscription);
    const {addUploadListener} = SkyboltModule;

    const listener = jest.fn();
    const result = addUploadListener(listener);
    const nativeEvent: NativeUploadEvent = {type: 'session:started', sessionId: 's1'};

    const callback = mockOnUploadEvent.mock.calls[0][0];
    callback(nativeEvent);

    expect(listener).toHaveBeenCalledWith({type: 'session:started', sessionId: 's1'});
    expect(result).toBe(subscription);
  });
});
