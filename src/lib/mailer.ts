import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendLoginCodeEmail(email: string, code: string, minutes: number) {
  await transporter.sendMail({
    from: `"B.Marvld" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `${code} is your B.Marvld admin login code`,
    text: `Your B.Marvld admin login code is ${code}. It expires in ${minutes} minutes.`,
    html: `
      <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto; background: #050505; color: #f6e3c8; padding: 32px;">
        <p style="font-size: 22px; font-weight: 700; letter-spacing: 2px; margin: 0 0 24px;">B<span style="color: #ffc800;">.</span>MARVLD</p>
        <p>Your admin login code is:</p>
        <p style="font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #ffc800;">${code}</p>
        <p style="color: #c9b8a0;">It expires in ${minutes} minutes. If you didn't try to sign in, you can ignore this email.</p>
      </div>
    `,
  });
}
