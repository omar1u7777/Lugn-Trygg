// Firebase mock for Jest testing
const mockFirebase = {
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []),
  getApp: jest.fn(),
  deleteApp: jest.fn(),
  auth: jest.fn(() => ({
    signInWithPopup: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
    currentUser: null
  })),
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ exists: false, data: jest.fn(() => ({})) })),
        set: jest.fn(() => Promise.resolve()),
        update: jest.fn(() => Promise.resolve()),
        delete: jest.fn(() => Promise.resolve())
      })),
      add: jest.fn(() => Promise.resolve({ id: 'mock-id' })),
      where: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ docs: [] })),
        limit: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve({ docs: [] }))
        }))
      })),
      orderBy: jest.fn(() => ({
        limit: jest.fn(() => ({
          stream: jest.fn(() => [])
        }))
      }))
    }))
  })),
  storage: jest.fn(() => ({
    ref: jest.fn(() => ({
      put: jest.fn(() => Promise.resolve({ ref: { getDownloadURL: jest.fn(() => Promise.resolve('mock-url')) } })),
      getDownloadURL: jest.fn(() => Promise.resolve('mock-url'))
    }))
  }))
};

module.exports = mockFirebase;
module.exports.default = mockFirebase;