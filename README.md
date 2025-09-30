# n8n-nodes-jimeng-ai

这是一个 n8n 社区节点,用于集成[即梦 AI 文生图 3.1](https://www.volcengine.com/docs/6791/1343077) API。即梦 AI 是火山引擎提供的文本生成图片服务,支持高质量的 AI 图像生成。

## 功能特性

- ✅ 支持文本到图片生成 (Text-to-Image)
- ✅ 自动轮询任务结果,无需手动查询
- ✅ 支持文本扩写 (use_pre_llm)
- ✅ 自定义图像尺寸 (512-2048px)
- ✅ 固定随机种子以获得可复现结果
- ✅ 支持添加水印配置
- ✅ 返回图片 URL 和 Base64 数据

## 安装

### 社区节点安装 (推荐)

在 n8n 中,进入 **Settings > Community Nodes** 并搜索 `n8n-nodes-jimeng-ai` 进行安装。

### 手动安装

```bash
cd ~/.n8n/nodes
git clone https://github.com/YOUR_USERNAME/n8n-jimeng-node.git
cd n8n-jimeng-node
npm install
npm run build
```

然后重启 n8n:

```bash
n8n start
```

## 配置

### 1. 获取 API 凭证

1. 注册并登录[火山引擎控制台](https://console.volcengine.com/)
2. 开通[即梦 AI 服务](https://www.volcengine.com/product/vepix)
3. 在 **访问密钥管理** 中创建 Access Key ID 和 Secret Access Key

### 2. 在 n8n 中配置凭证

1. 在 n8n 中创建新的 **Jimeng AI** 凭证
2. 填入你的 Access Key ID 和 Secret Access Key
3. 保存凭证

## 使用方法

### 基础示例

最简单的用法是只提供 `prompt` 参数:

```
提示词: "一只可爱的柴犬在草地上奔跑,阳光明媚,4K高清"
```

节点会自动:
1. 提交图片生成任务
2. 轮询任务状态直到完成
3. 返回生成的图片 URL 和 Base64 数据

### 高级配置

**图像尺寸**:
- 预设选项: 1328×1328 (正方形), 1664×936 (16:9), 936×1664 (9:16)
- 自定义尺寸: 512-2048px,宽高比 1:3 到 3:1

**文本扩写**:
- 启用 `use_pre_llm`: 短提示词会自动扩写为更详细的描述
- 关闭 `use_pre_llm`: 使用精确的原始提示词

**随机种子**:
- 设置固定的 `seed` 值 (例如 42) 可以获得可复现的结果
- 使用 -1 (默认) 会生成随机图片

**轮询配置**:
- `max_polling_time`: 最大轮询时间 (秒),默认 300
- `polling_interval`: 轮询间隔 (秒),默认 3

**水印配置**:
- 位置: 左上角 (0), 右上角 (1), 左下角 (2), 右下角 (3)
- 语言: 中文 (0), 英文 (1)
- 不透明度: 0-1 (0=完全透明, 1=不透明)
- 自定义文本: 可选

## 输出数据

节点返回以下数据:

```json
{
  "task_id": "xxx",
  "status": "done",
  "status_code": 10000,
  "image_urls": ["https://..."],
  "binary_data_base64": ["base64..."],
  "request_id": "xxx"
}
```

**字段说明**:
- `task_id`: 任务 ID
- `status`: 任务状态 (done/generating/in_queue)
- `status_code`: 状态码 (10000 表示成功)
- `image_urls`: 图片 URL 数组 (24小时有效)
- `binary_data_base64`: 图片 Base64 数据数组
- `request_id`: 请求 ID

## 工作流示例

### 示例 1: 简单图片生成

```
1. [Start] 手动触发
2. [Set] 设置提示词
3. [Jimeng AI] 生成图片
4. [Write Binary File] 保存图片到本地
```

### 示例 2: 批量生成

```
1. [Schedule Trigger] 定时触发
2. [Code] 生成多个提示词
3. [Jimeng AI] 批量生成图片
4. [Google Drive] 上传到云盘
```

### 示例 3: 结合其他服务

```
1. [Webhook] 接收用户请求
2. [OpenAI] 优化提示词
3. [Jimeng AI] 生成图片
4. [SendGrid] 发送邮件通知
```

## 限制与注意事项

⚠️ **重要限制**:

1. **提示词长度**: 最大 800 字符,建议 ≤ 120 字符
2. **图片链接有效期**: 24 小时
3. **任务结果保留时间**: 12 小时
4. **宽高比限制**: 1:3 到 3:1
5. **图像尺寸范围**: 512-2048px

💡 **最佳实践**:

- 使用详细且清晰的提示词获得更好的效果
- 启用文本扩写 (use_pre_llm) 可以提升短提示词的生成质量
- 对于需要可复现结果的场景,设置固定的随机种子
- 及时保存或处理生成的图片,避免 URL 过期
- 合理设置轮询间隔以平衡响应速度和 API 调用频率

## 故障排除

### 错误: "任务提交失败"
- 检查 API 凭证是否正确
- 确认即梦 AI 服务已开通
- 检查提示词是否包含敏感内容

### 错误: "轮询超时"
- 增加 `max_polling_time` 参数
- 检查网络连接
- 减小图像尺寸

### 错误: "任务未找到"
- 任务可能已过期 (12小时)
- 检查 task_id 是否正确

## 开发

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/n8n-jimeng-node.git
cd n8n-jimeng-node

# 安装依赖
npm install

# 运行测试
npm test

# 构建
npm run build

# 监听文件变化
npm run dev
```

### 集成到本地 n8n (Docker 环境)

如果你的 n8n 运行在 Docker 中,按以下步骤集成自定义节点:

#### 步骤 1: 修改 docker-compose.yaml

在你的 n8n docker-compose 文件中添加节点挂载:

```yaml
services:
  myn8n:
    image: n8nio/n8n:latest
    container_name: Myn8n
    ports:
      - "5678:5678"
    volumes:
      - /Users/romi/Documents/Projects/n8n/data:/home/node/.n8n
      - /Users/romi/Documents/Projects/n8n/output:/home/node/output
      # 添加自定义节点挂载
      - /path/to/n8n-jimeng-node:/data/custom-nodes/n8n-nodes-jimeng
    environment:
      TZ: Asia/Shanghai
      # 添加自定义扩展路径
      N8N_CUSTOM_EXTENSIONS: /data/custom-nodes
```

**注意**: 将 `/path/to/n8n-jimeng-node` 替换为你本地节点项目的实际路径。

#### 步骤 2: 构建并启动

```bash
# 1. 构建节点
npm run build

# 2. 停止并重新启动容器
docker-compose -f your-docker-compose.yaml down
docker-compose -f your-docker-compose.yaml up -d

# 3. 查看日志确认加载成功
docker-compose -f your-docker-compose.yaml logs -f
```

#### 步骤 3: 验证安装

1. 打开 n8n Web 界面 (http://localhost:5678)
2. 创建新的工作流
3. 在节点搜索框输入 "Jimeng" 或 "即梦"
4. 应该能看到 **Jimeng AI** 节点

#### 开发时的热更新流程

每次修改代码后:

```bash
# 1. 重新构建
npm run build

# 2. 重启容器
docker-compose -f your-docker-compose.yaml restart

# 3. 刷新 n8n Web 界面
```

#### 常见问题

**Q: 修改代码后节点没有更新?**
- 确保执行了 `npm run build`
- 重启 Docker 容器
- 清除浏览器缓存并刷新页面

**Q: 找不到节点?**
- 检查 `dist/` 目录是否生成
- 查看容器日志: `docker-compose logs -f`
- 确认 `N8N_CUSTOM_EXTENSIONS` 环境变量已设置

**Q: 节点加载错误?**
- 进入容器检查: `docker exec -it Myn8n ls -la /data/custom-nodes/n8n-nodes-jimeng`
- 确保 `package.json` 中的 `n8n.nodes` 配置正确
- 检查节点代码是否有编译错误

### 运行测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch

# 测试覆盖率
npm run test:coverage
```

### 代码质量

```bash
# 代码检查
npm run lint

# 自动修复
npm run lintfix

# 代码格式化
npm run format
```

## 技术栈

- **n8n**: 工作流自动化平台
- **TypeScript**: 主要开发语言
- **AWS Signature V4**: API 认证方式
- **Jest**: 测试框架

## API 文档

- [即梦 AI 文生图 3.1 API 文档](https://www.volcengine.com/docs/6791/1343077)
- [火山引擎控制台](https://console.volcengine.com/)

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request!

在提交 PR 之前,请确保:
- 所有测试通过 (`npm test`)
- 代码通过 lint 检查 (`npm run lint`)
- 代码已格式化 (`npm run format`)

## 支持

如果你觉得这个项目有用,请给个 ⭐️ Star!

有问题或建议?请[提交 Issue](https://github.com/YOUR_USERNAME/n8n-jimeng-node/issues)。

## 更新日志

### 0.1.0 (2025-01-XX)

- ✨ 初始版本
- ✅ 支持文本生成图片
- ✅ 自动轮询任务结果
- ✅ 完整的参数配置选项
- ✅ 单元测试覆盖率 > 85%

---

Made with ❤️ for the n8n community