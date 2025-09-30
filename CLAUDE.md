# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

这是一个 n8n 社区节点，用于集成**即梦 AI 文生图 3.1** (火山引擎) API。项目使用 TypeScript 开发，遵循 TDD 原则。

## 核心 API 信息

- **服务**: 即梦 AI 文生图 3.1
- **接口域名**: https://visual.volcengineapi.com
- **认证方式**: AWS Signature V4 (HMAC-SHA256)
- **固定参数**:
  - Region: `cn-north-1`
  - Service: `cv`
  - req_key: `jimeng_t2i_v31`

## 异步任务流程

1. **提交任务** (`CVSync2AsyncSubmitTask`):
   - Action: `CVSync2AsyncSubmitTask`
   - Version: `2022-08-31`
   - 必填参数: `req_key`, `prompt`
   - 返回: `task_id`

2. **查询结果** (`CVSync2AsyncGetResult`):
   - Action: `CVSync2AsyncGetResult`
   - Version: `2022-08-31`
   - 必填参数: `req_key`, `task_id`
   - 状态: `in_queue` → `generating` → `done`

## 签名算法关键点

- 使用 AWS Signature V4 标准
- 签名头包含: `host`, `x-date`, `x-content-sha256`, `content-type`
- 查询参数必须按字母排序
- URL 编码规则: 空格 → `%20`, 保留字符 `-_.~`

## 参数限制

- prompt: 最大 800 字符，建议 ≤ 120
- 图像尺寸: [512, 2048]，宽高比 1:3 到 3:1
- 任务结果: 12 小时过期
- 图片链接: 24 小时有效

## n8n 开发重点

- 节点类型: Regular Node
- 轮询机制: 默认间隔 3 秒，最大轮询时间 300 秒
- 凭证配置: Access Key ID + Secret Access Key
- 输出: task_id, status, image_urls, binary_data_base64

## 代码架构

```
credentials/
  └── JimengApi.credentials.ts    # n8n 凭证配置 (Access Key ID + Secret)
nodes/
  └── JimengAi/
      ├── JimengAi.node.ts         # n8n 节点主逻辑 (参数定义、execute 方法)
      └── JimengApiClient.ts       # API 客户端 (AWS Signature V4、任务提交/查询)
test/
  └── JimengApiClient.test.ts      # 单元测试 (签名算法、API 调用)
```

### 关键类/方法

- `JimengApiClient`:
  - `submitTask()`: 提交图片生成任务，返回 task_id
  - `getResult()`: 查询任务结果，返回状态和图片 URLs
  - `signRequest()`: AWS Signature V4 签名实现（核心算法）
  - `urlEncode()`, `hashSHA256()`, `hmacSHA256()`: 签名辅助方法

- `JimengAi.node.ts`:
  - `execute()`: 节点执行入口，包含轮询逻辑
  - 轮询机制：默认 3 秒间隔，最大 300 秒超时

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式 (自动编译)
npm run dev

# 构建
npm run build

# 测试
npm test                  # 运行所有测试
npm run test:watch        # 监听模式
npm run test:coverage     # 测试覆盖率 (目标: statements>80%, functions=100%)

# 代码质量
npm run lint              # ESLint 检查
npm run lintfix           # 自动修复
npm run format            # Prettier 格式化
```

## 测试重点

**必须 Mock 的外部依赖**:
- `https.request`: 所有 API 调用
- 时间相关: 使用 `jest.useFakeTimers()` 测试轮询逻辑

**关键测试用例**:
1. **签名算法**: 对比官方示例验证 `signRequest()` 正确性
2. **URL 编码**: 特殊字符处理 (空格→`%20`, 保留`-_.~`)
3. **任务提交**: 测试 `submitTask()` 的请求体和响应解析
4. **任务查询**: 测试 `getResult()` 的状态判断 (in_queue/generating/done)
5. **轮询超时**: 测试达到 max_polling_time 时的行为
6. **错误处理**: 网络失败、API 返回错误码、超时等场景

## TDD 开发流程

1. **测试先行**: 编写功能代码前先写测试
2. **红→绿→重构**: 失败测试 → 通过测试 → 优化代码
3. **覆盖率要求**: statements>80%, branches>75%, functions=100%
4. **提交前检查**: 确保 `npm test` 和 `npm run lint` 都通过

## 参考文件

- `jimeng-api.md`: 完整 API 文档
- `TASK_BREAKDOWN.md`: 开发任务清单
- `jimeng-api.js`: JavaScript 签名实现示例
- `README.md`: 用户使用文档