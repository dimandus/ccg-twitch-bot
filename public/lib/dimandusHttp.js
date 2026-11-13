function isDimandusHost(hostname) {
  if (!hostname) return false;
  const h = String(hostname).toLowerCase();
  return h === 'dimandus.ru' || h.endsWith('.dimandus.ru');
}

function withTlsPolicy(options = {}) {
  const opts = { ...options };
  if (isDimandusHost(opts.hostname)) {
    opts.rejectUnauthorized = false;
  }
  return opts;
}

module.exports = {
  isDimandusHost,
  withTlsPolicy,
};
