import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { JimengApiClient } from './JimengApiClient';

export class JimengAi implements INodeType {
	description: INodeTypeDescription = {
		displayName: '即梦 AI',
		name: 'jimengAi',
		icon: 'file:jimeng-icon.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: '即梦 AI 文生图 3.1 - 火山引擎视觉智能服务',
		defaults: {
			name: '即梦 AI',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'jimengApi',
				required: true,
			},
		],
		properties: [
			// 操作选项
			{
				displayName: '操作',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: '生成图片',
						value: 'generateImage',
						description: '根据文本提示词生成图片',
						action: '生成图片',
					},
				],
				default: 'generateImage',
			},
			// 基础参数
			{
				displayName: '提示词',
				name: 'prompt',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['generateImage'],
					},
				},
				description: '文本描述，建议不超过120字符，最大800字符',
			},
			{
				displayName: '启用文本扩写',
				name: 'usePreLlm',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: {
						operation: ['generateImage'],
					},
				},
				description: '是否使用大模型对输入的 prompt 进行扩写，适合短提示词',
			},
			{
				displayName: '随机种子',
				name: 'seed',
				type: 'number',
				default: -1,
				displayOptions: {
					show: {
						operation: ['generateImage'],
					},
				},
				description: '控制图片生成的随机性，-1 表示随机生成。使用相同种子和提示词可以生成相似图片',
			},
			// 图像尺寸
			{
				displayName: '尺寸配置方式',
				name: 'sizeMode',
				type: 'options',
				options: [
					{
						name: '预设尺寸',
						value: 'preset',
					},
					{
						name: '自定义尺寸',
						value: 'custom',
					},
				],
				default: 'preset',
				displayOptions: {
					show: {
						operation: ['generateImage'],
					},
				},
			},
			{
				displayName: '预设尺寸',
				name: 'presetSize',
				type: 'options',
				options: [
					{
						name: '1328×1328 (正方形)',
						value: '1328x1328',
					},
					{
						name: '1664×936 (16:9 横版)',
						value: '1664x936',
					},
					{
						name: '936×1664 (9:16 竖版)',
						value: '936x1664',
					},
					{
						name: '2048×2048 (大正方形)',
						value: '2048x2048',
					},
					{
						name: '1536×640 (超宽屏)',
						value: '1536x640',
					},
					{
						name: '640×1536 (超高屏)',
						value: '640x1536',
					},
				],
				default: '1328x1328',
				displayOptions: {
					show: {
						operation: ['generateImage'],
						sizeMode: ['preset'],
					},
				},
			},
			{
				displayName: '宽度',
				name: 'width',
				type: 'number',
				default: 1328,
				typeOptions: {
					minValue: 512,
					maxValue: 2048,
				},
				displayOptions: {
					show: {
						operation: ['generateImage'],
						sizeMode: ['custom'],
					},
				},
				description: '图像宽度，范围 512-2048，需与高度同时设置',
			},
			{
				displayName: '高度',
				name: 'height',
				type: 'number',
				default: 1328,
				typeOptions: {
					minValue: 512,
					maxValue: 2048,
				},
				displayOptions: {
					show: {
						operation: ['generateImage'],
						sizeMode: ['custom'],
					},
				},
				description: '图像高度，范围 512-2048，宽高比需在 1:3 到 3:1 之间',
			},
			// 查询结果配置
			{
				displayName: '返回图片链接',
				name: 'returnUrl',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: {
						operation: ['generateImage'],
					},
				},
				description: '是否返回图片的临时访问链接（24小时有效）',
			},
			{
				displayName: '最大轮询时间（秒）',
				name: 'maxPollingTime',
				type: 'number',
				default: 300,
				typeOptions: {
					minValue: 10,
					maxValue: 600,
				},
				displayOptions: {
					show: {
						operation: ['generateImage'],
					},
				},
				description: '等待任务完成的最大时间，超时将抛出错误',
			},
			{
				displayName: '轮询间隔（秒）',
				name: 'pollingInterval',
				type: 'number',
				default: 3,
				typeOptions: {
					minValue: 1,
					maxValue: 10,
				},
				displayOptions: {
					show: {
						operation: ['generateImage'],
					},
				},
				description: '查询任务状态的时间间隔',
			},
			// 水印配置
			{
				displayName: '水印配置',
				name: 'logoConfig',
				type: 'fixedCollection',
				placeholder: '添加水印',
				default: {},
				displayOptions: {
					show: {
						operation: ['generateImage'],
					},
				},
				options: [
					{
						name: 'logoInfo',
						displayName: '水印信息',
						values: [
							{
								displayName: '添加水印',
								name: 'addLogo',
								type: 'boolean',
								default: false,
								description: '是否在生成的图片上添加水印',
							},
							{
								displayName: '水印位置',
								name: 'position',
								type: 'options',
								options: [
									{
										name: '左下',
										value: 0,
									},
									{
										name: '右下',
										value: 1,
									},
									{
										name: '左上',
										value: 2,
									},
									{
										name: '右上',
										value: 3,
									},
								],
								default: 1,
								displayOptions: {
									show: {
										addLogo: [true],
									},
								},
							},
							{
								displayName: '水印语言',
								name: 'language',
								type: 'options',
								options: [
									{
										name: '中文',
										value: 0,
									},
									{
										name: '英文',
										value: 1,
									},
								],
								default: 0,
								displayOptions: {
									show: {
										addLogo: [true],
									},
								},
							},
							{
								displayName: '不透明度',
								name: 'opacity',
								type: 'number',
								typeOptions: {
									minValue: 0,
									maxValue: 1,
									numberPrecision: 2,
								},
								default: 0.3,
								displayOptions: {
									show: {
										addLogo: [true],
									},
								},
								description: '水印透明度，0 为完全透明，1 为完全不透明',
							},
							{
								displayName: '自定义水印内容',
								name: 'logoTextContent',
								type: 'string',
								default: '',
								displayOptions: {
									show: {
										addLogo: [true],
									},
								},
								description: '自定义水印文本内容，为空则使用默认水印',
							},
						],
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		// 获取凭证
		const credentials = await this.getCredentials('jimengApi');
		const accessKeyId = credentials.accessKeyId as string;
		const secretAccessKey = credentials.secretAccessKey as string;

		// 创建 API 客户端
		const apiClient = new JimengApiClient(accessKeyId, secretAccessKey);

		if (operation === 'generateImage') {
			for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
				try {
					// 读取参数
					const prompt = this.getNodeParameter('prompt', itemIndex) as string;
					const usePreLlm = this.getNodeParameter('usePreLlm', itemIndex) as boolean;
					const seed = this.getNodeParameter('seed', itemIndex) as number;
					const sizeMode = this.getNodeParameter('sizeMode', itemIndex) as string;
					const returnUrl = this.getNodeParameter('returnUrl', itemIndex) as boolean;
					const maxPollingTime = this.getNodeParameter('maxPollingTime', itemIndex) as number;
					const pollingInterval = this.getNodeParameter('pollingInterval', itemIndex) as number;

					// 参数校验
					if (!prompt || prompt.trim().length === 0) {
						throw new NodeOperationError(this.getNode(), '提示词不能为空', {
							itemIndex,
						});
					}

					if (prompt.length > 800) {
						throw new NodeOperationError(
							this.getNode(),
							`提示词长度超过限制（${prompt.length}/800字符）`,
							{ itemIndex },
						);
					}

					// 校验凭证
					if (!accessKeyId || !secretAccessKey) {
						throw new NodeOperationError(
							this.getNode(),
							'API 凭证未配置或无效，请检查 Access Key ID 和 Secret Access Key',
							{ itemIndex },
						);
					}

					// 处理图像尺寸
					let width: number;
					let height: number;

					if (sizeMode === 'preset') {
						const presetSize = this.getNodeParameter('presetSize', itemIndex) as string;
						const [w, h] = presetSize.split('x').map(Number);
						width = w;
						height = h;
					} else {
						width = this.getNodeParameter('width', itemIndex) as number;
						height = this.getNodeParameter('height', itemIndex) as number;

						// 校验宽高比
						const ratio = width / height;
						if (ratio < 1 / 3 || ratio > 3) {
							throw new NodeOperationError(
								this.getNode(),
								`宽高比超出范围（${ratio.toFixed(2)}），需在 1:3 到 3:1 之间`,
								{ itemIndex },
							);
						}
					}

					// 处理水印配置
					const logoConfig = this.getNodeParameter('logoConfig', itemIndex, {}) as any;
					let logoInfo;
					if (logoConfig.logoInfo && logoConfig.logoInfo.length > 0) {
						const logo = logoConfig.logoInfo[0];
						if (logo.addLogo) {
							logoInfo = {
								add_logo: true,
								position: logo.position,
								language: logo.language,
								opacity: logo.opacity,
								logo_text_content: logo.logoTextContent,
							};
						}
					}

					// 构建任务参数
					const taskParams: any = {
						prompt,
						use_pre_llm: usePreLlm,
						seed,
						width,
						height,
					};

					// 日志函数
					const logger = (message: string) => {
						console.log(`[即梦 AI] ${message}`);
					};

					logger(`开始处理第 ${itemIndex + 1}/${items.length} 个任务`);
					logger(`提示词: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`);
					logger(`图像尺寸: ${width}×${height}, 种子: ${seed}, 文本扩写: ${usePreLlm}`);

					// 提交任务
					logger('正在提交任务...');
					const submitResult = await apiClient.submitTask(taskParams);
					const taskId = submitResult.task_id;
					logger(`✓ 任务提交成功 (task_id: ${taskId})`);

					// 构建查询参数
					const pollParams: any = {
						task_id: taskId,
						max_polling_time: maxPollingTime,
						polling_interval: pollingInterval,
					};
					if (returnUrl) {
						pollParams.return_url = true;
					}
					if (logoInfo) {
						pollParams.logo_info = logoInfo;
					}

					// 轮询查询结果
					const result = await apiClient.pollTaskResult(pollParams, logger);

					// 构建返回数据
					const outputData: any = {
						task_id: taskId,
						status: result.status,
						request_id: result.request_id,
					};

					// 添加图片数据
					if (result.status === 'done' && result.binary_data_base64) {
						outputData.binary_data_base64 = result.binary_data_base64;
						outputData.image_count = result.binary_data_base64.length;

						logger(`✓ 成功生成 ${result.binary_data_base64.length} 张图片`);

						if (returnUrl && result.image_urls) {
							outputData.image_urls = result.image_urls;
							logger(`图片链接已返回 (24小时有效)`);
						}
					}

					// 添加状态码和消息
					if (result.status_code !== undefined) {
						outputData.status_code = result.status_code;
					}
					if (result.status_message) {
						outputData.status_message = result.status_message;
					}
					if (result.reason) {
						outputData.reason = result.reason;
					}

					logger(`第 ${itemIndex + 1} 个任务处理完成\n`);

					returnData.push({
						json: outputData,
						pairedItem: { item: itemIndex },
					});
				} catch (error) {
					// 增强错误信息
					const errorMessage = error instanceof Error ? error.message : String(error);
					const errorType = error instanceof Error ? error.constructor.name : 'Error';
					console.error(`[即梦 AI] ✗ 第 ${itemIndex + 1} 个任务失败: ${errorMessage}`);

					if (this.continueOnFail()) {
						returnData.push({
							json: {
								error: errorMessage,
								error_type: errorType,
								item_index: itemIndex,
							},
							pairedItem: { item: itemIndex },
						});
						continue;
					}

					// 包装错误以提供更多上下文
					throw new NodeOperationError(
						this.getNode(),
						`即梦 AI 生成失败: ${errorMessage}`,
						{
							itemIndex,
							description: '请检查: 1) API 凭证是否正确, 2) 网络连接是否正常, 3) 参数配置是否合理',
						},
					);
				}
			}
		}

		return [returnData];
	}
}