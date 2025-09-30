import { JimengApiClient } from '../nodes/JimengAi/JimengApiClient';
import * as https from 'https';

// Mock https 模块
jest.mock('https');

describe('JimengApiClient', () => {
	let client: JimengApiClient;
	const mockAccessKeyId = 'test-access-key';
	const mockSecretAccessKey = 'test-secret-key';

	beforeEach(() => {
		client = new JimengApiClient(mockAccessKeyId, mockSecretAccessKey);
		jest.clearAllMocks();
	});

	describe('urlEncode', () => {
		it('应该正确编码空格为 %20', () => {
			const result = client.urlEncode('hello world');
			expect(result).toBe('hello%20world');
		});

		it('应该正确编码特殊字符', () => {
			expect(client.urlEncode("foo!bar")).toBe("foo%21bar");
			expect(client.urlEncode("foo'bar")).toBe("foo%27bar");
			expect(client.urlEncode("foo(bar)")).toBe("foo%28bar%29");
			expect(client.urlEncode("foo*bar")).toBe("foo%2Abar");
		});

		it('应该保留 AWS 允许的字符 -_.~', () => {
			const result = client.urlEncode('foo-bar_baz.test~end');
			expect(result).toBe('foo-bar_baz.test~end');
		});

		it('应该正确编码中文字符', () => {
			const result = client.urlEncode('你好世界');
			// 中文会被编码为多个 %XX 序列
			expect(result).toMatch(/%[0-9A-F]{2}/);
		});

		it('应该处理空字符串', () => {
			const result = client.urlEncode('');
			expect(result).toBe('');
		});
	});

	describe('hashSHA256', () => {
		it('应该返回正确的 SHA256 哈希值', () => {
			const input = 'test';
			const expected = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
			const result = client.hashSHA256(input);
			expect(result).toBe(expected);
		});

		it('应该正确处理空字符串', () => {
			const input = '';
			const expected = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
			const result = client.hashSHA256(input);
			expect(result).toBe(expected);
		});

		it('应该正确处理中文字符', () => {
			const input = '你好';
			// 验证返回的是 64 位十六进制字符串
			const result = client.hashSHA256(input);
			expect(result).toMatch(/^[a-f0-9]{64}$/);
		});

		it('应该对相同输入返回相同哈希值', () => {
			const input = 'consistent-test';
			const result1 = client.hashSHA256(input);
			const result2 = client.hashSHA256(input);
			expect(result1).toBe(result2);
		});
	});

	describe('hmacSHA256', () => {
		it('应该返回正确的 HMAC-SHA256 值', () => {
			const key = 'secret-key';
			const content = 'test-content';
			const result = client.hmacSHA256(key, content);
			expect(result).toBeInstanceOf(Buffer);
			expect(result.length).toBe(32); // SHA256 输出 32 字节
		});

		it('应该对相同输入返回相同值', () => {
			const key = 'key';
			const content = 'content';
			const result1 = client.hmacSHA256(key, content);
			const result2 = client.hmacSHA256(key, content);
			expect(result1.equals(result2)).toBe(true);
		});

		it('应该支持 Buffer 类型的 key', () => {
			const key = Buffer.from('key');
			const content = 'content';
			const result = client.hmacSHA256(key, content);
			expect(result).toBeInstanceOf(Buffer);
		});

		it('不同 key 应该产生不同结果', () => {
			const content = 'same-content';
			const result1 = client.hmacSHA256('key1', content);
			const result2 = client.hmacSHA256('key2', content);
			expect(result1.equals(result2)).toBe(false);
		});
	});

	describe('submitTask', () => {
		it('应该成功提交任务并返回 task_id', async () => {
			// Mock HTTPS 响应
			const mockResponse = {
				code: 10000,
				message: 'Success',
				data: {
					task_id: 'test-task-id-12345',
				},
				request_id: 'req-12345',
			};

			mockHttpsRequest(mockResponse);

			const result = await client.submitTask({
				prompt: '测试提示词',
			});

			expect(result).toEqual({
				task_id: 'test-task-id-12345',
				request_id: 'req-12345',
			});
		});

		it('应该正确传递所有参数', async () => {
			const mockResponse = {
				code: 10000,
				data: { task_id: 'task-123' },
				request_id: 'req-123',
			};

			let capturedPayload = '';
			mockHttpsRequest(mockResponse, (payload) => {
				capturedPayload = payload;
			});

			await client.submitTask({
				prompt: '美丽的风景',
				use_pre_llm: false,
				seed: 42,
				width: 1024,
				height: 768,
			});

			const parsedPayload = JSON.parse(capturedPayload);
			expect(parsedPayload).toEqual({
				req_key: 'jimeng_t2i_v31',
				prompt: '美丽的风景',
				use_pre_llm: false,
				seed: 42,
				width: 1024,
				height: 768,
			});
		});

		it('应该使用默认参数值', async () => {
			const mockResponse = {
				code: 10000,
				data: { task_id: 'task-123' },
				request_id: 'req-123',
			};

			let capturedPayload = '';
			mockHttpsRequest(mockResponse, (payload) => {
				capturedPayload = payload;
			});

			await client.submitTask({
				prompt: '测试',
			});

			const parsedPayload = JSON.parse(capturedPayload);
			expect(parsedPayload.use_pre_llm).toBe(true);
			expect(parsedPayload.seed).toBe(-1);
			expect(parsedPayload).not.toHaveProperty('width');
			expect(parsedPayload).not.toHaveProperty('height');
		});

		it('应该在 API 返回错误时抛出异常', async () => {
			const mockResponse = {
				code: 50001,
				message: 'Invalid parameters',
			};

			mockHttpsRequest(mockResponse);

			await expect(client.submitTask({ prompt: '测试' })).rejects.toThrow(
				'任务提交失败'
			);
		});

		it('应该处理网络错误', async () => {
			const mockError = new Error('Network error');
			mockHttpsRequestError(mockError);

			await expect(client.submitTask({ prompt: '测试' })).rejects.toThrow('Network error');
		});
	});

	describe('getTaskResult', () => {
		it('应该成功获取任务结果（处理中）', async () => {
			const mockResponse = {
				code: 10000,
				data: {
					status: 'generating',
				},
				request_id: 'req-123',
			};

			mockHttpsRequest(mockResponse);

			const result = await client.getTaskResult({
				task_id: 'task-123',
			});

			expect(result).toEqual({
				status: 'generating',
				task_id: 'task-123',
				status_code: 10000,
				request_id: 'req-123',
			});
		});

		it('应该成功获取已完成任务的图片数据', async () => {
			const mockResponse = {
				code: 10000,
				data: {
					status: 'done',
					image_urls: [
						'https://example.com/image1.jpg',
						'https://example.com/image2.jpg'
					],
					binary_data_base64: [
						'base64-data-1',
						'base64-data-2'
					],
				},
				request_id: 'req-123',
			};

			mockHttpsRequest(mockResponse);

			const result = await client.getTaskResult({
				task_id: 'task-123',
				return_url: true,
			});

			expect(result.status).toBe('done');
			expect(result.image_urls).toEqual([
				'https://example.com/image1.jpg',
				'https://example.com/image2.jpg',
			]);
			expect(result.binary_data_base64).toEqual(['base64-data-1', 'base64-data-2']);
		});

		it('应该处理失败的任务', async () => {
			const mockResponse = {
				code: 10000,
				data: {
					status: 'done',
					image_urls: [
						'https://example.com/image1.jpg',
						'https://example.com/image2.jpg'
					],
					binary_data_base64: [
						'base64-data-1',
						'base64-data-2'
					]
				},
				message: "prompt contains sensitive content",
				request_id: 'req-123',
			};

			mockHttpsRequest(mockResponse);

			const result = await client.getTaskResult({
				task_id: 'task-123',
			});

			expect(result.status).toBe('done');
			expect(result.status_message).toBe('prompt contains sensitive content');
		});

		it('应该正确传递 logo_info 参数', async () => {
			const mockResponse = {
				code: 10000,
				data: { status: 'generating' },
				request_id: 'req-123',
			};

			let capturedPayload = '';
			mockHttpsRequest(mockResponse, (payload) => {
				capturedPayload = payload;
			});

			await client.getTaskResult({
				task_id: 'task-123',
				return_url: true,
				logo_info: {
					add_logo: true,
					position: 2,
					language: 0,
					opacity: 0.5,
				},
			});

			const parsedPayload = JSON.parse(capturedPayload);
			expect(parsedPayload).toHaveProperty('req_json');
			const reqJson = JSON.parse(parsedPayload.req_json);
			expect(reqJson.return_url).toBe(true);
			expect(reqJson.logo_info).toEqual({
				add_logo: true,
				position: 2,
				language: 0,
				opacity: 0.5,
			});
		});

		it('应该处理 not_found 状态', async () => {
			const mockResponse = {
				code: 10000,
				data: {
					status: 'not_found',
				},
				request_id: 'req-123',
			};

			mockHttpsRequest(mockResponse);

			const result = await client.getTaskResult({
				task_id: 'invalid-task',
			});

			expect(result.status).toBe('not_found');
		});
	});

	describe('pollTaskResult', () => {
		it('应该在任务完成时立即返回结果', async () => {
			const mockResponse = {
				code: 10000,
				data: {
					status: 'done',
					status_code: 10000,
					image_urls: [
						'https://example.com/img.jpg'
					],
					binary_data_base64: [
						'base64-data-1'
					]
				},
				request_id: 'req-123',
			};

			mockHttpsRequest(mockResponse);

			const result = await client.pollTaskResult({
				task_id: 'task-123',
			});

			expect(result.status).toBe('done');
			expect(result.image_urls).toEqual(['https://example.com/img.jpg']);
		});

		it('应该轮询直到任务完成', async () => {
			let callCount = 0;
			const responses = [
				{ code: 10000, data: { status: 'in_queue' }, request_id: 'req-1' },
				{ code: 10000, data: { status: 'generating' }, request_id: 'req-2' },
				{
					code: 10000,
					data: { status: 'done', status_code: 10000,
						image_urls: [
							'https://example.com/img.jpg'
						],
						binary_data_base64: [
							'base64-data-1'
						] },
					request_id: 'req-3',
				},
			];

			mockHttpsRequest(() => {
				return responses[callCount++];
			});

			const result = await client.pollTaskResult({
				task_id: 'task-123',
				polling_interval: 0.1, // 0.1秒间隔以加快测试
			});

			expect(result.status).toBe('done');
			expect(callCount).toBe(3);
		});

		it('应该在超时后抛出错误', async () => {
			const mockResponse = {
				code: 10000,
				data: { status: 'generating' },
				request_id: 'req-123',
			};

			mockHttpsRequest(mockResponse);

			await expect(
				client.pollTaskResult({
					task_id: 'task-123',
					max_polling_time: 0.5, // 0.5秒超时
					polling_interval: 0.2, // 0.2秒间隔
				})
			).rejects.toThrow('轮询超时');
		});

		it('应该在任务 not_found 时抛出错误', async () => {
			const mockResponse = {
				code: 10000,
				data: { status: 'not_found' },
				request_id: 'req-123',
			};

			mockHttpsRequest(mockResponse);

			await expect(
				client.pollTaskResult({
					task_id: 'invalid-task',
				})
			).rejects.toThrow('任务未找到');
		});

		it('应该在任务 expired 时抛出错误', async () => {
			const mockResponse = {
				code: 10000,
				data: { status: 'expired' },
				request_id: 'req-123',
			};

			mockHttpsRequest(mockResponse);

			await expect(
				client.pollTaskResult({
					task_id: 'expired-task',
				})
			).rejects.toThrow('任务已过期');
		});

		it('应该处理任务完成但生成失败的情况', async () => {
			const mockResponse = {
				code: 50500,
				data: {
					status: 'done'
				},
				message: '内容审核不通过',
				request_id: 'req-123',
			};

			mockHttpsRequest(mockResponse);

			await expect(
				client.pollTaskResult({
					task_id: 'task-123',
				})
			).rejects.toThrow('查询任务结果时发生错误: 查询任务结果失败 [50500]: 内容审核不通过 (Request ID: req-123)');
		});

		it('应该正确传递 logger 参数', async () => {
			const mockResponse = {
				code: 10000,
				data: {
					status: 'done',
					status_code: 10000,
						image_urls: [
							'https://example.com/img.jpg'
						],
						binary_data_base64: [
							'base64-data-1'
						] 
				},
				request_id: 'req-123',
			};

			mockHttpsRequest(mockResponse);

			const logs: string[] = [];
			const logger = (msg: string) => logs.push(msg);

			await client.pollTaskResult(
				{
					task_id: 'task-123',
				},
				logger
			);

			expect(logs.length).toBeGreaterThan(0);
			expect(logs.some(log => log.includes('任务状态'))).toBe(true);
		});
	});

	describe('边界情况与错误处理', () => {
		it('应该处理极长的 prompt', async () => {
			const mockResponse = {
				code: 10000,
				data: { task_id: 'task-123' },
				request_id: 'req-123',
			};

			mockHttpsRequest(mockResponse);

			const longPrompt = 'a'.repeat(800);
			const result = await client.submitTask({
				prompt: longPrompt,
			});

			expect(result.task_id).toBe('task-123');
		});

		it('应该处理没有 request_id 的响应', async () => {
			const mockResponse = {
				code: 10000,
				data: { task_id: 'task-123' },
			};

			mockHttpsRequest(mockResponse);

			const result = await client.submitTask({
				prompt: '测试',
			});

			expect(result.task_id).toBe('task-123');
		});

		it('应该处理 HTTP 非 200 状态码', async () => {
			const mockRequest = {
				write: jest.fn(),
				end: jest.fn(),
				on: jest.fn(),
				setTimeout: jest.fn(),
			};

			(https.request as jest.Mock).mockImplementation((_options: any, callback: any) => {
				setImmediate(() => {
					const mockRes = {
						statusCode: 500,
						on: jest.fn((event: string, handler: any) => {
							if (event === 'data') {
								handler('Internal Server Error');
							} else if (event === 'end') {
								handler();
							}
						}),
					};
					callback(mockRes);
				});

				return mockRequest;
			});

			await expect(client.submitTask({ prompt: '测试' })).rejects.toThrow('响应解析失败');
		});
	});
});

