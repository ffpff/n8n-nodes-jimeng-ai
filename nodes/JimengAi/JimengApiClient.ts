import * as crypto from 'crypto';
import * as https from 'https';

/**
 * 即梦 AI API 客户端
 * 实现 AWS Signature V4 签名认证和任务提交/查询功能
 */
export class JimengApiClient {
	private readonly accessKeyId: string;
	private readonly secretAccessKey: string;
	private readonly host = 'visual.volcengineapi.com';
	private readonly region = 'cn-north-1';
	private readonly service = 'cv';
	private readonly reqKey = 'jimeng_t2i_v31';

	constructor(accessKeyId: string, secretAccessKey: string) {
		this.accessKeyId = accessKeyId;
		this.secretAccessKey = secretAccessKey;
	}

	/**
	 * URL 编码方法 (符合 AWS Signature V4 规范)
	 * 保留字符: -_.~
	 * 空格编码为 %20
	 */
	urlEncode(str: string): string {
		return encodeURIComponent(str)
			.replace(/!/g, '%21')
			.replace(/'/g, '%27')
			.replace(/\(/g, '%28')
			.replace(/\)/g, '%29')
			.replace(/\*/g, '%2A');
	}

	/**
	 * SHA256 哈希
	 */
	hashSHA256(content: string): string {
		return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
	}

	/**
	 * HMAC-SHA256
	 */
	hmacSHA256(key: Buffer | string, content: string): Buffer {
		return crypto.createHmac('sha256', key).update(content, 'utf8').digest();
	}

	/**
	 * 生成签名密钥
	 */
	private getSigningKey(date: string): Buffer {
		const kDate = this.hmacSHA256(`${this.secretAccessKey}`, date);
		const kRegion = this.hmacSHA256(kDate, this.region);
		const kService = this.hmacSHA256(kRegion, this.service);
		const kSigning = this.hmacSHA256(kService, 'request');
		return kSigning;
	}

	/**
	 * 生成 AWS Signature V4 签名
	 */
	private generateSignature(
		method: string,
		path: string,
		queryParams: Record<string, string>,
		headers: Record<string, string>,
		payload: string,
	): string {
		// 1. 构建 Canonical Request
		const sortedQueryParams = Object.keys(queryParams)
			.sort()
			.map(key => `${this.urlEncode(key)}=${this.urlEncode(queryParams[key])}`)
			.join('&');

		// 固定的签名头顺序 (与官方示例保持一致)
		const signedHeaders = 'host;x-date;x-content-sha256;content-type';
		const payloadHash = this.hashSHA256(payload);

		// 按固定顺序构建 canonical headers (注意没有尾随 \n)
		const canonicalHeaders = [
			`host:${this.host}`,
			`x-date:${headers['X-Date']}`,
			`x-content-sha256:${payloadHash}`,
			`content-type:${headers['Content-Type']}`,
		].join('\n');

		const canonicalRequest = [
			method,
			path,
			sortedQueryParams,
			canonicalHeaders,
			'',  // 空行分隔 headers 和 signed headers
			signedHeaders,
			payloadHash,
		].join('\n');

		// 2. 构建 String to Sign
		const xDate = headers['X-Date'] || headers['x-date'];
		const date = xDate.split('T')[0];
		const credentialScope = `${date}/${this.region}/${this.service}/request`;

		const stringToSign = [
			'HMAC-SHA256',
			xDate,
			credentialScope,
			this.hashSHA256(canonicalRequest),
		].join('\n');

		// 3. 计算签名
		const signingKey = this.getSigningKey(date);
		const signature = this.hmacSHA256(signingKey, stringToSign).toString('hex');

		return signature;
	}

	/**
	 * 发送 HTTPS 请求
	 */
	private async sendRequest(
		method: string,
		path: string,
		queryParams: Record<string, string>,
		payload: string,
	): Promise<any> {
		return new Promise((resolve, reject) => {
			// 生成时间戳
			const now = new Date();
			const xDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');

			// 构建请求头
			const headers: Record<string, string> = {
				'Host': this.host,
				'X-Date': xDate,
				'X-Content-Sha256': this.hashSHA256(payload),
				'Content-Type': 'application/json',
			};

			// 生成签名
			const signature = this.generateSignature(method, path, queryParams, headers, payload);

			// 构建 Authorization 头
			const date = xDate.split('T')[0];
			const credentialScope = `${date}/${this.region}/${this.service}/request`;
			const signedHeaders = 'host;x-date;x-content-sha256;content-type';

			headers['Authorization'] = [
				`HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}`,
				`SignedHeaders=${signedHeaders}`,
				`Signature=${signature}`,
			].join(', ');

			// 构建完整 URL
			const queryString = Object.keys(queryParams)
				.sort()
				.map(key => `${this.urlEncode(key)}=${this.urlEncode(queryParams[key])}`)
				.join('&');

			const fullPath = queryString ? `${path}?${queryString}` : path;

			// 发送请求
			const options = {
				hostname: this.host,
				path: fullPath,
				method: method,
				headers: {
					...headers,
					'Content-Length': Buffer.byteLength(payload),
				},
			};

			const req = https.request(options, (res) => {
				let data = '';

				res.on('data', (chunk) => {
					data += chunk;
				});

				res.on('end', () => {
					try {
						const jsonData = JSON.parse(data);
						if (res.statusCode === 200) {
							resolve(jsonData);
						} else {
							// 增强错误信息
							const errorMsg = jsonData.message || jsonData.error || 'Unknown API error';
							const errorCode = jsonData.code || res.statusCode;
							reject(new Error(
								`API 请求失败 [${errorCode}]: ${errorMsg}${jsonData.request_id ? ` (Request ID: ${jsonData.request_id})` : ''}`
							));
						}
					} catch (error) {
						reject(new Error(`响应解析失败: ${data.substring(0, 200)}`));
					}
				});
			});

			req.on('error', (error) => {
				// 增强网络错误信息
				if (error.message.includes('ECONNREFUSED')) {
					reject(new Error(`无法连接到服务器: ${this.host} (连接被拒绝)`));
				} else if (error.message.includes('ETIMEDOUT')) {
					reject(new Error(`请求超时: ${this.host}`));
				} else if (error.message.includes('ENOTFOUND')) {
					reject(new Error(`DNS 解析失败: ${this.host}`));
				} else {
					reject(new Error(`网络请求错误: ${error.message}`));
				}
			});

			// 设置请求超时
			req.setTimeout(30000, () => {
				req.destroy();
				reject(new Error('请求超时 (30秒)'));
			});

			req.write(payload);
			req.end();
		});
	}

	/**
	 * 提交任务
	 */
	async submitTask(params: {
		prompt: string;
		use_pre_llm?: boolean;
		seed?: number;
		width?: number;
		height?: number;
	}): Promise<{ task_id: string; request_id: string }> {
		const queryParams = {
			Action: 'CVSync2AsyncSubmitTask',
			Version: '2022-08-31',
		};

		const payload = JSON.stringify({
			req_key: this.reqKey,
			prompt: params.prompt,
			use_pre_llm: params.use_pre_llm ?? true,
			seed: params.seed ?? -1,
			...(params.width && params.height && {
				width: params.width,
				height: params.height,
			}),
		});

		try {
			const response = await this.sendRequest('POST', '/', queryParams, payload);

			if (response.code !== 10000) {
				throw new Error(
					`任务提交失败 [${response.code}]: ${response.message || '未知错误'}` +
					(response.request_id ? ` (Request ID: ${response.request_id})` : '')
				);
			}

			if (!response.data || !response.data.task_id) {
				throw new Error('API 返回数据格式异常: 缺少 task_id');
			}

			return {
				task_id: response.data.task_id,
				request_id: response.request_id,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new Error(`提交任务时发生错误: ${errorMessage}`);
		}
	}

	/**
	 * 查询任务结果
	 */
	async getTaskResult(params: {
		task_id: string;
		return_url?: boolean;
		logo_info?: {
			add_logo?: boolean;
			position?: number;
			language?: number;
			opacity?: number;
			logo_text_content?: string;
		};
	}): Promise<{
		status: 'in_queue' | 'generating' | 'done' | 'not_found' | 'expired';
		task_id: string;
		request_id: string;
		status_code?: number;
		status_message?: string;
		image_urls?: string[];
		binary_data_base64?: string[];
		reason?: string;
	}> {
		const queryParams = {
			Action: 'CVSync2AsyncGetResult',
			Version: '2022-08-31',
		};

		const reqJson: any = {};
		if (params.return_url !== undefined) {
			reqJson.return_url = params.return_url;
		}
		if (params.logo_info) {
			reqJson.logo_info = params.logo_info;
		}

		const payload = JSON.stringify({
			req_key: this.reqKey,
			task_id: params.task_id,
			...(Object.keys(reqJson).length > 0 && { req_json: JSON.stringify(reqJson) }),
		});

		try {
			const response = await this.sendRequest('POST', '/', queryParams, payload);

			// 打印完整的 API 响应
			console.log('[DEBUG] ===== getTaskResult API 响应 =====');
			console.log('[DEBUG] 完整 response:', JSON.stringify(response, null, 2));
			console.log('[DEBUG] payload 参数:', payload);
			console.log('[DEBUG] =====================================');

			if (response.code !== 10000) {
				throw new Error(
					`查询任务结果失败 [${response.code}]: ${response.message || '未知错误'}` +
					(response.request_id ? ` (Request ID: ${response.request_id})` : '')
				);
			}

			if (!response.data || !response.data.status) {
				throw new Error('API 返回数据格式异常: 缺少 status');
			}

			const data = response.data;
			console.log('[DEBUG] 解析后的 data:', JSON.stringify(data, null, 2));
			const result: any = {
				status: data.status,
				task_id: params.task_id,
				request_id: response.request_id,
			};

			// 保存任务状态码和消息
			if (response.code !== undefined) {
				result.status_code = response.code;
			}
			if (response.message) {
				result.status_message = response.message;
			}

			if (data.status === 'done') {
				console.log('[DEBUG] 任务状态为 done, 检查图片数据字段...');
				console.log('[DEBUG] data.image_urls 存在?', !!data.image_urls);
				console.log('[DEBUG] data.binary_data_base64 存在?', !!data.binary_data_base64);

				if (data.image_urls) {
					result.image_urls = data.image_urls;
					console.log('[DEBUG] 已添加 image_urls, 数量:', data.image_urls.length);
				}
				if (data.binary_data_base64) {
					result.binary_data_base64 = data.binary_data_base64;
					console.log('[DEBUG] 已添加 binary_data_base64, 数量:', data.binary_data_base64.length);
				}

				// 检查生成结果 (只有当没有失败原因时才检查图片数据)
				if ((!result.binary_data_base64 || result.binary_data_base64.length === 0) && (!result.image_urls || result.image_urls.length === 0)) {
					console.log('[DEBUG] ✗ 任务完成但未返回图片数据!');
					console.log('[DEBUG] result.binary_data_base64:', result.binary_data_base64);
					console.log('[DEBUG] result.image_urls:', result.image_urls);
					throw new Error('任务完成但未返回图片数据');
				}

				console.log('[DEBUG] ✓ 图片数据验证通过');
			}

			return result;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new Error(`查询任务结果时发生错误: ${errorMessage}`);
		}
	}

	/**
	 * 轮询任务结果直到完成
	 */
	async pollTaskResult(
		params: {
			task_id: string;
			return_url?: boolean;
			logo_info?: any;
			max_polling_time?: number; // 最大轮询时间(秒)，默认 300
			polling_interval?: number; // 轮询间隔(秒)，默认 3
		},
		logger?: (message: string) => void,
	): Promise<{
		status: string;
		task_id: string;
		request_id: string;
		status_code?: number;
		status_message?: string;
		image_urls?: string[];
		binary_data_base64?: string[];
		reason?: string;
	}> {
		const maxPollingTime = (params.max_polling_time ?? 300) * 1000; // 转换为毫秒
		const pollingInterval = (params.polling_interval ?? 3) * 1000; // 转换为毫秒
		const startTime = Date.now();
		let pollCount = 0;

		logger?.(`开始轮询任务结果 (task_id: ${params.task_id})`);
		logger?.(`最大轮询时间: ${params.max_polling_time}秒, 轮询间隔: ${params.polling_interval}秒`);

		while (Date.now() - startTime < maxPollingTime) {
			pollCount++;
			const elapsed = Math.floor((Date.now() - startTime) / 1000);

			try {
				logger?.(`第 ${pollCount} 次查询 (已耗时 ${elapsed}秒)...`);

				const result = await this.getTaskResult({
					task_id: params.task_id,
					return_url: params.return_url,
					logo_info: params.logo_info,
				});

				logger?.(`任务状态: ${result.status}`);

				// 任务完成
				if (result.status === 'done') {
					if (result.status_code === 10000) {
						logger?.(`✓ 任务成功完成 (共查询 ${pollCount} 次, 耗时 ${elapsed}秒)`);
						return result;
					} else {
						// 任务完成但有错误
						const errorMsg = result.status_message || '未知错误';
						logger?.(`✗ 任务失败: [${result.status_code}] ${errorMsg}`);
						throw new Error(`图片生成失败 [${result.status_code}]: ${errorMsg}`);
					}
				}

				// 任务未找到或已过期
				if (result.status === 'not_found') {
					throw new Error(`任务未找到 (task_id: ${params.task_id})`);
				}
				if (result.status === 'expired') {
					throw new Error(`任务已过期 (task_id: ${params.task_id}, 任务结果保留时间为 12 小时)`);
				}

				// 继续等待
				if (result.status === 'in_queue') {
					logger?.(`任务排队中，等待 ${params.polling_interval}秒 后重试...`);
				} else if (result.status === 'generating') {
					logger?.(`图片生成中，等待 ${params.polling_interval}秒 后重试...`);
				}

				await this.sleep(pollingInterval);
			} catch (error) {
				// 如果是网络错误或临时错误，继续重试
				const errorMessage = error instanceof Error ? error.message : String(error);
				if (errorMessage.includes('网络') || errorMessage.includes('超时')) {
					logger?.(`⚠ 查询出错: ${errorMessage}, 将继续重试...`);
					await this.sleep(pollingInterval);
					continue;
				}
				// 其他错误直接抛出
				throw error;
			}
		}

		const totalElapsed = Math.floor((Date.now() - startTime) / 1000);
		throw new Error(
			`轮询超时: 任务在 ${totalElapsed}秒 内未完成 (共查询 ${pollCount} 次)。` +
			`建议: 1) 增加最大轮询时间, 2) 稍后手动查询任务结果`
		);
	}

	/**
	 * 睡眠函数
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}