import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.resolve(__dirname, '../../notebooks');
const targetDir = path.resolve(__dirname, '../public/notebooks');

function syncNotebooks() {
  console.log(`Syncing notebooks from ${sourceDir} to ${targetDir}...`);

  try {
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetDir, { recursive: true });

    const files = fs.readdirSync(sourceDir);
    for (const file of files) {
      if (file.endsWith('.ipynb')) {
        fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
        console.log(`- Copied ${file}`);
      }
    }
    console.log('Notebook synchronization complete.');
  } catch (error) {
    console.error('Error syncing notebooks:', error);
    process.exit(1);
  }
}

syncNotebooks();
