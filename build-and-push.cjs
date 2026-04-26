const { execSync } = require('child_process');
const cwd = 'C:/Users/Berat/Desktop/Terminal/testingsomething';

try {
  console.log('Staging files...');
  console.log(execSync('git add src/App.tsx', { encoding: 'utf8', cwd }));
  
  console.log('Committing...');
  console.log(execSync('git commit -m "fix: load Settings synchronously to prevent Suspense stall"', { encoding: 'utf8', cwd }));
  
  console.log('Pushing...');
  console.log(execSync('git push origin main', { encoding: 'utf8', cwd }));
  
  console.log('\n✅ Done!');
} catch(e) {
  console.log(e.stdout || e.stderr || e.message);
}
