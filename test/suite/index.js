const path = require('path');
const Mocha = require('mocha');
const fs = require('fs');

function collectJsFiles(dir) {
  const results = [];
  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of list) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectJsFiles(full));
      } else if (entry.isFile() && full.endsWith('.js')) {
        results.push(full);
      }
    }
  } catch (err) {
    // Directory doesn't exist or can't be read
  }
  return results;
}

exports.run = function() {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 10000
  });

  const testsRoot = path.resolve(__dirname, '..');

  return new Promise((resolve, reject) => {
    const files = collectJsFiles(testsRoot);

    // Don't include the test runner itself
    const testFiles = files.filter(f => !f.includes('suite/index.js') && !f.includes('suite\\index.js'));

    if (testFiles.length === 0) {
      return reject(new Error('No test files found in ' + testsRoot));
    }

    // Add files to the test suite
    testFiles.forEach(f => mocha.addFile(f));

    try {
      // Run the mocha test
      mocha.run(failures => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      console.error(err);
      reject(err);
    }
  });
};
