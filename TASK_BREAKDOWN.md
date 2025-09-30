# 即梦 AI 文生图 n8n 节点开发任务拆解

## 一、接口分析总结

### 1. API 概述
- **服务名称**: 即梦 AI 文生图 3.1
- **接口域名**: https://visual.volcengineapi.com
- **认证方式**: AWS Signature V4 (HMAC-SHA256)
- **工作流程**: 异步任务模式
  1. 提交任务 → 获得 task_id
  2. 轮询查询 → 获取生成结果

### 2. 核心接口

#### 接口1: 提交任务 (CVSync2AsyncSubmitTask)
- **必填参数**:
  - `req_key`: 固定值 "jimeng_t2i_v31"
  - `prompt`: 文本提示词 (建议 ≤120字符, 最大800字符)
- **可选参数**:
  - `use_pre_llm`: 是否开启文本扩写 (默认 true)
  - `seed`: 随机种子 (默认 -1)
  - `width` / `height`: 图像尺寸 (需同时传递, 默认 1328×1328)
- **返回**: `task_id`

#### 接口2: 查询任务 (CVSync2AsyncGetResult)
- **必填参数**:
  - `req_key`: 固定值 "jimeng_t2i_v31"
  - `task_id`: 提交任务返回的ID
- **可选参数** (通过 req_json):
  - `return_url`: 是否返回图片链接 (24小时有效)
  - `logo_info`: 水印配置
  - `aigc_meta`: 隐式标识
- **返回状态**:
  - `in_queue`: 已提交
  - `generating`: 处理中
  - `done`: 完成 (成功/失败)
  - `not_found`: 任务未找到
  - `expired`: 任务已过期 (12小时)

### 3. 签名认证要点
- 使用 AWS Signature V4 标准
- 固定 Header: `Region: cn-north-1`, `Service: cv`
- 签名头包含: `host`, `x-date`, `x-content-sha256`, `content-type`

---

## 二、n8n 节点设计

### 1. 节点类型
- **操作类型**: Regular Node (常规操作节点)
- **异步处理**: 支持轮询机制

### 2. 节点配置项

#### 认证凭证 (Credentials)
- Access Key ID
- Secret Access Key

#### 操作选项 (Operations)
1. **生成图片** (Generate Image)
   - 自动处理提交任务 + 轮询查询的完整流程

#### 参数配置
**基础参数**:
- `prompt` (必填): 提示词文本框
- `use_pre_llm` (可选): 布尔开关, 默认 true
- `seed` (可选): 数字输入, 默认 -1

**图像尺寸**:
- `width` (可选): 数字输入, 范围 512-2048
- `height` (可选): 数字输入, 范围 512-2048
- 或提供预设选项: 1328×1328, 1664×936, 2048×2048 等

**查询结果配置**:
- `return_url` (可选): 是否返回图片链接
- `max_polling_time` (可选): 最大轮询时间 (秒), 默认 300
- `polling_interval` (可选): 轮询间隔 (秒), 默认 3

**水印配置** (可选展开):
- `add_logo`: 是否添加水印
- `position`: 水印位置 (0-3)
- `language`: 水印语言 (0=中文, 1=英文)
- `opacity`: 不透明度 (0-1)
- `logo_text_content`: 自定义水印内容

### 3. 输出数据结构
```json
{
  "task_id": "xxx",
  "status": "done",
  "image_urls": ["https://..."],
  "binary_data_base64": ["base64..."],
  "request_id": "xxx"
}
```

---

## 三、开发任务清单

### 阶段1: 项目初始化
- [x] 创建 n8n 节点项目结构
- [x] 配置 package.json 依赖
- [x] 设置 TypeScript 编译配置

### 阶段2: 凭证配置
- [x] 创建 `JimengApi.credentials.ts`
- [x] 定义 Access Key ID / Secret Access Key 字段
- [x] 实现凭证测试方法 (采用节点执行时验证策略)

