import { ICredentialType, INodeProperties } from "n8n-workflow";

export class JimengApi implements ICredentialType {
  name = "jimengApi";
  displayName = "Jimeng AI API";
  documentationUrl = "https://www.volcengine.com/docs/6791/1104759";
  properties: INodeProperties[] = [
    {
      displayName: "Access Key ID",
      name: "accessKeyId",
      type: "string",
      default: "",
      required: true,
      description: "火山引擎账号的 Access Key ID",
    },
    {
      displayName: "Secret Access Key",
      name: "secretAccessKey",
      type: "string",
      typeOptions: {
        password: true,
      },
      default: "",
      required: true,
      description: "火山引擎账号的 Secret Access Key",
    },
  ];

  // 凭证测试方法
  // 注意: 由于即梦 API 需要复杂的 AWS Signature V4 签名,
  // 这里不实现 authenticate 和 test 方法,
  // 而是在节点执行时验证凭证的有效性
  // 如果凭证无效，API 请求会返回认证错误
}
