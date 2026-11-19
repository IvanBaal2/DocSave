const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// @noble/* v2 are ESM packages that rely on package.json "exports".
config.resolver.unstable_enablePackageExports = true;
// pdf.js ships as text assets (assets/pdfjs/*.txt) loaded on demand, outside the JS bundle.
config.resolver.assetExts = [...config.resolver.assetExts, 'txt'];

module.exports = config;