### 阶段3: 核心 API 类
- [ ] 创建 `JimengApiClient.ts`
- [ ] 实现 AWS Signature V4 签名逻辑
  - URL 编码方法
  - SHA256 哈希
  - HMAC-SHA256
  - 签名密钥生成
- [ ] 实现提交任务方法 (submitTask)
- [ ] 实现查询任务方法 (getTaskResult)
- [ ] 实现轮询机制 (pollTaskResult)

### 阶段4: 节点主逻辑
- [ ] 创建 `JimengAi.node.ts`
- [ ] 定义节点描述 (displayName, icon, inputs/outputs)
- [ ] 配置操作选项 (operations)
- [ ] 定义所有参数字段 (properties)
  - 基础参数
  - 图像尺寸
  - 查询配置
  - 水印配置
- [ ] 实现 execute 方法
  - 读取凭证和参数
  - 调用 submitTask
  - 轮询 getTaskResult 直到完成
  - 返回结果数据

### 阶段5: 错误处理与优化
- [ ] 添加参数校验 (prompt 长度, 尺寸范围等)
- [ ] 处理 API 错误响应
- [ ] 轮询超时处理
- [ ] 添加详细日志输出

### 阶段6: 测试与文档
- [ ] 编写单元测试
- [ ] 本地 n8n 环境测试
- [ ] 编写 README.md
- [ ] 添加使用示例

---

## 四、技术要点

### 1. 签名算法关键点
```
CanonicalRequest =
  HTTP_METHOD + \n
  PATH + \n
  QUERY_STRING (排序后) + \n
  CANONICAL_HEADERS + \n
  SIGNED_HEADERS + \n
  PAYLOAD_HASH

StringToSign =
  "HMAC-SHA256" + \n
  X_DATE + \n
  CREDENTIAL_SCOPE + \n
  HASH(CanonicalRequest)

Signature = HMAC(SigningKey, StringToSign)
```

### 2. 轮询逻辑
```typescript
while (elapsed < maxTime) {
  result = await getTaskResult(taskId);
  if (result.status === 'done') return result;
  if (['not_found', 'expired'].includes(result.status)) throw error;
  await sleep(interval);
}
throw new Error('Polling timeout');
```

### 3. n8n 节点返回格式
```typescript
return [this.helpers.returnJsonArray(results)];
```

---

## 五、文件结构预览

```
n8n-jimeng-node/
├── credentials/
│   └── JimengApi.credentials.ts
├── nodes/
│   └── JimengAi/
│       ├── JimengAi.node.ts
│       ├── JimengApiClient.ts
│       └── jimeng-icon.svg
├── package.json
├── tsconfig.json
└── README.md
```

---

## 六、开发优先级

**P0 (核心功能)**:
- 凭证配置
- 签名算法实现
- 提交任务 + 轮询查询
- 基础参数 (prompt, seed, width/height)

**P1 (重要功能)**:
- 图像尺寸预设选项
- return_url 配置
- 轮询超时控制
- 错误处理

**P2 (增强功能)**:
- 水印配置
- AIGC 隐式标识
- 详细日志
- 单元测试

---

## 七、注意事项

1. **安全性**: Secret Access Key 必须加密存储,不可明文记录
2. **时效性**:
   - 图片链接 24 小时有效
   - 任务结果 12 小时过期
3. **参数校验**:
   - prompt 最大 800 字符
   - width/height 必须同时传递
   - 宽高比限制 1:3 到 3:1
4. **默认值**: use_pre_llm=true 适合短 prompt
5. **轮询策略**: 建议初始间隔 2-3 秒,可逐步增加

---

## 八、开发时间估算

- 阶段1-2 (项目初始化 + 凭证): 1 小时
- 阶段3 (API 客户端): 3 小时
- 阶段4 (节点主逻辑): 3 小时
- 阶段5 (错误处理): 2 小时
- 阶段6 (测试文档): 2 小时

**总计**: 约 11 小时 (1.5 工作日)