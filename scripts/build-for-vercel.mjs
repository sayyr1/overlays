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

// El proyecto heredado incluye un adaptador de Cloudinary con un peer dependency
// antiguo; esta opción conserva las versiones bloqueadas en package-lock.
run('npm install --prefix frontend --legacy-peer-deps');
run('npm run build --prefix frontend', {
  env: {
    ...process.env,
    CI: 'false'
  }
});
run('node scripts/prepare-vercel-public.mjs');
