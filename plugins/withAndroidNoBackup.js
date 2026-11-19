/**
 * Config plugin: disables every Android backup and device-transfer path.
 *
 * - android:allowBackup="false"        Auto Backup to Google Drive, adb backup
 * - android:fullBackupContent="false"  legacy rule set (Android <= 11)
 * - android:dataExtractionRules        Android 12+: cloud backup AND device-to-device
 *                                      transfer. allowBackup alone does NOT stop D2D.
 *
 * Even if files were copied, the vault key lives in the Android Keystore and is
 * never exportable, so a copy would be undecryptable ciphertext.
 */
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const DOMAINS = ['root', 'file', 'database', 'sharedpref', 'external'];
const excludes = DOMAINS.map((d) => `    <exclude domain="${d}" path="." />`).join('\n');

const RULES = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<data-extraction-rules>',
  '  <cloud-backup>',
  excludes,
  '  </cloud-backup>',
  '  <device-transfer>',
  excludes,
  '  </device-transfer>',
  '</data-extraction-rules>',
  '',
].join('\n');

function withRulesFile(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'docsave_data_extraction_rules.xml'), RULES);
      return cfg;
    },
  ]);
}

function withManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.$['android:allowBackup'] = 'false';
    app.$['android:fullBackupContent'] = 'false';
    app.$['android:dataExtractionRules'] = '@xml/docsave_data_extraction_rules';
    cfg.modResults.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const replace = new Set((app.$['tools:replace'] || '').split(',').filter(Boolean));
    ['android:allowBackup', 'android:fullBackupContent', 'android:dataExtractionRules'].forEach((a) =>
      replace.add(a),
    );
    app.$['tools:replace'] = Array.from(replace).join(',');
    return cfg;
  });
}

module.exports = function withAndroidNoBackup(config) {
  return withManifest(withRulesFile(config));
};
