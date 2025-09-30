# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目状态

⚠️ **项目尚未初始化** - 这是一个即梦 AI 文生图 3.1 的 n8n 自定义节点项目，目前只有 API 文档和示例代码。

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

## 参考文件

- `jimeng-api.md`: 完整 API 文档
- `TASK_BREAKDOWN.md`: 详细开发任务清单
- `jimeng-api.js`: JavaScript 签名实现示例
- `example.java`: Java 签名实现参考

# TDD 开发规范

## 原则
1. **测试先行**: 编写功能代码前必须先编写对应的单元测试
2. **红绿重构**: 遵循 Red (失败测试) → Green (通过测试) → Refactor (重构代码) 循环
3. **小步迭代**: 每次只测试一个功能点,避免大而全的测试

## 测试框架选择
- **Node.js 项目**: 使用 Jest 或 Mocha + Chai
- **TypeScript 项目**: 使用 Jest + @types/jest
- **覆盖率工具**: nyc (Istanbul) 或 Jest 内置覆盖率

## 测试文件组织
```
project/
├── src/
│   ├── module.ts
│   └── module.test.ts    # 测试文件与源文件同级
└── test/                  # 或统一放在 test/ 目录
    └── module.test.ts
```

## 测试编写规范

### 1. 测试结构 (AAA 模式)
```typescript
describe('模块/类名', () => {
  describe('方法名', () => {
    it('应该...', () => {
      // Arrange (准备)
      const input = ...;
      const expected = ...;

      // Act (执行)
      const result = functionUnderTest(input);

      // Assert (断言)
      expect(result).toBe(expected);
    });
  });
});
```

### 2. 测试命名
- 使用 `describe` 嵌套描述测试场景层次
- `it` 描述应该完整说明预期行为: "应该在 X 情况下返回 Y"
- 中文或英文均可,保持一致性

### 3. 测试覆盖维度
**功能维度**:
- ✅ 正常路径 (Happy Path): 正常输入得到正确输出
- ✅ 边界情况 (Boundary Cases): 空值、最大值、最小值
- ✅ 异常处理 (Error Cases): 错误输入、网络失败、超时

**代码维度**:
- 语句覆盖率 (Statement Coverage): 目标 > 80%
- 分支覆盖率 (Branch Coverage): 目标 > 75%
- 函数覆盖率 (Function Coverage): 目标 100%

### 4. Mock 与 Stub 使用
- **外部依赖**: 必须 mock (HTTP 请求、数据库、文件系统)
- **时间相关**: 使用 `jest.useFakeTimers()` 控制时间
- **随机性**: 固定随机种子或 mock Math.random()

### 5. 异步测试
```typescript
// Promise
it('应该异步返回结果', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expected);
});

// 错误捕获
it('应该抛出错误', async () => {
  await expect(asyncFunction()).rejects.toThrow('错误信息');
});
```

## n8n 节点测试特殊要求

### 1. 凭证测试
```typescript
describe('Credentials', () => {
  it('应该验证必填字段', () => {
    const credentials = new JimengApiCredentials();
    expect(credentials.properties).toContainEqual(
      expect.objectContaining({ name: 'accessKeyId', required: true })
    );
  });
});
```

### 2. 节点执行测试
```typescript
describe('Node Execution', () => {
  it('应该正确处理输入并返回结果', async () => {
    const mockExecuteFunctions = {
      getCredentials: jest.fn().mockResolvedValue({ accessKeyId: 'xxx', secretAccessKey: 'xxx' }),
      getNodeParameter: jest.fn((param) => mockParams[param]),
      helpers: { returnJsonArray: jest.fn(data => data) }
    };

    const result = await node.execute.call(mockExecuteFunctions);
    expect(result).toEqual(expectedOutput);
  });
});
```

### 3. API 客户端测试
- Mock https.request 避免真实网络请求
- 测试签名算法的正确性 (对比官方示例)
- 测试轮询逻辑的超时和重试机制

## 执行流程

### 开发新功能时:
1. **编写测试用例** (失败状态)
2. **运行测试** → 确认红色 (失败)
3. **编写最小实现** → 让测试通过
4. **运行测试** → 确认绿色 (通过)
5. **重构代码** → 优化结构,保持测试通过
6. **提交代码** → 包含测试文件

### 修复 Bug 时:
1. **编写重现 Bug 的测试** (失败)
2. **修复代码** → 让测试通过
3. **运行全部测试** → 确保无回归
4. **提交代码** → 包含新增测试

## 测试命令配置
```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

## 示例: 签名算法 TDD 流程

**第一步: 编写测试**
```typescript
describe('JimengApiClient', () => {
  describe('urlEncode', () => {
    it('应该正确编码特殊字符', () => {
      const client = new JimengApiClient('ak', 'sk');
      expect(client.urlEncode("hello world")).toBe("hello%20world");
      expect(client.urlEncode("foo!bar")).toBe("foo%21bar");
    });
  });

  describe('hashSHA256', () => {
    it('应该返回正确的 SHA256 哈希', () => {
      const client = new JimengApiClient('ak', 'sk');
      const input = "test";
      const expected = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
      expect(client.hashSHA256(input)).toBe(expected);
    });
  });
});
```

**第二步: 运行测试** (失败 - 方法未实现)

**第三步: 实现代码**
```typescript
class JimengApiClient {
  urlEncode(str: string): string {
    return encodeURIComponent(str).replace(/%20/g, '%20').replace(/[!'()*]/g, ...);
  }

  hashSHA256(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
```

**第四步: 运行测试** (通过)

**第五步: 重构并保持测试通过**

## 禁止事项
❌ 不要先写完所有代码再补测试
❌ 不要为了覆盖率而写无意义测试
❌ 不要跳过失败的测试 (使用 it.skip)
❌ 不要在测试中使用真实的外部依赖
❌ 不要提交未通过测试的代码