import { faker } from '@faker-js/faker'

export const createTestUser = () => ({
  username: faker.internet.username(),
  password: faker.internet.password({ length: 12 })
})

export const createAdminUser = () => ({
  username: 'admin',
  password: 'admin123'
})
