import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  // SMTP 未配置（或为占位符）→ 开发模式：激活链接打印到控制台
  if (!config.smtp.enabled) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return transporter;
}

export interface MailResult {
  delivered: boolean;
  consoleUrl?: string;
  error?: string;
}

// 发送激活邮件；SMTP 未配置或发送失败时把激活链接打印到控制台（开发模式），不阻断流程
export async function sendActivationMail(to: string, name: string, activateUrl: string): Promise<MailResult> {
  const t = getTransporter();
  if (!t) {
    logToConsole(to, name, activateUrl);
    return { delivered: false, consoleUrl: activateUrl };
  }
  try {
    await t.sendMail({
      from: `"内部沟通工具" <${config.smtp.from}>`,
      to,
      subject: '【内部沟通工具】激活你的账号',
      html: `<p>你好，${name}：</p>
        <p>你的账号已开通，请点击以下链接激活并设置密码（7 天内有效）：</p>
        <p><a href="${activateUrl}">${activateUrl}</a></p>
        <p>如果这不是你本人操作，请忽略本邮件。</p>`,
    });
    return { delivered: true };
  } catch (e) {
    // 邮件服务异常不阻断注册流程：降级为控制台输出
    const message = e instanceof Error ? e.message : String(e);
    console.error('[mailer] 发送失败，降级为控制台输出:', message);
    logToConsole(to, name, activateUrl);
    return { delivered: false, consoleUrl: activateUrl, error: message };
  }
}

function logToConsole(to: string, name: string, activateUrl: string) {
  console.log('\n========== [开发模式] 激活链接 ==========');
  console.log(`收件人: ${to}（${name}）`);
  console.log(activateUrl);
  console.log('=========================================\n');
}
