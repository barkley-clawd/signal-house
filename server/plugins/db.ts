import { defineNitroPlugin } from 'nitropack/runtime'
import { close, initDb } from '../db/client'

export default defineNitroPlugin(async (nitroApp) => {
  await initDb()
  console.info('[db] initialized')

  nitroApp.hooks.hook('close', () => {
    close()
    console.info('[db] closed')
  })
})
