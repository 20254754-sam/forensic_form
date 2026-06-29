import { copyFile, readFile, rename, writeFile } from 'node:fs/promises'

try {
  await rename('dist/pages.index.html', 'dist/index.html')
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error
  }
}

if (process.env.GITHUB_PAGES) {
  const indexHtml = await readFile('dist/index.html', 'utf8')
  const fixedHtml = indexHtml
    .replaceAll('src="/assets/', 'src="/forensic_form/assets/')
    .replaceAll('href="/assets/', 'href="/forensic_form/assets/')

  await writeFile('dist/index.html', fixedHtml)
}

try {
  await copyFile('public/favicon.svg', 'dist/favicon.svg')
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error
  }
}
