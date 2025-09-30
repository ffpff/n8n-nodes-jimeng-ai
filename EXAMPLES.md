# 即梦 AI n8n 节点使用示例

本文档提供了即梦 AI 节点的详细使用示例和工作流配置。

## 目录

1. [基础示例](#基础示例)
2. [高级配置示例](#高级配置示例)
3. [工作流示例](#工作流示例)
4. [最佳实践](#最佳实践)

## 基础示例

### 示例 1: 最简单的图片生成

这是最基础的用法,只需提供提示词即可。

**配置**:
```
Operation: Generate Image
Prompt: 一只可爱的柴犬在草地上奔跑,阳光明媚,4K高清
```

**输出**:
```json
{
  "task_id": "task-xxx",
  "status": "done",
  "status_code": 10000,
  "image_urls": ["https://example.com/image.jpg"],
  "binary_data_base64": ["base64-encoded-data"],
  "request_id": "req-xxx"
}
```

**后续操作**:
- 使用 `Write Binary File` 节点保存图片
- 使用 `HTTP Request` 节点下载图片
- 使用 `Move Binary Data` 节点处理 Base64 数据

### 示例 2: 使用预设尺寸

生成 16:9 横向图片,适合社交媒体封面。

**配置**:
```
Operation: Generate Image
Prompt: 现代科技办公室,落地窗,城市天际线背景,专业摄影
Image Size: 1664×936 (横向 16:9)
```

**适用场景**:
- YouTube 视频封面
- 网站 Banner
- 博客文章配图

### 示例 3: 生成可复现的图片

使用固定随机种子,每次生成相同的图片。

**配置**:
```
Operation: Generate Image
Prompt: 未来城市,赛博朋克风格,霓虹灯光
Seed: 42
Use Pre-LLM: false
```

**用途**:
- 测试和调试
- 需要一致性的批量生成
- 品牌形象设计

## 高级配置示例

### 示例 4: 关闭文本扩写

当你的提示词已经很详细时,可以关闭自动扩写。

**配置**:
```
Operation: Generate Image
Prompt: A photo of a golden retriever sitting on a wooden bench in a park, with green trees in the background, soft sunlight, professional photography, 4K resolution, high detail
Use Pre-LLM: false
Width: 1024
Height: 1024
```

**适用场景**:
- 精确控制生成效果
- 专业摄影风格
- 特定构图要求

### 示例 5: 添加水印

为生成的图片添加版权水印。

**配置**:
```
Operation: Generate Image
Prompt: 品牌宣传海报设计
Add Logo: true
Logo Position: Right Bottom (3)
Logo Language: Chinese (0)
Logo Opacity: 0.8
Custom Logo Text: © 2025 Your Company
```

**适用场景**:
- 商业用途
- 版权保护
- 品牌宣传

### 示例 6: 自定义轮询参数

处理大尺寸图片时,需要更长的等待时间。

**配置**:
```
Operation: Generate Image
Prompt: 超高清8K壁纸,抽象艺术,色彩渐变
Width: 2048
Height: 2048
Max Polling Time: 600 (10分钟)
Polling Interval: 5 (5秒)
```

**适用场景**:
- 大尺寸图片生成
- 复杂场景渲染
- 网络不稳定环境

## 工作流示例

### 工作流 1: 博客文章自动配图

**场景**: 根据博客文章标题自动生成配图

**节点配置**:

1. **Webhook** - 接收文章数据
   ```json
   {
     "title": "人工智能的未来发展",
     "category": "科技"
   }
   ```

2. **Code** - 构建提示词
   ```javascript
   const title = $input.item.json.title;
   const category = $input.item.json.category;

   const prompt = `${title}, ${category}主题, 现代简约风格, 蓝紫色调, 扁平化设计, 高清`;

   return {
     json: {
       prompt: prompt,
       originalTitle: title
     }
   };
   ```

3. **Jimeng AI** - 生成图片
   ```
   Prompt: {{$json.prompt}}
   Image Size: 1664×936
   ```

4. **HTTP Request** - 下载图片
   ```
   URL: {{$json.image_urls[0]}}
   Method: GET
   Response Format: Binary
   ```

5. **Write Binary File** - 保存到本地
   ```
   File Path: /images/{{$json.originalTitle}}.jpg
   ```

### 工作流 2: 社交媒体内容生成器

**场景**: 定时生成励志语录配图并发布

**节点配置**:

1. **Schedule Trigger** - 每天 9:00 触发
   ```
   Cron Expression: 0 9 * * *
   ```

2. **HTTP Request** - 获取每日励志语录
   ```
   URL: https://api.quotable.io/random
   Method: GET
   ```

3. **Code** - 准备提示词
   ```javascript
   const quote = $input.item.json.content;

   const prompt = `励志海报设计, 包含文字"${quote}", 温暖色调, 渐变背景, 现代简约`;

   return {
     json: {
       prompt: prompt,
       quote: quote,
       author: $input.item.json.author
     }
   };
   ```

4. **Jimeng AI** - 生成图片
   ```
   Prompt: {{$json.prompt}}
   Image Size: 1328×1328
   Add Logo: true
   Logo Text: Daily Inspiration
   ```

5. **Twitter** - 发布推文
   ```
   Text: {{$json.quote}} - {{$json.author}}
   Media: {{$json.image_urls[0]}}
   ```

### 工作流 3: 电商产品图批量生成

**场景**: 根据产品描述批量生成展示图

**节点配置**:

1. **Google Sheets** - 读取产品列表
   ```
   操作: Read Rows
   工作表: Products
   列: name, description, category
   ```

2. **Loop Over Items** - 批量处理

3. **Code** - 为每个产品构建提示词
   ```javascript
   const name = $input.item.json.name;
   const desc = $input.item.json.description;
   const cat = $input.item.json.category;

   const prompt = `${name}, ${desc}, ${cat}风格, 产品摄影, 白色背景, 专业灯光, 高清细节`;

   return {
     json: {
       ...$input.item.json,
       prompt: prompt
     }
   };
   ```

4. **Jimeng AI** - 生成产品图
   ```
   Prompt: {{$json.prompt}}
   Width: 1024
   Height: 1024
   Seed: {{$json.id}} (使用产品ID作为种子)
   ```

5. **AWS S3** - 上传到云存储
   ```
   Bucket: my-product-images
   File Name: {{$json.id}}.jpg
   Binary Data: {{$json.binary_data_base64[0]}}
   ```

6. **Google Sheets** - 更新图片链接
   ```
   操作: Update Row
   Image URL: {{$json.image_urls[0]}}
   ```

### 工作流 4: AI 故事绘本生成器

**场景**: 根据故事文本生成插图

**节点配置**:

1. **HTTP Request** - 读取故事文本
   ```
   URL: https://your-api.com/story/{{$json.storyId}}
   ```

2. **OpenAI** - 将故事分段并生成场景描述
   ```
   Model: gpt-4
   Prompt: 将以下故事分成5个场景,为每个场景生成详细的视觉描述...
   ```

3. **Split Out** - 分割场景

4. **Jimeng AI** - 为每个场景生成插图
   ```
   Prompt: {{$json.sceneDescription}}
   Image Size: 936×1664 (纵向)
   Use Pre-LLM: true
   Seed: {{$json.sceneNumber}} (保持风格一致)
   ```

5. **PDF** - 合并所有插图为绘本
   ```
   Template: Storybook Layout
   Images: {{$json.image_urls}}
   ```

## 最佳实践

### 1. 提示词优化技巧

**好的提示词**:
```
一只柴犬在樱花树下,春天午后,阳光透过花瓣,景深效果,电影感,4K高清
```

**需要改进的提示词**:
```
柴犬
```

**提示词结构建议**:
1. **主体**: 描述要生成的主要对象
2. **环境**: 场景、背景、氛围
3. **风格**: 艺术风格、摄影风格
4. **质量**: 分辨率、细节要求

### 2. 参数选择指南

| 场景 | 建议配置 |
|------|---------|
| 社交媒体头像 | 1328×1328, use_pre_llm=true |
| 网站横幅 | 1664×936, use_pre_llm=false |
| 手机壁纸 | 936×1664, seed=固定值 |
| 产品展示 | 1024×1024, use_pre_llm=false |
| 艺术创作 | 2048×2048, use_pre_llm=true |

### 3. 错误处理

在工作流中添加错误处理节点:

```javascript
// Code 节点示例
try {
  const result = $input.item.json;

  if (result.status !== 'done') {
    throw new Error(`Task failed: ${result.reason}`);
  }

  if (!result.image_urls || result.image_urls.length === 0) {
    throw new Error('No images generated');
  }

  return { json: result };
} catch (error) {
  // 记录错误
  console.error('Image generation failed:', error);

  // 返回默认图片或重试
  return {
    json: {
      error: error.message,
      fallback_image: 'https://placeholder.com/image.jpg'
    }
  };
}
```

### 4. 性能优化

**批量处理时的优化建议**:

1. **使用合理的轮询间隔**
   - 小尺寸图片: 2-3秒
   - 大尺寸图片: 5-10秒

2. **限制并发请求**
   - 使用 `Loop Over Items` 而不是并行处理
   - 添加延迟避免 API 限流

3. **缓存策略**
   - 对相同提示词和参数缓存结果
   - 使用固定种子实现可复现

### 5. 数据管理

**保存生成的图片**:

```javascript
// 方案 1: 保存 URL (推荐短期使用)
const imageUrl = $json.image_urls[0];

// 方案 2: 保存 Base64 (推荐长期存储)
const base64Data = $json.binary_data_base64[0];

// 方案 3: 下载并上传到云存储 (推荐生产环境)
// 1. 下载图片 (HTTP Request)
// 2. 上传到 S3/OSS (AWS S3 节点)
// 3. 保存永久链接
```

## 常见问题

### Q: 生成的图片不符合预期怎么办?

A: 尝试以下方法:
1. 使用更详细的提示词
2. 关闭文本扩写 (use_pre_llm=false)
3. 调整图像尺寸
4. 多次生成并选择最佳结果

### Q: 如何提高生成速度?

A:
1. 减小图像尺寸
2. 减少轮询间隔 (但不要低于 2 秒)
3. 优化提示词长度

### Q: 图片链接过期后如何处理?

A:
1. 及时下载并保存到本地或云存储
2. 使用 Base64 数据直接处理
3. 重新运行工作流生成新图片

## 更多示例

查看我们的 [GitHub 仓库](https://github.com/YOUR_USERNAME/n8n-jimeng-node) 获取更多工作流示例和模板。

---

有问题或建议?请[提交 Issue](https://github.com/YOUR_USERNAME/n8n-jimeng-node/issues) 或查看[完整文档](./README.md)。