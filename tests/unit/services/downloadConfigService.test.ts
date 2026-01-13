import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getConfig, updateConfig, resetToDefault } from '../../../src/main/services/downloadConfigService'

// Mock dependencies
vi.mock('../../../src/main/database', () => ({
  getDatabase: vi.fn(() => mockDb)
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/downloads')
  }
}))

const mockDb = {
  prepare: vi.fn(),
  exec: vi.fn()
}

describe('downloadConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getConfig', () => {
    it('should return download config when it exists', () => {
      const mockConfig = {
        id: 1,
        defaultPath: '/mock/downloads/溜溜网盘',
        autoCreateDateFolder: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Mock Drizzle query chain
      const mockGet = vi.fn(() => mockConfig)
      const mockWhere = vi.fn(() => ({ get: mockGet }))
      const mockFrom = vi.fn(() => ({ where: mockWhere }))
      const mockSelect = vi.fn(() => ({ from: mockFrom }))

      vi.doMock('drizzle-orm/better-sqlite3', () => ({
        drizzle: vi.fn(() => ({ select: mockSelect }))
      }))

      const config = getConfig()

      expect(config).toEqual(mockConfig)
    })

    it('should throw error when config not found', () => {
      const mockGet = vi.fn(() => null)
      const mockWhere = vi.fn(() => ({ get: mockGet }))
      const mockFrom = vi.fn(() => ({ where: mockWhere }))
      const mockSelect = vi.fn(() => ({ from: mockFrom }))

      vi.doMock('drizzle-orm/better-sqlite3', () => ({
        drizzle: vi.fn(() => ({ select: mockSelect }))
      }))

      expect(() => getConfig()).toThrow('Download config not found')
    })
  })

  describe('updateConfig', () => {
    it('should update defaultPath', () => {
      const mockRun = vi.fn()
      const mockWhere = vi.fn(() => ({ run: mockRun }))
      const mockSet = vi.fn(() => ({ where: mockWhere }))
      const mockUpdate = vi.fn(() => ({ set: mockSet }))

      vi.doMock('drizzle-orm/better-sqlite3', () => ({
        drizzle: vi.fn(() => ({ update: mockUpdate }))
      }))

      updateConfig({ defaultPath: '/new/path' })

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultPath: '/new/path'
        })
      )
    })

    it('should update autoCreateDateFolder', () => {
      const mockRun = vi.fn()
      const mockWhere = vi.fn(() => ({ run: mockRun }))
      const mockSet = vi.fn(() => ({ where: mockWhere }))
      const mockUpdate = vi.fn(() => ({ set: mockSet }))

      vi.doMock('drizzle-orm/better-sqlite3', () => ({
        drizzle: vi.fn(() => ({ update: mockUpdate }))
      }))

      updateConfig({ autoCreateDateFolder: true })

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          autoCreateDateFolder: true
        })
      )
    })
  })

  describe('resetToDefault', () => {
    it('should reset to default configuration', () => {
      const mockRun = vi.fn()
      const mockWhere = vi.fn(() => ({ run: mockRun }))
      const mockSet = vi.fn(() => ({ where: mockWhere }))
      const mockUpdate = vi.fn(() => ({ set: mockSet }))

      vi.doMock('drizzle-orm/better-sqlite3', () => ({
        drizzle: vi.fn(() => ({ update: mockUpdate }))
      }))

      resetToDefault()

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultPath: expect.stringContaining('溜溜网盘'),
          autoCreateDateFolder: false
        })
      )
    })
  })
})
