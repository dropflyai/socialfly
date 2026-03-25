import { initEngine, generateContentCalendar } from '../src/lib/engine/index.js'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env.local') })

initEngine()

async function main() {
  const calendar = await generateContentCalendar({
    userId: '40ef93a5-1212-4878-b2b6-7285a39fc40c',
    platforms: ['instagram', 'facebook'],
    startDate: '2026-03-25',
    days: 7,
    postsPerDay: 2,
    themes: [
      'AI transforming small business',
      'VoiceFly product demos and use cases',
      'Build in public — DropFly AI fleet story',
      'TaxFly tax tips and deduction alerts',
      'SocialFly marketing automation',
      'AI industry news and hot takes',
    ],
    tone: 'professional but approachable',
  })

  console.log('=== CONTENT CALENDAR: ' + calendar.startDate + ' to ' + calendar.endDate + ' ===')
  console.log('ID:', calendar.id)
  console.log('Total entries:', calendar.entries.length)
  console.log('Themes:', calendar.themes?.join(', '))
  console.log('')

  for (const entry of calendar.entries) {
    const pad = (s: string, n: number) => s.padEnd(n)
    console.log(
      entry.date + ' ' + entry.time + ' | ' +
      pad(entry.platform.toUpperCase(), 10) + ' | ' +
      pad(entry.contentType, 14) + ' | ' +
      pad(entry.tone || '', 15) + ' | ' +
      entry.topic
    )
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
