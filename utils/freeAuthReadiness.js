function authSchemaReady(row, config) {
  const authTablesReady = Boolean(
    row.users_ready && row.abuse_ready && row.account_events_ready && row.sessions_ready
  );
  const providerTablesReady = Boolean((!config.google && !config.kakao) || row.oauth_ready);
  const signupSchemaReady = Boolean(!config.simpleSignup || row.signup_schema_ready);
  return authTablesReady && providerTablesReady && signupSchemaReady;
}

module.exports = { authSchemaReady };

