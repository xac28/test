import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { termsGate } from "@/lib/terms"

export async function POST(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }
    const termsBlock = termsGate(user)
    if (termsBlock) return termsBlock

    const body = await req.json()
    const {
      firstName,
      lastName,
      dateOfBirth,
      phone,
      address,
      country,
      passportId,
      specialties,
      certificateUrl,
      certificateStartDate,
      experience,
    } = body

    // Validate required fields
    if (!firstName || !lastName || !phone || !country || !specialties?.length) {
      return new NextResponse("Missing required fields", { status: 400 })
    }

    // Check if an application already exists
    const existingApplication = await db.teacherApplication.findFirst({
      where: { userId: user.id }
    })

    if (existingApplication) {
      return new NextResponse("Application already submitted", { status: 400 })
    }

    // Create the application with all details
    const application = await db.teacherApplication.create({
      data: {
        userId: user.id,
        firstName,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        phone,
        address: address || null,
        country,
        passportId: passportId || null,
        specialties: JSON.stringify(specialties),
        certificateUrl: certificateUrl || null,
        certificateStartDate: certificateStartDate ? new Date(certificateStartDate) : null,
        experience: experience || null,
        status: "PENDING"
      }
    })

    // Also update the user's profile with these details
    await db.user.update({
      where: { id: user.id },
      data: {
        firstName,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        phone,
        address: address || undefined,
        country,
        passportId: passportId || undefined,
      }
    })

    return NextResponse.json(application)
  } catch (error) {
    console.error("[TEACHER_APPLICATION_POST]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
