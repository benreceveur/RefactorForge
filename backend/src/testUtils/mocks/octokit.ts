export class Octokit {
  constructor() {
    // Mock implementation
  }
  rest = {
    rateLimit: {
      get: jest.fn().mockResolvedValue({
        data: {
          rate: {
            remaining: 5000,
            reset: new Date().getTime() / 1000 + 3600,
          },
        },
      }),
    },
    repos: {
      listForAuthenticatedUser: jest.fn().mockResolvedValue({ data: [] }),
      listForOrg: jest.fn().mockResolvedValue({ data: [] }),
      get: jest.fn().mockResolvedValue({ data: { id: 123, full_name: 'test/repo' } })
    },
    orgs: {
      listForAuthenticatedUser: jest.fn().mockResolvedValue({ data: [] })
    }
  };
}
