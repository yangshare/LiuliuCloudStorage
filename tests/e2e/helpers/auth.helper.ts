import { Page } from '@playwright/test'

export async function login(page: Page, username: string, password: string) {
  await page.goto('http://localhost:5173/login')
  await page.fill('input[type="text"]', username)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/home')
}
