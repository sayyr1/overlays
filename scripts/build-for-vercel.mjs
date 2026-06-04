import { spawnSync } from 'child_process';

const run = (command, options = {}) => {
  const result = spawnSync(command, {
    stdio: 'inherit',
    shell: true,
    ...options
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run('npm install --prefix frontend');
run('npm run build --prefix frontend', {
  env: {
    ...process.env,
    CI: 'false'
  }
});
run('node scripts/prepare-vercel-public.mjs');
