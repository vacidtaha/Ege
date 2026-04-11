const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function(context) {
  if (process.platform !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  if (!fs.existsSync(appPath)) return;

  console.log(`Ad-hoc signing: ${appPath}`);

  const frameworksPath = path.join(appPath, 'Contents', 'Frameworks');

  // Sign nested components first (inside-out signing order)
  if (fs.existsSync(frameworksPath)) {
    // Sign all executable files in Frameworks
    try {
      execSync(`find "${frameworksPath}" -type f -perm +111 -exec codesign --force --sign - {} \\;`, { stdio: 'inherit' });
    } catch (e) { /* some files may not need signing */ }

    // Sign all .framework bundles
    try {
      execSync(`find "${frameworksPath}" -name "*.framework" -exec codesign --force --sign - {} \\;`, { stdio: 'inherit' });
    } catch (e) {}

    // Sign all .app bundles inside Frameworks (e.g. Electron Helper)
    try {
      execSync(`find "${frameworksPath}" -name "*.app" -exec codesign --force --sign - {} \\;`, { stdio: 'inherit' });
    } catch (e) {}
  }

  // Sign the main app last
  execSync(`codesign --force --sign - "${appPath}"`, { stdio: 'inherit' });

  // Verify
  execSync(`codesign --verify --verbose "${appPath}"`, { stdio: 'inherit' });

  console.log('Ad-hoc signing complete');
};
