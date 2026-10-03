import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const distDirectory = path.resolve(process.argv[2] ?? 'dist')
const source = path.join(distDirectory, 'index.html')

export const STATIC_ROUTE_SEGMENTS = Object.freeze([
  'database',
  'aroma-threshold',
  'data-processing',
  'shimadzu-analysis',
  'data-analysis',
  'resources',
  'login',
])

for (const route of STATIC_ROUTE_SEGMENTS) {
  const routeDirectory = path.join(distDirectory, route)
  await mkdir(routeDirectory, { recursive: true })
  await copyFile(source, path.join(routeDirectory, 'index.html'))
}
