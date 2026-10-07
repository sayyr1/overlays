import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// Only download assets registered by our Cloudinary media library. OBS always
// uses a local file, so playback does not depend on Internet availability.
export async function cacheReplayAsset(asset, directory) {
  const url = new URL(asset.secureUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.username || url.password || url.port || !url.pathname.includes('/upload/') || !/^imbabura-en-vivo\/library\/[a-f\d-]{36}$/i.test(String(asset.publicId)) || !['png', 'webp', 'jpg', 'jpeg', 'webm', 'mp4'].includes(asset.format)) throw new Error('El gráfico de repetición no es un recurso válido de la biblioteca.');
  const limit = (asset.kind === 'video' ? 100 : 10) * 1024 * 1024;
  const file = path.join(directory, `${crypto.createHash('sha256').update(url.href).digest('hex')}.${asset.format}`);
  await fs.mkdir(directory, { recursive: true });
  if ((await fs.stat(file).catch(() => null))?.isFile()) return file;
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(60000) });
  if (!response.ok || Number(response.headers.get('content-length')) > limit) throw new Error('No se pudo descargar el gráfico de repetición.');
  const temporary = `${file}.tmp`;
  const handle = await fs.open(temporary, 'w');
  try {
    let total = 0;
    for await (const chunk of response.body) {
      total += chunk.byteLength;
      if (total > limit) throw new Error('El gráfico supera el tamaño permitido.');
      await handle.write(chunk);
    }
    if (!total) throw new Error('El gráfico está vacío.');
    await handle.close(); await fs.rename(temporary, file); return file;
  } catch (error) { await handle.close().catch(() => {}); await fs.unlink(temporary).catch(() => {}); throw error; }
}
