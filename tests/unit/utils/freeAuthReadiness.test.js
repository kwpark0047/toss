const { authSchemaReady } = require('../../../utils/freeAuthReadiness');

const base = {
  users_ready: true,
  abuse_ready: true,
  account_events_ready: true,
  sessions_ready: true,
  oauth_ready: false,
  signup_schema_ready: true,
};

describe('free auth database readiness', () => {
  it('allows simple signup only when the trial and approval schema exists', () => {
    expect(authSchemaReady(base, { simpleSignup: true, google: false, kakao: false })).toBe(true);
    expect(authSchemaReady({ ...base, signup_schema_ready: false }, { simpleSignup: true })).toBe(
      false
    );
  });

  it('keeps existing provider login independent from the optional signup schema', () => {
    expect(
      authSchemaReady(
        { ...base, signup_schema_ready: false, oauth_ready: true },
        {
          simpleSignup: false,
          google: true,
          kakao: false,
        }
      )
    ).toBe(true);
  });

  it('fails closed when a required auth table is missing', () => {
    expect(authSchemaReady({ ...base, sessions_ready: false }, { simpleSignup: true })).toBe(false);
  });
});

