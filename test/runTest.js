const path = require('path');
const { runTests } = require('@vscode/test-electron');
const fs = require('fs');

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '..');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // Copy test runner to out folder so extension host can load it
    const outTestDir = path.resolve(__dirname, '../out/test/suite');
    fs.mkdirSync(outTestDir, { recursive: true });
    fs.copyFileSync(
      path.resolve(__dirname, './suite/index.js'),
      path.resolve(outTestDir, 'index.js')
    );

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath: path.resolve(outTestDir, 'index'),
      launchArgs: ['--disable-extensions']
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();
