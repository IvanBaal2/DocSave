/**
 * Config plugin: removes the iOS remote-push entitlement (aps-environment) that
 * expo-notifications adds by default. Docsave only schedules LOCAL reminders,
 * which need no entitlement; without it the app cannot even register with APNs.
 *
 * Must be listed AFTER 'expo-notifications' in app.config.js plugins.
 */
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withNoRemotePush(config) {
  if (config.ios?.entitlements) {
    delete config.ios.entitlements['aps-environment'];
  }
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
