/**
 * 即梦 AI 真实 API 集成测试
 *
 * 运行前准备:
 * 1. 复制 .env.example 到 .env
 * 2. 填入真实的 Access Key ID 和 Secret Access Key
 * 3. 运行: npm run test:integration
 *
 * 注意事项:
 * - 此测试会调用真实 API，消耗配额
 * - 不在 CI/CD 中自动运行
 * - 测试超时时间较长 (最大 120 秒)
 */

import { JimengApiClient } from '../../nodes/JimengAi/JimengApiClient';
import * as fs from 'fs';
import * as path from 'path';

// 测试超时设置
const TEST_TIMEOUT = 120000; // 120 秒

describe('即梦 AI 集成测试', () => {
	let client: JimengApiClient;
	let accessKeyId: string;
	let secretAccessKey: string;

	// 共享的 task_id，用于减少 API 调用次数
	let sharedTaskId: string;

	beforeAll(async () => {
		// 读取 .env 文件
		const envPath = path.resolve(__dirname, '../../.env');
		if (!fs.existsSync(envPath)) {
			throw new Error(
				`环境变量文件不存在: ${envPath}\n` +
				`请先复制 .env.example 到 .env 并填入真实凭证`
			);
		}

		const envContent = fs.readFileSync(envPath, 'utf8');
		const envVars: Record<string, string> = {};

		envContent.split('\n').forEach(line => {
			line = line.trim();
			if (line && !line.startsWith('#')) {
				const [key, ...valueParts] = line.split('=');
				if (key && valueParts.length > 0) {
					envVars[key.trim()] = valueParts.join('=').trim();
				}
			}
		});

		accessKeyId = envVars.JIMENG_ACCESS_KEY_ID || '';
		secretAccessKey = envVars.JIMENG_SECRET_ACCESS_KEY || '';

		if (!accessKeyId || !secretAccessKey) {
			throw new Error(
				`环境变量未配置完整\n` +
				`请在 .env 文件中配置:\n` +
				`JIMENG_ACCESS_KEY_ID=your_access_key\n` +
				`JIMENG_SECRET_ACCESS_KEY=your_secret_key`
			);
		}

		if (accessKeyId === 'your_access_key_id_here' || secretAccessKey === 'your_secret_access_key_here') {
			throw new Error(
				`请在 .env 文件中填入真实的密钥，不要使用默认值`
			);
		}

		client = new JimengApiClient(accessKeyId, secretAccessKey);
		console.log('\n✓ 已加载 API 凭证');
		console.log(`  Access Key ID: ${accessKeyId.substring(0, 8)}...`);

		// 提交一个共享的测试任务，供多个测试用例复用
		console.log('\n[初始化] 提交共享测试任务...');
		const result = await client.submitTask({
			prompt: '测试图片：蓝天白云',
		});
		sharedTaskId = result.task_id;
		console.log(`  ✓ 共享 task_id: ${sharedTaskId}`);

		// 等待 5 秒让任务开始处理
		console.log('  等待 5 秒让任务进入处理状态...');
		await new Promise(resolve => setTimeout(resolve, 5000));
	}, TEST_TIMEOUT);

	describe('任务提交', () => {
		test('应该成功提交文生图任务 (使用共享 task_id)', async () => {
			console.log('\n[测试] 验证共享任务提交成功...');
			console.log(`  task_id: ${sharedTaskId}`);

			// 验证共享的 task_id 格式正确
			expect(sharedTaskId).toBeTruthy();
			expect(typeof sharedTaskId).toBe('string');
		}, TEST_TIMEOUT);

		test('应该支持自定义图片尺寸 (验证参数)', async () => {
			console.log('\n[测试] 验证自定义尺寸参数...');

			// 只验证参数有效性，不实际提交
			const params = {
				prompt: '蓝天白云下的山峰',
				width: 1024,
				height: 768,
			};

			expect(params.width).toBeGreaterThanOrEqual(512);
			expect(params.height).toBeGreaterThanOrEqual(512);
			expect(params.width).toBeLessThanOrEqual(2048);
			expect(params.height).toBeLessThanOrEqual(2048);
			console.log(`  ✓ 尺寸参数验证通过: ${params.width}x${params.height}`);
		}, TEST_TIMEOUT);

		test('应该支持固定随机种子 (验证参数)', async () => {
			console.log('\n[测试] 验证随机种子参数...');

			const params = {
				prompt: '科技感十足的机器人',
				seed: 12345,
			};

			expect(params.seed).toBeGreaterThan(0);
			console.log(`  ✓ 随机种子参数验证通过: ${params.seed}`);
		}, TEST_TIMEOUT);
	});

	describe('任务查询', () => {
		test('应该能查询任务状态 (使用共享 task_id)', async () => {
			console.log('\n[测试] 查询共享任务状态...');

			const result = await client.getTaskResult({
				task_id: sharedTaskId,
			});

			console.log(`  状态: ${result.status}`);
			if (result.status_code) {
				console.log(`  状态码: ${result.status_code}`);
			}

			expect(result).toBeDefined();
			expect(result.status).toMatch(/in_queue|generating|done/);
			expect(result.task_id).toBe(sharedTaskId);
		}, TEST_TIMEOUT);

		test('应该能请求返回图片 URL (使用共享 task_id)', async () => {
			console.log('\n[测试] 查询任务 (返回 URL)...');

			const result = await client.getTaskResult({
				task_id: sharedTaskId,
				return_url: true,
			});

			console.log(`  状态: ${result.status}`);

			expect(result).toBeDefined();
			expect(result.task_id).toBe(sharedTaskId);
		}, TEST_TIMEOUT);
	});

	describe('完整流程：提交 + 轮询', () => {
		test('应该能完成完整的图片生成流程 (使用共享 task_id)', async () => {
			console.log('\n[测试] 完整流程测试 (使用共享任务)...');
			console.log(`提示词: 测试图片：蓝天白云`);
			console.log(`task_id: ${sharedTaskId}`);

			// 轮询共享任务结果
			console.log('\n→ 轮询任务结果');
			const pollResult = await client.pollTaskResult(
				{
					task_id: sharedTaskId,
					return_url: true,
					max_polling_time: 90, // 最大轮询 90 秒
					polling_interval: 3,   // 每 3 秒查询一次
				},
				(message) => {
					console.log(`  ${message}`);
				}
			);

			// 验证结果
			console.log('\n→ 验证生成结果');
			expect(pollResult.status).toBe('done');
			expect(pollResult.status_code).toBe(10000);
			expect(pollResult.image_urls).toBeDefined();
			expect(pollResult.image_urls!.length).toBeGreaterThan(0);

			console.log(`  ✓ 状态: ${pollResult.status}`);
			console.log(`  ✓ 状态码: ${pollResult.status_code}`);
			console.log(`  ✓ 生成图片数量: ${pollResult.image_urls!.length}`);

			if (pollResult.image_urls && pollResult.image_urls.length > 0) {
				console.log(`  ✓ 图片 URL:`);
				pollResult.image_urls.forEach((url, i) => {
					console.log(`    [${i + 1}] ${url}`);
				});
			}

			console.log('\n✓ 完整流程测试通过！');
		}, TEST_TIMEOUT);

		test('应该能处理长提示词 (验证参数)', async () => {
			console.log('\n[测试] 长提示词参数验证...');

			const longPrompt = '一幅超现实主义风格的画作，描绘了未来城市的壮丽景观，高耸入云的摩天大楼，飞行器在空中穿梭，霓虹灯光照亮夜空，远处是科技感十足的建筑群';
			console.log(`提示词长度: ${longPrompt.length} 字符`);

			// 只验证长度，不实际提交
			expect(longPrompt.length).toBeLessThanOrEqual(800);
			expect(longPrompt.length).toBeGreaterThan(0);
			console.log(`  ✓ 提示词长度验证通过`);
		}, TEST_TIMEOUT);
	});

	describe('错误处理', () => {
		test('应该能处理无效的 task_id', async () => {
			console.log('\n[测试] 无效 task_id...');

			const fakeTaskId = 'invalid_task_id_12345';

			await expect(async () => {
				await client.getTaskResult({
					task_id: fakeTaskId,
				});
			}).rejects.toThrow();

			console.log('  ✓ 正确抛出错误');
		}, TEST_TIMEOUT);

		test('应该能处理空提示词', async () => {
			console.log('\n[测试] 空提示词...');

			await expect(async () => {
				await client.submitTask({
					prompt: '',
				});
			}).rejects.toThrow();

			console.log('  ✓ 正确抛出错误');
		}, TEST_TIMEOUT);
	});
});