import { db } from "@/lib/db"
import { DataPacket_Kind } from "livekit-server-sdk"
import { livekitRoomService } from "@/lib/livekit"
import { sendEmail } from "@/lib/email"
import { endLiveRoom } from "@/lib/live-rooms"
import { trialRoomName, trialTransition, TRIAL_ACTION_LABEL_TR, TrialAction } from "@/lib/trial"

export type DecisionResult =
  | { ok: true; isTrialMode: boolean }
  | { ok: false; status: number; error: string }

/** Apply an admin's decision about a teacher: approve, reject the trial, or revoke an earlier approval. */
export async function decideTrial(adminId: string, teacherId: string, action: string, note?: string | null): Promise<DecisionResult> {
  const teacher = await db.teacher.findUnique({ where: { id: teacherId }, include: { user: true } })
  if (!teacher) return { ok: false, status: 404, error: "Öğretmen bulunamadı" }

  const next = trialTransition(teacher.isTrialMode, action)
  if (!next) {
    return {
      ok: false,
      status: 409,
      error: teacher.isTrialMode ? "Bu öğretmen zaten deneme aşamasında." : "Bu öğretmen zaten onaylı.",
    }
  }
  const cleanNote = note ? String(note).trim().slice(0, 500) : ""
  if ((action === "reject" || action === "revoke") && !cleanNote) {
    return { ok: false, status: 400, error: "Gerekçe yazmalısınız (öğretmene iletilecek)." }
  }

  // conditional update so two admins cannot apply the same decision twice
  const res = await db.teacher.updateMany({
    where: { id: teacherId, isTrialMode: teacher.isTrialMode },
    data: { isTrialMode: next.isTrialMode, trialNote: cleanNote || null, trialReviewedAt: new Date() },
  })
  if (res.count === 0) return { ok: false, status: 409, error: "Durum başka bir yönetici tarafından değiştirildi." }

  await db.auditLog.create({
    data: {
      actorId: adminId,
      action: `TRIAL_${action.toUpperCase()}`,
      targetId: teacherId,
      reason: `${teacher.user.name ?? teacherId} ${TRIAL_ACTION_LABEL_TR[action as TrialAction]}${cleanNote ? `: ${cleanNote}` : ""}`,
    },
  })

  // The teacher is no longer allowed in public → close their broadcasts; close the trial room after a decision
  if (action === "revoke") {
    const live = await db.liveRoom.findMany({ where: { teacherId, isActive: true }, select: { id: true } })
    for (const r of live) await endLiveRoom(r.id).catch(() => {})
    await db.workshop.updateMany({ where: { teacherId, status: "PUBLISHED" }, data: { status: "DRAFT" } })
  }
  // Tell everybody in the trial room what was decided, then close the room a little later
  // (deleting it right away would drop the teacher before they could read the result).
  const roomName = trialRoomName(teacherId)
  const svc = livekitRoomService()
  if (action === "approve" || action === "reject") {
    const payload = JSON.stringify({ type: action === "approve" ? "APPROVED" : "REJECTED", note: cleanNote || undefined })
    svc.sendData(roomName, new TextEncoder().encode(payload), DataPacket_Kind.RELIABLE, { topic: "trial-decision" }).catch(() => {})
  }
  const closer = setTimeout(() => svc.deleteRoom(roomName).catch(() => {}), action === "revoke" ? 0 : 20_000)
  closer.unref?.()

  if (teacher.user.email) {
    const subject =
      action === "approve" ? "AYA: Eğitmenliğiniz onaylandı 🎉" : action === "reject" ? "AYA: Deneme yayınınız hakkında" : "AYA: Eğitmen onayınız hakkında"
    const body =
      action === "approve"
        ? "Deneme yayınınız başarıyla tamamlandı. Artık öğrencilere ders açabilir, canlı yayın ve atölye oluşturabilirsiniz."
        : action === "reject"
        ? "Deneme yayınınız bu kez onaylanmadı. Aşağıdaki notu inceleyip yeniden deneme yayını yapabilirsiniz."
        : "Eğitmen onayınız yönetici tarafından kaldırıldı."
    sendEmail({
      to: teacher.user.email,
      subject,
      html: `<p>Merhaba ${teacher.user.name ?? ""},</p><p>${body}</p>${cleanNote ? `<p><b>Not:</b> ${cleanNote.replace(/</g, "&lt;")}</p>` : ""}<p>AYA Ekibi</p>`,
    }).catch(() => {})
  }

  return { ok: true, isTrialMode: next.isTrialMode }
}
