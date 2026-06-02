// Cross-platform replacement for `mkdir -p ... && cp *.ttf ...`.
// Copies the bundled Unicode (Cyrillic) invoice fonts into the build output.
// Behaviour is identical to the previous POSIX shell command, but works on
// Windows (cmd.exe), macOS and Linux alike.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'modules', 'invoicing', 'infrastructure', 'fonts');
const dest = path.join(__dirname, '..', 'dist', 'modules', 'invoicing', 'infrastructure', 'fonts');

fs.mkdirSync(dest, { recursive: true });
for (const file of fs.readdirSync(src)) {
  if (file.toLowerCase().endsWith('.ttf')) {
    fs.copyFileSync(path.join(src, file), path.join(dest, file));
  }
}
