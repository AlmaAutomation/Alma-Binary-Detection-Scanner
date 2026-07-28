const client = {
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  put: jest.fn(() => Promise.resolve({ data: {} })),
  delete: jest.fn(() => Promise.resolve({ data: {} })),
  defaults: { baseURL: "http://localhost" },
};

module.exports = {
  __esModule: true,
  default: {
    create: jest.fn(() => client),
  },
};
