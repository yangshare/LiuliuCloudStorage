/**
 * 分享转存接口测试脚本
 * 运行方式: AMB_TRANSFER_TOKEN=xxx node scripts/test-share-transfer.js
 *
 * 注意：请勿将 Token 硬编码或提交到代码库
 */

const axios = require('axios')

const AMB_API_BASE_URL = process.env.AMB_API_BASE_URL || 'https://amb.yangshare.com/prod-api'
const FIXED_TOKEN = process.env.AMB_TRANSFER_TOKEN

if (!FIXED_TOKEN) {
  console.error('错误：请设置环境变量 AMB_TRANSFER_TOKEN')
  console.error('例如：AMB_TRANSFER_TOKEN=xxx node scripts/test-share-transfer.js')
  process.exit(1)
}

async function testExec(url) {
  console.log('\n=== 测试转存接口 POST /bdshare/transfer/exec ===')
  console.log(`URL: ${url}`)

  try {
    const response = await axios.post(`${AMB_API_BASE_URL}/bdshare/transfer/exec`, {
      token: FIXED_TOKEN,
      url
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    })

    console.log('响应状态:', response.status)
    console.log('响应数据:', JSON.stringify(response.data, null, 2))
    return response.data
  } catch (error) {
    if (error.response) {
      console.log('错误状态:', error.response.status)
      console.log('错误数据:', JSON.stringify(error.response.data, null, 2))
    } else {
      console.log('请求错误:', error.message)
    }
    return null
  }
}

async function testList(pageNum = 1, pageSize = 10) {
  console.log('\n=== 测试列表接口 GET /bdshare/transfer/list ===')
  console.log(`参数: pageNum=${pageNum}, pageSize=${pageSize}`)

  try {
    const response = await axios.get(`${AMB_API_BASE_URL}/bdshare/transfer/list`, {
      params: { pageNum, pageSize },
      timeout: 10000
    })

    console.log('响应状态:', response.status)
    console.log('响应数据:', JSON.stringify(response.data, null, 2))
    return response.data
  } catch (error) {
    if (error.response) {
      console.log('错误状态:', error.response.status)
      console.log('错误数据:', JSON.stringify(error.response.data, null, 2))
    } else {
      console.log('请求错误:', error.message)
    }
    return null
  }
}

async function testLatest() {
  console.log('\n=== 测试最新记录接口 GET /bdshare/transfer/latest ===')

  try {
    const response = await axios.get(`${AMB_API_BASE_URL}/bdshare/transfer/latest`, {
      timeout: 10000
    })

    console.log('响应状态:', response.status)
    console.log('响应数据:', JSON.stringify(response.data, null, 2))
    return response.data
  } catch (error) {
    if (error.response) {
      console.log('错误状态:', error.response.status)
      console.log('错误数据:', JSON.stringify(error.response.data, null, 2))
    } else {
      console.log('请求错误:', error.message)
    }
    return null
  }
}

async function testAlready(id) {
  console.log(`\n=== 测试标记完成接口 GET /bdshare/transfer/already/${id} ===`)

  try {
    const response = await axios.get(`${AMB_API_BASE_URL}/bdshare/transfer/already/${id}`, {
      timeout: 10000
    })

    console.log('响应状态:', response.status)
    console.log('响应数据:', JSON.stringify(response.data, null, 2))
    return response.data
  } catch (error) {
    if (error.response) {
      console.log('错误状态:', error.response.status)
      console.log('错误数据:', JSON.stringify(error.response.data, null, 2))
    } else {
      console.log('请求错误:', error.message)
    }
    return null
  }
}

async function main() {
  console.log('========================================')
  console.log('分享转存接口测试')
  console.log('AMB API 基础地址:', AMB_API_BASE_URL)
  console.log('固定 Token:', FIXED_TOKEN)
  console.log('========================================')

  // 测试列表接口
  await testList(1, 5)

  // 测试最新记录接口
  await testLatest()

  // 测试转存接口（使用测试链接）
  const testUrl = process.env.SHARE_URL
  if (testUrl) {
    await testExec(testUrl)
  } else {
    console.log('\n[跳过转存测试] 如需测试，请设置环境变量 SHARE_URL')
    console.log('例如: SHARE_URL=https://pan.baidu.com/s/1xxxxx node scripts/test-share-transfer.js')
  }

  console.log('\n========================================')
  console.log('测试完成')
  console.log('========================================')
}

main().catch(console.error)
