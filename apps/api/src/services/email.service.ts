const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export async function sendPasswordResetEmail(to: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');

  const from = process.env.RESEND_FROM_EMAIL || 'Dijla <onboarding@resend.dev>';
  const subject = 'رمز إعادة تعيين كلمة مرور دجلة';

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7">
          <h2>إعادة تعيين كلمة المرور — دجلة</h2>
          <p>رمز إعادة التعيين الخاص بك:</p>
          <p style="font-size:32px;font-weight:700;letter-spacing:8px">${code}</p>
          <p>الرمز صالح لمدة 10 دقائق ويُستخدم مرة واحدة فقط.</p>
          <p>إذا لم تطلب إعادة تعيين كلمة المرور، تجاهل هذه الرسالة.</p>
        </div>`,
      tags: [{ name: 'category', value: 'password_reset' }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`EMAIL_SEND_FAILED:${response.status}:${body.slice(0, 300)}`);
  }
}
