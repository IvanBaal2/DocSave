const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// @noble/* v2 are ESM packages that rely on package.json "exports".
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
