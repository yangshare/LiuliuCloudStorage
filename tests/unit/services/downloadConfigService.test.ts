import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getConfig, updateConfig, resetToDefault } from '../../../src/main/features/downloadConfig/download-config.core.service'

const {
  mockDb,
  mockDrizzle,
  mockSelect,
  mockUpdate,
  mockSet,
  mockWhere,
  mockGet,
  mockRun,
  mockAppGetPath
} = vi.hoisted(() => {
  const mockGet = vi.fn()
  const mockRun = vi.fn()
  const mockWhere = vi.fn(() => ({ get: mockGet, run: mockRun }))
  const mockSelect = vi.fn(() => ({ from: vi.fn(() => ({ where: mockWhere })) }))
  const mockSet = vi.fn(() => ({ where: mockWhere }))
  const mockUpdate = vi.fn(() => ({ set: mockSet }))
  const mockDb = {
    select: mockSelect,
    update: mockUpdate
  }

  return {
    mockDb,
    mockDrizzle: vi.fn(() => mockDb),
    mockSelect,
    mockUpdate,
    mockSet,
    mockWhere,
    mockGet,
    mockRun,
    mockAppGetPath: vi.fn(() => '/mock/downloads')
  }
})

vi.mock('drizzle-orm/better-sqlite3', () => ({
  drizzle: mockDrizzle
}))

vi.mock('../../../src/main/database', () => ({
  getDatabase: vi.fn(() => ({}))
}))

vi.mock('electron', () => ({
  app: {
    getPath: mockAppGetPath
  }
}))

describe('downloadConfigService', () => {
  const mockConfig = {
    id: 1,
    defaultPath: '/mock/downloads/溜溜网盘',
    autoCreateDateFolder: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDrizzle.mockReturnValue(mockDb)
    mockGet.mockReturnValue(mockConfig)
    mockWhere.mockReturnValue({ get: mockGet, run: mockRun })
    mockSet.mockReturnValue({ where: mockWhere })
    mockUpdate.mockReturnValue({ set: mockSet })
  })

  describe('getConfig', () => {
    it('should return download config when it exists', () => {
      const config = getConfig()

      expect(config).toEqual(mockConfig)
    })

    it('should throw error when config not found', () => {
      mockGet.mockReturnValueOnce(null)

      expect(() => getConfig()).toThrow('Download config not found')
    })
  })

  describe('updateConfig', () => {
    it('should update defaultPath', () => {
      const config = updateConfig({ defaultPath: '/new/path' })

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultPath: '/new/path',
          updatedAt: expect.any(Date)
        })
      )
      expect(config).toEqual(mockConfig)
    })

    it('should update autoCreateDateFolder', () => {
      updateConfig({ autoCreateDateFolder: true })

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          autoCreateDateFolder: true,
          updatedAt: expect.any(Date)
        })
      )
    })
  })

  describe('resetToDefault', () => {
    it('should reset to default configuration', () => {
      resetToDefault()

      expect(mockAppGetPath).toHaveBeenCalledWith('downloads')
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultPath: expect.stringContaining('溜溜网盘'),
          autoCreateDateFolder: false
        })
      )
    })
  })
})
