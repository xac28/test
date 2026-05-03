import nodemailer from "nodemailer"

// Create a transporter
// Using Gmail as an example, but you should use your own SMTP server for production
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // App Password for Gmail
  },
})

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string
  subject: string
  text?: string
  html?: string
}) {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("SMTP credentials not configured. Skipping email sent to:", to)
      return { success: false, error: "SMTP not configured" }
    }

    const info = await transporter.sendMail({
      from: `"Namaste" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    })

    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error("[EMAIL_ERROR]", error)
    return { success: false, error }
  }
}

export async function sendBookingConfirmationEmail(to: string, studentName: string, teacherName: string, startTime: Date, roomUrl: string) {
  const subject = `Namaste: Your Yoga Class with ${teacherName} is Confirmed!`
  const html = `
    <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #4A5D23;">Namaste</h2>
      <p>Hello ${studentName},</p>
      <p>Your session with <strong>${teacherName}</strong> has been successfully booked and confirmed.</p>
      <div style="background-color: #f4f6f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Time:</strong> ${new Date(startTime).toLocaleString()}</p>
        <p><strong>Live Class Link:</strong> <a href="${roomUrl}" style="color: #4A5D23;">Join your class here</a></p>
      </div>
      <p>Please make sure your camera and microphone are working before joining.</p>
      <p>Namaste 🙏</p>
    </div>
  `
  return sendEmail({ to, subject, html })
}
