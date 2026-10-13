module.exports = function publicUser(user) {
  const {
    password: _password,
    two_factor_secret: _secret,
    two_factor_backup_codes: _backup,
    ...profile
  } = user;
  return profile;
};
