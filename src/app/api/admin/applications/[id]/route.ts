import { auth } from "@/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { sendEmail } from "@/lib/email"

// POST /api/admin/applications/[id] — Approve or reject a teacher application
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { action, reason } = await req.json() // "approve" or "reject"

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const application = await db.teacherApplication.findUnique({
      where: { id },
      include: { user: true }
    })

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }

    if (application.status !== "PENDING") {
      return NextResponse.json({ error: "Application already processed" }, { status: 400 })
    }

    if (action === "approve") {
      // 1. Update application status
      await db.teacherApplication.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewerId: session.user.id,
        }
      })

      // 2. Update user role to TEACHER
      await db.user.update({
        where: { id: application.userId },
        data: { role: "TEACHER" }
      })

      // 3. Auto-create Teacher record with default settings
      const existingTeacher = await db.teacher.findUnique({
        where: { userId: application.userId }
      })

      if (!existingTeacher) {
        await db.teacher.create({
          data: {
            userId: application.userId,
            bio: application.experience || "Certified yoga teacher",
            hourlyRate: 30.0,
            commissionRate: 0.15,
            specialties: application.specialties || "[]",
          }
        })
      }

      if (application.user.email) {
        await sendEmail({
          to: application.user.email,
          subject: "Tebrikler! AYA Eğitmeni Oldunuz 🎉",
          html: `
            <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
              <div style="background-color: #4A5D23; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">AYA</h1>
              </div>
              <div style="background-color: #f4f6f0; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
                <h2 style="color: #4A5D23; margin-top: 0;">Harika Haberler, ${application.user.name}!</h2>
                <p>Eğitmenlik başvurunuz ekibimiz tarafından incelendi ve <strong>onaylandı.</strong></p>
                <p>AYA ailesine katıldığınız için çok mutluyuz. Artık Eğitmen Paneline giriş yapabilir, müsaitlik saatlerinizi belirleyebilir ve öğrencilerden rezervasyon almaya başlayabilirsiniz.</p>
                ${reason ? `<div style="background-color: white; padding: 15px; border-radius: 8px; border-left: 4px solid #4A5D23; margin: 20px 0;"><p style="margin: 0;"><strong>Yönetici Notu:</strong> ${reason}</p></div>` : ''}
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${process.env.NEXTAUTH_URL}/dashboard" style="background-color: #4A5D23; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Eğitmen Paneline Git</a>
                </div>
                <p style="margin-top: 30px; font-size: 14px; color: #666;">AYA ile esen kalın 🙏</p>
              </div>
            </div>
          `,
        })
      }

      return NextResponse.json({ 
        success: true, 
        message: `${application.user.name} has been approved as a teacher` 
      })
    } else {
      // Reject
      await db.teacherApplication.update({
        where: { id },
        data: {
          status: "REJECTED",
          reviewedAt: new Date(),
          reviewerId: session.user.id,
        }
      })

      if (application.user.email) {
        await sendEmail({
          to: application.user.email,
          subject: "AYA - Eğitmenlik Başvurunuz Hakkında",
          html: `
            <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
              <div style="background-color: #f87171; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">AYA</h1>
              </div>
              <div style="background-color: #fef2f2; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #fecaca; border-top: none;">
                <h2 style="color: #991b1b; margin-top: 0;">Merhaba ${application.user.name},</h2>
                <p>Eğitmenlik başvurunuz ekibimiz tarafından detaylı bir şekilde incelendi.</p>
                <p>Üzülerek belirtmeliyiz ki, başvurunuzu şu aşamada <strong>kabul edemiyoruz.</strong></p>
                ${reason ? `<div style="background-color: white; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;"><p style="margin: 0; color: #b91c1c;"><strong>Reddedilme Sebebi:</strong> ${reason}</p></div>` : '<p>Platform standartlarımız veya kapasite planlamamız gereği böyle bir karar alınmıştır.</p>'}
                <p>İlginiz ve vaktiniz için teşekkür ederiz. İlerleyen dönemlerde tecrübelerinizi güncelleyerek tekrar başvuru yapabilirsiniz.</p>
                <p style="margin-top: 30px; font-size: 14px; color: #666;">AYA Ekibi 🙏</p>
              </div>
            </div>
          `,
        })
      }

      return NextResponse.json({ 
        success: true, 
        message: `Application from ${application.user.name} has been rejected` 
      })
    }
  } catch (error) {
    console.error("[ADMIN_APPLICATION_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