/**
 * 辅助函数: Mock HTTPS 请求成功响应
 */
function mockHttpsRequest(response: any | (() => any), onWrite?: (payload: string) => void) {
	const mockRequest = {
		write: jest.fn((data: string) => {
			if (onWrite) onWrite(data);
		}),
		end: jest.fn(),
		on: jest.fn(),
		setTimeout: jest.fn(),
	};

	(https.request as jest.Mock).mockImplementation((_options: any, callback: any) => {
		// 模拟异步响应
		setImmediate(() => {
			const mockRes = {
				statusCode: 200,
				on: jest.fn((event: string, handler: any) => {
					if (event === 'data') {
						const responseData = typeof response === 'function' ? response() : response;
						handler(JSON.stringify(responseData));
					} else if (event === 'end') {
						handler();
					}
				}),
			};
			callback(mockRes);
		});

		return mockRequest;
	});
}

/**
 * 辅助函数: Mock HTTPS 请求错误
 */
function mockHttpsRequestError(error: Error) {
	const mockRequest = {
		write: jest.fn(),
		end: jest.fn(),
		on: jest.fn((event: string, handler: any) => {
			if (event === 'error') {
				setImmediate(() => handler(error));
			}
		}),
		setTimeout: jest.fn(),
	};

	(https.request as jest.Mock).mockImplementation(() => mockRequest);
}